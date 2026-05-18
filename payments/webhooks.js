'use strict';

/**
 * payments/webhooks.js
 *
 * Zai webhook event processor.
 *
 * Security model
 * ──────────────
 * Zai signs every webhook with HMAC-SHA256 of the raw request body,
 * keyed with ZAI_WEBHOOK_SECRET.  The signature arrives in the
 * "X-Zai-Signature" header.
 *
 * We use crypto.timingSafeEqual() to prevent timing-oracle attacks.
 * The raw body is captured before Express JSON parsing (raw-body middleware
 * must be applied to the webhook route — see routes.js).
 *
 * Idempotency
 * ────────────
 * Zai may deliver the same event more than once.  We store every
 * processed event ID in the Supabase webhook_events table and skip
 * duplicates.  Each handler is therefore safe to retry.
 *
 * Event → handler map
 * ────────────────────
 *  items.payment_deposited     → onPaymentDeposited     (PAYMENT_PENDING → PAYMENT_HELD)
 *  items.complete              → onItemComplete         (RELEASING → RELEASED)
 *  items.refunded              → onItemRefunded         (any → REFUNDED)
 *  items.cancelled             → onItemCancelled        (any → CANCELLED)
 *  items.disputed              → onItemDisputed         (DISPUTABLE → DISPUTED)
 *  disbursements.success       → onDisbursementSuccess  (informational, update tx log)
 *  disbursements.failure       → onDisbursementFailure  (alert + retry)
 *  users.verification_passed   → onVerificationPassed   (update KYC status)
 *  users.verification_failed   → onVerificationFailed   (update KYC status)
 *  users.verification_required → onVerificationRequired (update KYC status)
 *
 * Required env vars
 * ──────────────────
 *   ZAI_WEBHOOK_SECRET
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

const crypto = require('crypto');
const escrow  = require('./escrow');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── Signature verification ────────────────────────────────────────────────────
/**
 * Verify the HMAC-SHA256 signature from Zai.
 *
 * @param {Buffer|string} rawBody    Raw request body (before JSON.parse)
 * @param {string}        signature  Value of the X-Zai-Signature header
 * @returns {boolean}
 */
