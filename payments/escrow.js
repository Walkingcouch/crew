'use strict';

/**
 * payments/escrow.js
 *
 * Escrow state machine for the Crew job payment lifecycle.
 *
 * ── State diagram ────────────────────────────────────────────────────────────
 *
 *   CREATED
 *     │ chargeCustomer()
 *     ▼
 *   PAYMENT_PENDING          (Zai processing card / bank)
 *     │ webhook: payment_captured
 *     ▼
 *   PAYMENT_HELD             (funds in Zai escrow sub-account)
 *     │ markJobComplete()
 *     ▼
 *   DISPUTABLE               (12-hour customer dispute window)
 *     │ auto-release timer OR approveRelease()
 *     ├──► RELEASING
 *     │      │ webhook: items.release_complete
 *     │      ▼
 *     │    RELEASED           (contractor paid, platform fee routed)
 *     │
 *     └──► DISPUTED           (customer raised issue within window)
 *            │ admin resolves
 *            ├──► RELEASING   (if resolution = release)
 *            └──► REFUNDED    (if resolution = refund)
 *
 *   Any state before RELEASING:
 *     │ cancelEscrow() / payment failure
 *     ▼
 *   CANCELLED / REFUNDED
 *
 * ── Zai Item payment_type values ─────────────────────────────────────────────
 *   1 = escrow (held until release)
 *   2 = express (instant)
 *   3 = milestone
 *
 * ── Supabase tables referenced ────────────────────────────────────────────────
 *   bookings         id, status, zai_item_id, zai_fee_id, amount_cents,
 *                    buyer_zai_id, seller_zai_id, tier, booking_ref
 *   escrow_events    id, booking_id, from_state, to_state, trigger, metadata, ts
 *   transactions     id, booking_id, type, amount_cents, zai_response, ts
 *
 * ── Required env vars ─────────────────────────────────────────────────────────
 *   ZAI_PLATFORM_ACCOUNT_ID   Crew's Zai account that receives commission fees
 *   SUPABASE_SERVICE_ROLE_KEY  For server-side Supabase writes
 *   SUPABASE_URL
 */

const zai  = require('./zai-client');
const gst  = require('./gst');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase admin client (server-side only) ──────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── State definitions ─────────────────────────────────────────────────────────
const STATES = Object.freeze({
  CREATED:         'CREATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_HELD:    'PAYMENT_HELD',
  DISPUTABLE:      'DISPUTABLE',
  RELEASING:       'RELEASING',
  RELEASED:        'RELEASED',
  DISPUTED:        'DISPUTED',
  REFUNDED:        'REFUNDED',
  CANCELLED:       'CANCELLED',
});

// Valid transitions: from → set of allowed targets
const TRANSITIONS = Object.freeze({
  [STATES.CREATED]:         new Set([STATES.PAYMENT_PENDING, STATES.CANCELLED]),
  [STATES.PAYMENT_PENDING]: new Set([STATES.PAYMENT_HELD,    STATES.CANCELLED]),
  [STATES.PAYMENT_HELD]:    new Set([STATES.DISPUTABLE,      STATES.DISPUTED, STATES.REFUNDED]),
  [STATES.DISPUTABLE]:      new Set([STATES.RELEASING,       STATES.DISPUTED]),
  [STATES.RELEASING]:       new Set([STATES.RELEASED]),
  [STATES.DISPUTED]:        new Set([STATES.RELEASING,       STATES.REFUNDED]),
  [STATES.RELEASED]:        new Set([]),
  [STATES.REFUNDED]:        new Set([]),
  [STATES.CANCELLED]:       new Set([]),
});

// Terminal states — no further transitions allowed
const TERMINAL_STATES = new Set([STATES.RELEASED, STATES.REFUNDED, STATES.CANCELLED]);

// ── Zai payment_type constants ────────────────────────────────────────────────
const ZAI_PAYMENT_TYPE_ESCROW = 1;

// ── State machine guard ───────────────────────────────────────────────────────
function assertTransition(current, target) {
  const allowed = TRANSITIONS[current];
  if (!allowed) {
    throw new Error(`Unknown escrow state: "${current}"`);
  }
  if (!allowed.has(target)) {
    throw new Error(
      `Invalid escrow transition: ${current} → ${target}. ` +
      `Allowed: [${[...allowed].join(', ') || 'none'}]`
    );
  }
}

