'use strict';

/**
 * payments/escrow.js
 *
 * Escrow state machine for the Crew job payment lifecycle, running against
 * whichever payment provider payments/index.js selects (CheckVault, real or
 * mock). Provider-agnostic: nothing here knows about CheckVault's HTTP
 * shape, that's isolated in payments/checkvault-client.js /
 * payments/checkvault-mock.js.
 *
 * ── State diagram ────────────────────────────────────────────────────────────
 *
 *   CREATED
 *     │ createJobEscrow(): provider.createEscrow(), payment instructions shown
 *     ▼
 *   PAYMENT_PENDING          (waiting for bank transfer/BPAY to clear, or card)
 *     │ webhook / mock clear-funds
 *     ▼
 *   PAYMENT_HELD             (funds in the CheckVault trust account)
 *     │ markJobComplete()
 *     ▼
 *   DISPUTABLE               (dispute window open)
 *     │ approveRelease() / auto-release past dispute_deadline
 *     ├──► RELEASING ──► RELEASED   (contractor paid, platform fee routed)
 *     └──► DISPUTED             (customer or contractor raised an issue)
 *            │ admin resolves
 *            ├──► RELEASING ──► RELEASED
 *            └──► REFUNDED
 *
 *   Pre-payment:            CREATED / PAYMENT_PENDING → CANCELLED (no charge yet)
 *   Post-payment cancel:    PAYMENT_HELD / DISPUTABLE → CANCELLED (partial refund + fee, see cancelWithFee)
 *
 * ── Required env vars ─────────────────────────────────────────────────────────
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   (provider credentials are read by payments/checkvault-client.js directly)
 */

const gst  = require('./gst');
const { getProvider } = require('./index');
const { createClient } = require('@supabase/supabase-js');

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _supabase;
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

const TRANSITIONS = Object.freeze({
  [STATES.CREATED]:         new Set([STATES.PAYMENT_PENDING, STATES.CANCELLED]),
  [STATES.PAYMENT_PENDING]: new Set([STATES.PAYMENT_HELD,    STATES.CANCELLED]),
  [STATES.PAYMENT_HELD]:    new Set([STATES.DISPUTABLE,      STATES.DISPUTED, STATES.REFUNDED, STATES.CANCELLED]),
  [STATES.DISPUTABLE]:      new Set([STATES.RELEASING,       STATES.DISPUTED, STATES.CANCELLED]),
  [STATES.RELEASING]:       new Set([STATES.RELEASED]),
  [STATES.DISPUTED]:        new Set([STATES.RELEASING,       STATES.REFUNDED]),
  [STATES.RELEASED]:        new Set([]),
  [STATES.REFUNDED]:        new Set([]),
  [STATES.CANCELLED]:       new Set([]),
});

const TERMINAL_STATES = new Set([STATES.RELEASED, STATES.REFUNDED, STATES.CANCELLED]);

// ── State machine guard ───────────────────────────────────────────────────────
function assertTransition(current, target) {
  const allowed = TRANSITIONS[current];
  if (!allowed) throw new Error(`Unknown escrow state: "${current}"`);
  if (!allowed.has(target)) {
    throw new Error(`Invalid escrow transition: ${current} → ${target}. Allowed: [${[...allowed].join(', ') || 'none'}]`);
  }
}

// ── Atomic compare-and-swap transition ───────────────────────────────────────
// Updates escrow_state from fromState to toState only if the DB row is still
// in fromState. If another request already transitioned the row, this throws
// a 409 instead of proceeding, preventing double-releases and double-refunds.
async function casTransition(supabase, bookingId, fromState, toState, extraUpdates = {}) {
  assertTransition(fromState, toState);

  const { data } = await supabase
    .from('bookings')
    .update({ escrow_state: toState, ...extraUpdates })
    .eq('id', bookingId)
    .eq('escrow_state', fromState)   // the CAS guard
    .select('id');

  if (!data?.length) {
    await supabase.from('escrow_events').insert({
      booking_id: bookingId, from_state: fromState, to_state: toState,
      trigger: 'cas_conflict', reason: 'cas_conflict',
      metadata: { attemptedFrom: fromState, attemptedTo: toState },
      ts: new Date().toISOString(),
    });
    const err = new Error(
      `Concurrent modification: booking ${bookingId} was not in state ${fromState}. Another request already processed this transition.`
    );
    err.statusCode = 409;
    err.code = 'CONCURRENT_MODIFICATION';
    throw err;
  }
}