function verifySignature(rawBody, signature) {
  const secret = process.env.ZAI_WEBHOOK_SECRET;
  if (!secret) throw new Error('ZAI_WEBHOOK_SECRET env var is not set');
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');

  const expectedBuf = Buffer.from(expected,   'hex');
  const actualBuf   = Buffer.from(signature,  'hex');

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// ── Idempotency guard ─────────────────────────────────────────────────────────
/**
 * Returns true if this eventId has already been processed.
 * Inserts the event ID atomically — concurrent deliveries will have one
 * succeed and the other get a unique-violation → treated as already processed.
 *
 * @param {object} supabase
 * @param {string} eventId
 * @param {string} eventType
 * @returns {boolean} alreadyProcessed
 */
async function markEventProcessed(supabase, eventId, eventType) {
  const { error } = await supabase
    .from('webhook_events')
    .insert({
      zai_event_id: eventId,
      event_type:   eventType,
      processed_at: new Date().toISOString(),
    });

  // Unique constraint violation → event already processed
  if (error?.code === '23505') return true;
  if (error) {
    console.error('[Webhook] webhook_events insert error:', error);
    // Don't throw — if the idempotency table fails, process anyway and log
  }
  return false;
}

// ── Booking lookup helper ─────────────────────────────────────────────────────
async function getBookingByZaiItemId(supabase, zaiItemId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('zai_item_id', zaiItemId)
    .single();

  if (error || !data) {
    console.warn(`[Webhook] No booking found for zai_item_id=${zaiItemId}`);
    return null;
  }
  return data;
}

// ── Item event handlers ───────────────────────────────────────────────────────

/**
 * Funds captured in escrow — advance from PAYMENT_PENDING → PAYMENT_HELD.
 * Fires after a card charge or bank transfer clears.
 */
async function onPaymentDeposited(supabase, event) {
  const zaiItemId = event?.items?.id || event?.object?.id;
  const booking   = await getBookingByZaiItemId(supabase, zaiItemId);
  if (!booking) return;

  if (booking.escrow_state !== escrow.STATES.PAYMENT_PENDING) {
    console.warn(`[Webhook] payment_deposited: booking ${booking.id} already in state ${booking.escrow_state}`);
    return;
  }

  await supabase
    .from('bookings')
    .update({ escrow_state: escrow.STATES.PAYMENT_HELD })
    .eq('id', booking.id);

  await supabase.from('escrow_events').insert({
    booking_id: booking.id,
    from_state: escrow.STATES.PAYMENT_PENDING,
    to_state:   escrow.STATES.PAYMENT_HELD,
    trigger:    'webhook:payment_deposited',
    metadata:   { zaiEventId: event.id, zaiItemId },
    ts: new Date().toISOString(),
  });

  await supabase.from('transactions').insert({
    booking_id:   booking.id,
    type:         'PAYMENT_CAPTURED',
    amount_cents: event?.items?.amount || booking.amount_cents,
    zai_response: event,
    ts: new Date().toISOString(),
  });

  console.log(`[Webhook] Payment held in escrow for booking ${booking.id}`);
}

/**
 * Escrow released — Zai has split and disbursed funds.
 * Advance from RELEASING → RELEASED.
 */
async function onItemComplete(supabase, event) {
  const zaiItemId = event?.items?.id || event?.object?.id;
  const booking   = await getBookingByZaiItemId(supabase, zaiItemId);
  if (!booking) return;

  await supabase
    .from('bookings')
    .update({
      escrow_state:      escrow.STATES.RELEASED,
      payment_released_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  await supabase.from('escrow_events').insert({
    booking_id: booking.id,
    from_state: escrow.STATES.RELEASING,
    to_state:   escrow.STATES.RELEASED,
    trigger:    'webhook:items.complete',
    metadata:   { zaiEventId: event.id },
    ts: new Date().toISOString(),
  });

  await supabase.from('transactions').insert({
    booking_id:   booking.id,
    type:         'ESCROW_RELEASED',
    amount_cents: event?.items?.amount || booking.amount_cents,
    zai_response: event,
    ts: new Date().toISOString(),
  });

  console.log(`[Webhook] Escrow released for booking ${booking.id}`);
}

/**
 * Item refunded — mark booking REFUNDED, record transaction.
 */
async function onItemRefunded(supabase, event) {
  const zaiItemId = event?.items?.id || event?.object?.id;
  const booking   = await getBookingByZaiItemId(supabase, zaiItemId);
  if (!booking) return;

  const refundAmount = event?.items?.refunded_amount || event?.refund?.amount || 0;

  await supabase
    .from('bookings')
    .update({
      escrow_state:  escrow.STATES.REFUNDED,
      refunded_at:   new Date().toISOString(),
      refund_amount: refundAmount,
    })
    .eq('id', booking.id);

  await supabase.from('transactions').insert({
    booking_id:   booking.id,
    type:         'REFUND_CONFIRMED',
    amount_cents: refundAmount,
    zai_response: event,
    ts: new Date().toISOString(),
  });
}

/**
 * Item cancelled in Zai.
 */
async function onItemCancelled(supabase, event) {
  const zaiItemId = event?.items?.id || event?.object?.id;
  const booking   = await getBookingByZaiItemId(supabase, zaiItemId);
  if (!booking) return;

  if (escrow.TERMINAL_STATES.has(booking.escrow_state)) return;

  await supabase
    .from('bookings')
    .update({ escrow_state: escrow.STATES.CANCELLED, cancelled_at: new Date().toISOString() })
    .eq('id', booking.id);
}

/**
 * Dispute raised via Zai (e.g., through Zai's dispute portal).
 * Syncs state to DISPUTED if booking is in DISPUTABLE.
 */
async function onItemDisputed(supabase, event) {
  const zaiItemId = event?.items?.id || event?.object?.id;
  const booking   = await getBookingByZaiItemId(supabase, zaiItemId);
  if (!booking) return;

  const validDisputeStates = new Set([
    escrow.STATES.PAYMENT_HELD,
    escrow.STATES.DISPUTABLE,
  ]);
  if (!validDisputeStates.has(booking.escrow_state)) return;

  await supabase
    .from('bookings')
    .update({
      escrow_state:   escrow.STATES.DISPUTED,
      disputed_at:    new Date().toISOString(),
      zai_dispute_id: event?.disputes?.id,
    })
    .eq('id', booking.id);
}

// ── Disbursement event handlers ────────────────────────────────────────────────

async function onDisbursementSuccess(supabase, event) {
  const disbId = event?.disbursements?.id || event?.object?.id;
  await supabase.from('transactions').insert({
    booking_id:   null,   // disbursements don't always carry booking context
    type:         'DISBURSEMENT_SUCCESS',
    amount_cents: event?.disbursements?.amount || 0,
    zai_response: event,
    ts: new Date().toISOString(),
  });
  console.log(`[Webhook] Disbursement success: ${disbId}`);
}

async function onDisbursementFailure(supabase, event) {
  const disbId = event?.disbursements?.id;
  const reason = event?.disbursements?.failure_reason || 'unknown';
  console.error(`[Webhook] Disbursement FAILED: ${disbId} — reason: ${reason}`);

  await supabase.from('transactions').insert({
    booking_id:   null,
    type:         'DISBURSEMENT_FAILED',
    amount_cents: event?.disbursements?.amount || 0,
    zai_response: event,
    ts: new Date().toISOString(),
  });

  // TODO: trigger admin alert (Resend email / Slack webhook)
}

// ── User KYC/KYB event handlers ────────────────────────────────────────────────

async function onVerificationPassed(supabase, event) {
  const zaiUserId = event?.users?.id || event?.object?.id;
  if (!zaiUserId) return;

  const { onboarding } = require('./onboarding');

  // Update both profiles and organisations tables
  await supabase
    .from('profiles')
    .update({ zai_kyc_status: 'VERIFIED' })
    .eq('zai_user_id', zaiUserId);

  await supabase
    .from('organisations')
    .update({ zai_kyb_status: 'VERIFIED' })
    .eq('zai_company_user_id', zaiUserId);

  console.log(`[Webhook] KYC/KYB passed for Zai user: ${zaiUserId}`);
}

async function onVerificationFailed(supabase, event) {
  const zaiUserId = event?.users?.id || event?.object?.id;
  if (!zaiUserId) return;

  const reason = event?.users?.verification_failure_reason || 'unspecified';

  await supabase
    .from('profiles')
    .update({ zai_kyc_status: 'FAILED', zai_kyc_fail_reason: reason })
    .eq('zai_user_id', zaiUserId);

  await supabase
    .from('organisations')
    .update({ zai_kyb_status: 'FAILED', zai_kyb_fail_reason: reason })
    .eq('zai_company_user_id', zaiUserId);

  console.error(`[Webhook] KYC/KYB FAILED for Zai user: ${zaiUserId} — ${reason}`);
}

async function onVerificationRequired(supabase, event) {
  const zaiUserId = event?.users?.id || event?.object?.id;
  if (!zaiUserId) return;

  await supabase
    .from('profiles')
    .update({ zai_kyc_status: 'REQUIRES_ACTION' })
    .eq('zai_user_id', zaiUserId);

  await supabase
    .from('organisations')
    .update({ zai_kyb_status: 'REQUIRES_ACTION' })
    .eq('zai_company_user_id', zaiUserId);
}

// ── Event dispatcher ──────────────────────────────────────────────────────────
const EVENT_HANDLERS = {
  'items.payment_deposited':      onPaymentDeposited,
  'items.complete':               onItemComplete,
  'items.refunded':               onItemRefunded,
  'items.cancelled':              onItemCancelled,
  'items.disputed':               onItemDisputed,
  'disbursements.success':        onDisbursementSuccess,
  'disbursements.failure':        onDisbursementFailure,
  'users.verification_passed':    onVerificationPassed,
  'users.verification_failed':    onVerificationFailed,
  'users.verification_required':  onVerificationRequired,
};

/**
 * Main entry point called by the webhook route handler.
 *
 * @param {Buffer}  rawBody     Raw request body (for signature verification)
 * @param {string}  signature   X-Zai-Signature header value
 * @param {object}  parsedBody  JSON-parsed body (Zai event object)
 *
 * @returns {{ processed: boolean, eventType: string, skipped?: boolean }}
 */
async function processEvent(rawBody, signature, parsedBody) {
  // ─ 1. Verify signature ──────────────────────────────────────────────────────
  if (!verifySignature(rawBody, signature)) {
    const err = new Error('Webhook signature verification failed');
    err.statusCode = 401;
    throw err;
  }

  const eventId   = parsedBody?.id || parsedBody?.event_id;
  const eventType = parsedBody?.type || parsedBody?.event_type;

  if (!eventId || !eventType) {
    console.warn('[Webhook] Missing event id or type:', parsedBody);
    return { processed: false, eventType: 'unknown' };
  }

  const supabase = getSupabase();

  // ─ 2. Idempotency check ─────────────────────────────────────────────────────
  const alreadyProcessed = await markEventProcessed(supabase, eventId, eventType);
  if (alreadyProcessed) {
    console.log(`[Webhook] Skipping duplicate event: ${eventId} (${eventType})`);
    return { processed: false, skipped: true, eventType };
  }

  // ─ 3. Dispatch to handler ───────────────────────────────────────────────────
  const handler = EVENT_HANDLERS[eventType];
  if (!handler) {
    console.log(`[Webhook] No handler for event type: ${eventType} — ignoring`);
    return { processed: false, eventType };
  }

  try {
    await handler(supabase, parsedBody);
    console.log(`[Webhook] Processed: ${eventType} (${eventId})`);
    return { processed: true, eventType };
  } catch (handlerErr) {
    // Log error and mark event as failed so it can be replayed manually
    console.error(`[Webhook] Handler failed for ${eventType}:`, handlerErr.message);
    await supabase
      .from('webhook_events')
      .update({ error: handlerErr.message, failed_at: new Date().toISOString() })
      .eq('zai_event_id', eventId);
    throw handlerErr;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  verifySignature,
  processEvent,
  EVENT_HANDLERS,  // exported for testing
};