// ── Atomic compare-and-swap transition ───────────────────────────────────────
// Updates escrow_state from fromState to toState only if the DB row is still
// in fromState. If another request already transitioned the row, this throws
// 409 instead of proceeding — preventing double-releases and double-refunds.
async function casTransition(supabase, bookingId, fromState, toState, extraUpdates = {}) {
  assertTransition(fromState, toState);

  const { data } = await supabase
    .from('bookings')
    .update({ escrow_state: toState, ...extraUpdates })
    .eq('id', bookingId)
    .eq('escrow_state', fromState)   // the CAS guard
    .select('id');

  if (!data?.length) {
    const err = new Error(
      `Concurrent modification: booking ${bookingId} was not in state ${fromState}. ` +
      'Another request already processed this transition.'
    );
    err.statusCode = 409;
    err.code = 'CONCURRENT_MODIFICATION';
    throw err;
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────
async function logEscrowEvent(supabase, bookingId, fromState, toState, trigger, metadata = {}) {
  await supabase.from('escrow_events').insert({
    booking_id: bookingId,
    from_state: fromState,
    to_state:   toState,
    trigger,
    metadata,
    ts: new Date().toISOString(),
  });
}

async function logTransaction(supabase, bookingId, type, amountCents, zaiResponse = {}) {
  await supabase.from('transactions').insert({
    booking_id:   bookingId,
    type,
    amount_cents: amountCents,
    zai_response: zaiResponse,
    ts: new Date().toISOString(),
  });
}

// ── 1. CREATE JOB ESCROW ──────────────────────────────────────────────────────
/**
 * Initialises a Zai Item for a job booking.
 * Creates the platform fee object, then the escrow Item linking buyer→seller.
 *
 * Call this immediately when a booking is confirmed (before payment).
 *
 * @param {object} booking
 * @param {string} booking.id              Supabase booking UUID
 * @param {string} booking.bookingRef      Human ref e.g. "BK-2026-00142"
 * @param {string} booking.serviceName     e.g. "Standard Lawn Mow"
 * @param {number} booking.amountCents     Total GST-inclusive charge, in cents
 * @param {string} booking.buyerZaiId      Customer's Zai user ID
 * @param {string} booking.sellerZaiId     Contractor's Zai user ID
 * @param {string} booking.tier            'standard' | 'enterprise'
 * @param {string} booking.address         Service address (used in description)
 *
 * @returns {{ zaiItemId, zaiFeeId, ledger }}
 */
async function createJobEscrow(booking) {
  const supabase = getSupabase();

  const {
    id: bookingId, bookingRef, serviceName, amountCents,
    buyerZaiId, sellerZaiId, tier, address,
  } = booking;

  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new RangeError(`amountCents must be ≥ 100 cents, got ${amountCents}`);
  }

  // Build full GST ledger
  const ledger = gst.buildLedger({
    jobTotalCents:  amountCents,
    tier,
    serviceName,
    contractorName: 'Contractor',
    bookingRef,
    dateISO: new Date().toISOString(),
  });
  gst.assertLedgerValid(ledger);

  // ── Step 1: Create the platform commission fee in Zai ────────────────────
  const feeRes = await zai.createFee({
    name:       `Crew Platform Fee — ${bookingRef}`,
    fee_type_id: 1,                              // fixed amount
    amount:      ledger.platformFee.zaiFeeCents, // cents, GST-inclusive
    currency:   'AUD',
    account_id:  process.env.ZAI_PLATFORM_ACCOUNT_ID,
  });
  const zaiFeeId = feeRes?.fees?.id;
  if (!zaiFeeId) throw new Error(`Zai fee creation failed for booking ${bookingId}`);

  // ── Step 2: Create the escrow Item ───────────────────────────────────────
  // Due date = today + 14 days (statutory max for escrow hold without release)
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const itemRes = await zai.createItem({
    id:                  `crew_${bookingId.replace(/-/g, '')}`,  // Zai requires alphanumeric
    name:                `${serviceName} — ${address || bookingRef}`,
    amount:              amountCents,
    currency:            'AUD',
    payment_type:        ZAI_PAYMENT_TYPE_ESCROW,
    buyer_id:            buyerZaiId,
    seller_id:           sellerZaiId,
    fee_ids:             [zaiFeeId],
    description:         `${serviceName} at ${address}. Ref: ${bookingRef}`,
    due_date:            dueDate,
    custom_descriptor:   `CREW.${bookingRef}`,
    tax_invoice_amount:  ledger.gstSummary.totalGst,
  }, bookingId);

  const zaiItemId = itemRes?.items?.id;
  if (!zaiItemId) throw new Error(`Zai item creation failed for booking ${bookingId}`);

  // ── Step 3: Persist Zai IDs and initial state in Supabase ────────────────
  await supabase
    .from('bookings')
    .update({
      zai_item_id:   zaiItemId,
      zai_fee_id:    zaiFeeId,
      escrow_state:  STATES.CREATED,
      ledger_json:   ledger,
    })
    .eq('id', bookingId);

  await logEscrowEvent(supabase, bookingId, null, STATES.CREATED, 'createJobEscrow', {
    zaiItemId, zaiFeeId, amountCents,
  });
  await logTransaction(supabase, bookingId, 'ESCROW_CREATED', amountCents, itemRes);

  return { zaiItemId, zaiFeeId, ledger };
}

// ── 2. CHARGE CUSTOMER ────────────────────────────────────────────────────────
/**
 * Attaches a payment method to the Zai Item and initiates the capture.
 * Funds are held in Zai's escrow sub-account on success.
 *
 * @param {object} booking       Supabase booking row (must have zai_item_id, escrow_state)
 * @param {string} accountId     Zai card_account ID or bank_account ID from frontend tokenisation
 * @param {string} ipAddress     Buyer's IP address (required by Zai for fraud scoring)
 *
 * @returns {object} Zai charge response
 */
async function chargeCustomer(booking, accountId, ipAddress) {
  const supabase = getSupabase();

  // CAS: transition CREATED -> PAYMENT_PENDING atomically before calling Zai
  await casTransition(supabase, booking.id, STATES.CREATED, STATES.PAYMENT_PENDING, {
    payment_account_id: accountId,
  });

  const chargeRes = await zai.chargeItem(
    booking.zai_item_id,
    {
      account_id:         accountId,
      ip_address:         ipAddress,
      retries_attempted:  0,
    },
    booking.id
  );

  await logEscrowEvent(supabase, booking.id, STATES.CREATED, STATES.PAYMENT_PENDING, 'chargeCustomer', {
    zaiChargeId: chargeRes?.charges?.id,
    accountId,
  });
  await logTransaction(supabase, booking.id, 'CHARGE_INITIATED', booking.amount_cents, chargeRes);

  return chargeRes;
}

// ── 3. MARK JOB COMPLETE ─────────────────────────────────────────────────────
/**
 * Called by the contractor (or auto-trigger) when the job is finished.
 * Opens the 12-hour dispute window before escrow releases automatically.
 *
 * Does NOT call Zai directly — just advances the internal state and schedules
 * the auto-release via a Supabase Edge Function cron or the webhook route.
 *
 * @param {object} booking
 * @param {string} completedBy   Supabase user ID of the completing party
 * @returns {{ releaseAt: Date }}
 */
async function markJobComplete(booking, completedBy) {
  const supabase = getSupabase();
  const releaseAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // +12 hours

  // CAS: only PAYMENT_HELD -> DISPUTABLE; rejects concurrent duplicate completions
  await casTransition(supabase, booking.id, STATES.PAYMENT_HELD, STATES.DISPUTABLE, {
    job_completed_at: new Date().toISOString(),
    auto_release_at:  releaseAt.toISOString(),
    completed_by:     completedBy,
  });

  await logEscrowEvent(supabase, booking.id, STATES.PAYMENT_HELD, STATES.DISPUTABLE, 'markJobComplete', {
    completedBy, releaseAt: releaseAt.toISOString(),
  });

  return { releaseAt };
}

// ── 4. RELEASE ESCROW ─────────────────────────────────────────────────────────
/**
 * Releases the held funds. Zai splits the payout:
 *   - Contractor receives: jobTotal − platformFee
 *   - Crew account receives: platformFee
 *
 * Called by:
 *   - Auto-release after 12h dispute window (triggered by cron / webhook)
 *   - Customer explicitly approving the job via the portal
 *   - Admin resolution in favour of contractor
 *
 * @param {object} booking   Must have zai_item_id, escrow_state, amount_cents, tier
 * @param {string} trigger   'auto' | 'customer_approved' | 'admin_resolved'
 */
async function releaseEscrow(booking, trigger = 'auto') {
  const supabase = getSupabase();
  const fromState = booking.escrow_state;

  // CAS: claim the RELEASING state atomically BEFORE calling Zai.
  // If another concurrent request already transitioned this booking,
  // casTransition throws 409 and the Zai call is never made — preventing
  // double-release of funds.
  await casTransition(supabase, booking.id, fromState, STATES.RELEASING, {
    released_at:     new Date().toISOString(),
    release_trigger: trigger,
  });

  const releaseRes = await zai.releaseItem(booking.zai_item_id, booking.id);

  await logEscrowEvent(supabase, booking.id, fromState, STATES.RELEASING,
    `releaseEscrow:${trigger}`, { zaiResponse: releaseRes }
  );
  await logTransaction(supabase, booking.id, 'ESCROW_RELEASE_REQUESTED',
    booking.amount_cents, releaseRes
  );

  return releaseRes;
}

// ── 5. RAISE DISPUTE ─────────────────────────────────────────────────────────
/**
 * Customer raises a dispute within the 12-hour window.
 * Freezes the escrow until admin resolves.
 *
 * @param {object} booking
 * @param {string} reason          One of: INCOMPLETE_WORK | POOR_QUALITY | NO_SHOW | OTHER
 * @param {string} raisedByUserId  Supabase user ID of the disputing party
 * @param {string} [notes]         Free-text customer description
 */
async function raiseDispute(booking, reason, raisedByUserId, notes = '') {
  const supabase = getSupabase();
  const fromState = booking.escrow_state;

  const DISPUTE_REASONS = new Set(['INCOMPLETE_WORK', 'POOR_QUALITY', 'NO_SHOW', 'OTHER']);
  if (!DISPUTE_REASONS.has(reason)) {
    throw new RangeError(`Invalid dispute reason: ${reason}. Must be one of: ${[...DISPUTE_REASONS].join(', ')}`);
  }

  // CAS: claim DISPUTED state atomically before calling Zai
  await casTransition(supabase, booking.id, fromState, STATES.DISPUTED, {
    dispute_reason: reason,
    dispute_notes:  notes,
    disputed_at:    new Date().toISOString(),
    disputed_by:    raisedByUserId,
  });

  const disputeRes = await zai.raiseDispute(
    booking.zai_item_id,
    { reason_code: reason, description: notes.slice(0, 500) },
    booking.id
  );

  // Update the Zai dispute ID once we have it
  if (disputeRes?.disputes?.id) {
    await supabase.from('bookings')
      .update({ zai_dispute_id: disputeRes.disputes.id })
      .eq('id', booking.id);
  }

  await logEscrowEvent(supabase, booking.id, fromState, STATES.DISPUTED, 'raiseDispute',
    { reason, raisedByUserId, zaiDisputeId: disputeRes?.disputes?.id }
  );

  return disputeRes;
}

// ── 6. RESOLVE DISPUTE (admin) ────────────────────────────────────────────────
/**
 * Admin resolves a dispute.
 *
 * @param {object} booking
 * @param {'release'|'refund'} resolution   Outcome of admin review
 * @param {string} adminUserId
 * @param {string} [adminNotes]
 */
async function resolveDispute(booking, resolution, adminUserId, adminNotes = '') {
  const supabase = getSupabase();
  if (booking.escrow_state !== STATES.DISPUTED) {
    throw new Error(`Cannot resolve dispute: booking is not in DISPUTED state (is: ${booking.escrow_state})`);
  }

  if (resolution === 'release') {
    // Release to contractor — same path as normal release
    await releaseEscrow(booking, 'admin_resolved');
  } else if (resolution === 'refund') {
    await refundCustomer(booking, booking.amount_cents, `admin_resolved:${adminNotes}`);
  } else {
    throw new RangeError(`Invalid resolution: "${resolution}". Must be "release" or "refund".`);
  }

  const resolveRes = await zai.resolveDispute(
    booking.zai_item_id,
    booking.zai_dispute_id,
    {
      outcome:    resolution === 'release' ? 'no_outcome_required' : 'refund',
      admin_note: adminNotes.slice(0, 500),
    }
  );

  await supabase
    .from('bookings')
    .update({
      dispute_resolved_at: new Date().toISOString(),
      dispute_resolved_by: adminUserId,
      dispute_resolution:  resolution,
      dispute_admin_notes: adminNotes,
    })
    .eq('id', booking.id);

  await logEscrowEvent(supabase, booking.id, STATES.DISPUTED,
    resolution === 'release' ? STATES.RELEASING : STATES.REFUNDED,
    `resolveDispute:${resolution}`,
    { adminUserId, adminNotes }
  );

  return resolveRes;
}

// ── 7. REFUND CUSTOMER ────────────────────────────────────────────────────────
/**
 * Issues a full or partial refund to the buyer.
 * Zai reverses the charge back to the original payment method.
 *
 * @param {object} booking
 * @param {number} refundCents   Amount to refund (must be ≤ booking.amount_cents)
 * @param {string} reason        Free-text reason stored in audit log
 */
async function refundCustomer(booking, refundCents, reason = '') {
  const supabase = getSupabase();
  const fromState = booking.escrow_state;

  const validFromStates = new Set([STATES.PAYMENT_HELD, STATES.DISPUTABLE, STATES.DISPUTED]);
  if (!validFromStates.has(fromState)) {
    throw new Error(`Cannot refund from state: ${fromState}`);
  }
  if (refundCents > booking.amount_cents) {
    throw new RangeError(
      `Refund ${refundCents} cents exceeds booking amount ${booking.amount_cents} cents`
    );
  }

  // CAS: claim REFUNDED state atomically before calling Zai
  await casTransition(supabase, booking.id, fromState, STATES.REFUNDED, {
    refunded_at:   new Date().toISOString(),
    refund_amount: refundCents,
    refund_reason: reason,
  });

  const refundRes = await zai.refundItem(
    booking.zai_item_id,
    {
      refund_amount:   refundCents,
      refund_message:  reason.slice(0, 255),
    },
    booking.id
  );

  await logEscrowEvent(supabase, booking.id, fromState, STATES.REFUNDED, 'refundCustomer',
    { refundCents, reason }
  );
  await logTransaction(supabase, booking.id, 'REFUND', refundCents, refundRes);

  return refundRes;
}

// ── 8. CANCEL ESCROW ─────────────────────────────────────────────────────────
/**
 * Cancels the escrow before payment capture.
 * If funds were already captured, use refundCustomer() instead.
 *
 * @param {object} booking
 * @param {string} reason
 */
async function cancelEscrow(booking, reason = '') {
  const supabase = getSupabase();
  const fromState = booking.escrow_state;

  await casTransition(supabase, booking.id, fromState, STATES.CANCELLED, {
    cancelled_at:  new Date().toISOString(),
    cancel_reason: reason,
  });

  await logEscrowEvent(supabase, booking.id,
    fromState, STATES.CANCELLED, 'cancelEscrow', { reason }
  );
}

// ── 9. GET ESCROW STATUS ──────────────────────────────────────────────────────
/**
 * Fetches live Zai item status and reconciles against Supabase state.
 * Returns a combined view of internal state + Zai's live data.
 *
 * @param {object} booking   Supabase booking row
 * @returns {{ internal: string, zai: object, inSync: boolean }}
 */
async function getEscrowStatus(booking) {
  if (!booking.zai_item_id) {
    return { internal: booking.escrow_state, zai: null, inSync: false };
  }

  const itemRes = await zai.getItem(booking.zai_item_id);
  const zaiItem = itemRes?.items;

  // Map Zai's status string to our internal states
  const ZAI_TO_INTERNAL = {
    pending_payment:   STATES.CREATED,
    payment_required:  STATES.CREATED,
    payment_pending:   STATES.PAYMENT_PENDING,
    payment_deposited: STATES.PAYMENT_HELD,
    completed:         STATES.RELEASED,
    refunded:          STATES.REFUNDED,
    cancelled:         STATES.CANCELLED,
  };
  const derivedState = ZAI_TO_INTERNAL[zaiItem?.status] || STATES.CREATED;

  return {
    internal:     booking.escrow_state,
    zai:          zaiItem,
    inSync:       derivedState === booking.escrow_state,
    derivedState,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  STATES,
  TRANSITIONS,
  TERMINAL_STATES,

  createJobEscrow,
  chargeCustomer,
  markJobComplete,
  releaseEscrow,
  raiseDispute,
  resolveDispute,
  refundCustomer,
  cancelEscrow,
  getEscrowStatus,
};