async function logEscrowEvent(supabase, bookingId, fromState, toState, trigger, metadata = {}) {
  await supabase.from('escrow_events').insert({
    booking_id: bookingId, from_state: fromState, to_state: toState, trigger, metadata,
    ts: new Date().toISOString(),
  });
}

async function logTransaction(supabase, bookingId, type, amountCents, providerResponse = {}) {
  await supabase.from('transactions').insert({
    booking_id: bookingId, type, amount_cents: amountCents, provider_response: providerResponse,
    ts: new Date().toISOString(),
  });
}

// ── 1. CREATE JOB ESCROW ──────────────────────────────────────────────────────
/**
 * Creates the provider escrow for a booking and immediately advances
 * CREATED -> PAYMENT_PENDING, since payment instructions are shown to the
 * customer the moment they exist (they now owe payment to proceed).
 *
 * @param {object} booking
 * @param {string} booking.id
 * @param {string} booking.bookingRef
 * @param {string} booking.serviceName
 * @param {number} booking.amountCents
 * @param {string} booking.buyerProviderId
 * @param {string} booking.sellerProviderId
 * @param {string} booking.tier
 * @param {string} booking.address
 *
 * @returns {{ providerEscrowId, paymentInstructions, ledger }}
 */
async function createJobEscrow(booking) {
  const supabase = getSupabase();
  const provider  = getProvider();

  const { id: bookingId, bookingRef, serviceName, amountCents, buyerProviderId, sellerProviderId, tier, address } = booking;

  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new RangeError(`amountCents must be ≥ 100 cents, got ${amountCents}`);
  }

  const ledger = gst.buildLedger({
    jobTotalCents: amountCents, tier, serviceName,
    contractorName: 'Contractor', bookingRef, dateISO: new Date().toISOString(),
  });
  gst.assertLedgerValid(ledger);

  const { providerEscrowId, paymentInstructions } = await provider.createEscrow({
    bookingId, bookingRef, totalCents: amountCents,
    description: `${serviceName} at ${address || bookingRef}`,
    buyerProviderId, sellerProviderId,
  });

  if (!providerEscrowId) throw new Error(`Escrow creation failed for booking ${bookingId}`);

  await casTransition(supabase, bookingId, STATES.CREATED, STATES.PAYMENT_PENDING, {
    provider_escrow_id: providerEscrowId,
    payment_reference:  paymentInstructions.reference,
    payment_method:      paymentInstructions.method,
    ledger_json:         ledger,
  });

  await logEscrowEvent(supabase, bookingId, STATES.CREATED, STATES.PAYMENT_PENDING, 'createJobEscrow', {
    providerEscrowId, amountCents,
  });
  await logTransaction(supabase, bookingId, 'deposit', amountCents, { providerEscrowId, paymentInstructions });

  return { providerEscrowId, paymentInstructions, ledger };
}

// ── 2. MARK JOB COMPLETE ─────────────────────────────────────────────────────
async function markJobComplete(booking, completedBy) {
  const supabase = getSupabase();
  const releaseAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // +12 hours

  await casTransition(supabase, booking.id, STATES.PAYMENT_HELD, STATES.DISPUTABLE, {
    job_completed_at: new Date().toISOString(),
    auto_release_at:  releaseAt.toISOString(),
    dispute_deadline:  releaseAt.toISOString(),
    completed_by:      completedBy,
  });

  await logEscrowEvent(supabase, booking.id, STATES.PAYMENT_HELD, STATES.DISPUTABLE, 'markJobComplete', {
    completedBy, releaseAt: releaseAt.toISOString(),
  });

  return { releaseAt };
}

// ── 3. RELEASE ESCROW ─────────────────────────────────────────────────────────
/**
 * Releases held funds: contractor receives jobTotal - platformFee, Crew's
 * trust account receives platformFee. Generates and emails tax invoices on
 * success (idempotent by invoice_number per booking + recipient).
 *
 * @param {object} booking   Must have provider_escrow_id, escrow_state, amount_cents, ledger_json
 * @param {string} trigger   'auto' | 'customer_approved' | 'admin_resolved'
 */
async function releaseEscrow(booking, trigger = 'auto') {
  const supabase = getSupabase();
  const provider  = getProvider();
  const fromState = booking.escrow_state;

  await casTransition(supabase, booking.id, fromState, STATES.RELEASING, {
    release_trigger: trigger,
  });

  const ledger = booking.ledger_json || gst.buildLedger({
    jobTotalCents: booking.amount_cents, tier: 'standard', serviceName: booking.service_name || booking.service_type,
    contractorName: 'Contractor', bookingRef: booking.ref, dateISO: booking.created_at,
  });

  const payoutCents = ledger.contractorPayout.incGstCents;
  const feeCents     = ledger.platformFee.incGstCents;

  const releaseRes = await provider.releaseEscrow(booking.provider_escrow_id, { payoutCents, feeCents }, booking.id);

  // The provider call is awaited synchronously (mock and, per CHECKVAULT-SPEC,
  // presumed real behaviour), so we complete the transition here rather than
  // waiting on an unconfirmed webhook contract. If CheckVault's real release
  // turns out to be async, the webhook handler's RELEASED path (idempotent)
  // covers that case too.
  await casTransition(supabase, booking.id, STATES.RELEASING, STATES.RELEASED, {
    payment_released_at: new Date().toISOString(),
  });

  await logEscrowEvent(supabase, booking.id, fromState, STATES.RELEASED, `releaseEscrow:${trigger}`, { providerResponse: releaseRes });
  await logTransaction(supabase, booking.id, 'release', payoutCents, releaseRes);
  await logTransaction(supabase, booking.id, 'fee', feeCents, releaseRes);

  try {
    const { generateInvoicesForBooking } = require('../lib/invoices');
    await generateInvoicesForBooking({ ...booking, escrow_state: STATES.RELEASED, ledger_json: ledger });
  } catch (invoiceErr) {
    // Invoice generation failure must never roll back a successful release.
    console.error(`[escrow] invoice generation failed for booking ${booking.id}:`, invoiceErr.message);
  }

  return releaseRes;
}

// ── 4. RAISE DISPUTE ─────────────────────────────────────────────────────────
async function raiseDispute(booking, reason, raisedByUserId, notes = '') {
  const supabase = getSupabase();
  const provider  = getProvider();
  const fromState = booking.escrow_state;

  const DISPUTE_REASONS = new Set(['INCOMPLETE_WORK', 'POOR_QUALITY', 'NO_SHOW', 'OTHER']);
  if (!DISPUTE_REASONS.has(reason)) {
    throw new RangeError(`Invalid dispute reason: ${reason}. Must be one of: ${[...DISPUTE_REASONS].join(', ')}`);
  }

  await casTransition(supabase, booking.id, fromState, STATES.DISPUTED, {
    dispute_reason: reason, dispute_notes: notes,
    disputed_at: new Date().toISOString(), disputed_by: raisedByUserId,
  });

  const disputeRes = await provider.raiseDispute(booking.provider_escrow_id, { reason, notes }, booking.id);

  if (disputeRes?.providerDisputeId) {
    await supabase.from('bookings').update({ provider_dispute_id: disputeRes.providerDisputeId }).eq('id', booking.id);
  }

  await logEscrowEvent(supabase, booking.id, fromState, STATES.DISPUTED, 'raiseDispute', {
    reason, raisedByUserId, providerDisputeId: disputeRes?.providerDisputeId,
  });

  return disputeRes;
}

// ── 5. RESOLVE DISPUTE (admin) ────────────────────────────────────────────────
async function resolveDispute(booking, resolution, adminUserId, adminNotes = '') {
  const supabase = getSupabase();
  const provider  = getProvider();

  if (booking.escrow_state !== STATES.DISPUTED) {
    throw new Error(`Cannot resolve dispute: booking is not in DISPUTED state (is: ${booking.escrow_state})`);
  }

  let resolveRes;
  if (resolution === 'release') {
    resolveRes = await releaseEscrow(booking, 'admin_resolved');
  } else if (resolution === 'refund') {
    resolveRes = await refundCustomer(booking, booking.amount_cents, `admin_resolved:${adminNotes}`);
  } else {
    throw new RangeError(`Invalid resolution: "${resolution}". Must be "release" or "refund".`);
  }

  if (booking.provider_dispute_id) {
    await provider.resolveDispute(booking.provider_escrow_id, booking.provider_dispute_id, {
      outcome: resolution, notes: adminNotes,
    });
  }

  await supabase.from('bookings').update({
    dispute_resolved_at: new Date().toISOString(),
    dispute_resolved_by: adminUserId,
    dispute_resolution:  resolution,
    dispute_admin_notes: adminNotes,
  }).eq('id', booking.id);

  await logEscrowEvent(supabase, booking.id, STATES.DISPUTED,
    resolution === 'release' ? STATES.RELEASED : STATES.REFUNDED,
    `resolveDispute:${resolution}`, { adminUserId, adminNotes }
  );

  return resolveRes;
}

// ── 6. REFUND CUSTOMER (full, no fee retained) ────────────────────────────────
async function refundCustomer(booking, refundCents, reason = '') {
  const supabase = getSupabase();
  const provider  = getProvider();
  const fromState = booking.escrow_state;

  const validFromStates = new Set([STATES.PAYMENT_HELD, STATES.DISPUTABLE, STATES.DISPUTED]);
  if (!validFromStates.has(fromState)) throw new Error(`Cannot refund from state: ${fromState}`);
  if (refundCents > booking.amount_cents) {
    throw new RangeError(`Refund ${refundCents} cents exceeds booking amount ${booking.amount_cents} cents`);
  }

  await casTransition(supabase, booking.id, fromState, STATES.REFUNDED, {
    refunded_at: new Date().toISOString(), refund_amount: refundCents, refund_reason: reason,
  });

  const refundRes = await provider.refundEscrow(booking.provider_escrow_id, { refundCents, reason }, booking.id);

  await logEscrowEvent(supabase, booking.id, fromState, STATES.REFUNDED, 'refundCustomer', { refundCents, reason });
  await logTransaction(supabase, booking.id, 'refund', refundCents, refundRes);

  return refundRes;
}

// ── 7. CANCEL ESCROW (pre-payment, no funds captured yet) ────────────────────
async function cancelEscrow(booking, reason = '') {
  const supabase = getSupabase();
  const provider  = getProvider();
  const fromState = booking.escrow_state;

  const validFromStates = new Set([STATES.CREATED, STATES.PAYMENT_PENDING]);
  if (!validFromStates.has(fromState)) {
    throw new Error(`cancelEscrow is only valid before funds are captured (CREATED/PAYMENT_PENDING); use cancelWithFee for state ${fromState}`);
  }

  await casTransition(supabase, booking.id, fromState, STATES.CANCELLED, {
    cancelled_at: new Date().toISOString(), cancel_reason: reason,
  });

  if (booking.provider_escrow_id) {
    await provider.cancelEscrow(booking.provider_escrow_id, { reason }, booking.id);
  }

  await logEscrowEvent(supabase, booking.id, fromState, STATES.CANCELLED, 'cancelEscrow', { reason });
}

// ── 8. CANCEL WITH FEE (post-payment: partial refund, fee retained) ──────────
/**
 * Customer cancels after funds are already held. Computes the fee via
 * gst.calcLateCancellationFee (0% more than 2 hours out, 25% at/after the
 * 2-hour mark), refunds the remainder, and retains the fee in Crew's account.
 *
 * @param {object} booking
 * @param {number} feeCents
 * @param {number} refundCents
 * @param {string} [reason]
 */
async function cancelWithFee(booking, feeCents, refundCents, reason = '') {
  const supabase = getSupabase();
  const provider  = getProvider();
  const fromState = booking.escrow_state;

  const validFromStates = new Set([STATES.PAYMENT_HELD, STATES.DISPUTABLE]);
  if (!validFromStates.has(fromState)) {
    throw new Error(`cancelWithFee is only valid from PAYMENT_HELD/DISPUTABLE (is: ${fromState})`);
  }

  await casTransition(supabase, booking.id, fromState, STATES.CANCELLED, {
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason,
    cancellation_fee_cents: feeCents,
  });

  const result = feeCents > 0
    ? await provider.partialRefund(booking.provider_escrow_id, { refundCents, retainCents: feeCents, reason }, booking.id)
    : await provider.refundEscrow(booking.provider_escrow_id, { refundCents, reason }, booking.id);

  await logEscrowEvent(supabase, booking.id, fromState, STATES.CANCELLED, 'cancelWithFee', { feeCents, refundCents, reason });
  if (refundCents > 0) await logTransaction(supabase, booking.id, 'refund', refundCents, result);
  if (feeCents > 0)     await logTransaction(supabase, booking.id, 'cancellation_fee', feeCents, result);

  return result;
}

// ── 9. GET ESCROW STATUS ──────────────────────────────────────────────────────
async function getEscrowStatus(booking) {
  if (!booking.provider_escrow_id) {
    return { internal: booking.escrow_state, provider: null, inSync: false };
  }
  const provider = getProvider();
  const statusRes = await provider.getEscrowStatus(booking.provider_escrow_id);
  return { internal: booking.escrow_state, provider: statusRes.status, raw: statusRes.raw };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  STATES, TRANSITIONS, TERMINAL_STATES,
  createJobEscrow, markJobComplete, releaseEscrow, raiseDispute, resolveDispute,
  refundCustomer, cancelEscrow, cancelWithFee, getEscrowStatus,
  casTransition, logEscrowEvent, logTransaction, // exported for the webhook/dispatch/cron paths
};
