'use strict';

/**
 * payments/webhooks.js
 *
 * CheckVault webhook event processor. Route: POST /api/webhooks/checkvault
 * (raw body required for HMAC verification, see payments/routes.js).
 *
 * Signature verification and event-shape normalisation are delegated to the
 * active provider (provider.verifyWebhook / provider.mapWebhookEvent), so
 * this file only deals with Crew's own event -> handler dispatch and is
 * agnostic to CheckVault's exact wire format.
 *
 * CHECKVAULT-SPEC: confirm with partner docs: the real event type names.
 * The ones below (escrow.payment_held, escrow.released, etc.) are
 * placeholders; payments/checkvault-client.js's mapWebhookEvent is where
 * the real event envelope gets normalised into this shape once CheckVault's
 * docs are available, so only that one function needs to change later.
 *
 * Idempotency: every event's provider event ID is stored in webhook_events
 * before processing; a duplicate delivery is detected via the unique
 * constraint and skipped, making every handler safe to retry.
 */

const escrow = require('./escrow');
const { getProvider } = require('./index');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── Idempotency guard ─────────────────────────────────────────────────────────
async function markEventProcessed(supabase, eventId, eventType) {
  const { error } = await supabase.from('webhook_events').insert({
    provider_event_id: eventId, event_type: eventType, processed_at: new Date().toISOString(),
  });
  if (error?.code === '23505') return true; // unique violation: already processed
  if (error) console.error('[Webhook] webhook_events insert error:', error);
  return false;
}

async function getBookingByProviderEscrowId(supabase, providerEscrowId) {
  const { data, error } = await supabase.from('bookings').select('*').eq('provider_escrow_id', providerEscrowId).single();
  if (error || !data) {
    console.warn(`[Webhook] No booking found for provider_escrow_id=${providerEscrowId}`);
    return null;
  }
  return data;
}

// ── Event handlers ─────────────────────────────────────────────────────────────

/** Bank transfer/BPAY cleared, or card payment captured: PAYMENT_PENDING -> PAYMENT_HELD. */
async function onPaymentHeld(supabase, event) {
  const booking = await getBookingByProviderEscrowId(supabase, event.providerEscrowId);
  if (!booking) return;
  if (booking.escrow_state !== escrow.STATES.PAYMENT_PENDING) {
    console.warn(`[Webhook] payment_held: booking ${booking.id} already in state ${booking.escrow_state}`);
    return;
  }

  await escrow.casTransition(supabase, booking.id, escrow.STATES.PAYMENT_PENDING, escrow.STATES.PAYMENT_HELD);
  await escrow.logEscrowEvent(supabase, booking.id, escrow.STATES.PAYMENT_PENDING, escrow.STATES.PAYMENT_HELD, 'webhook:escrow.payment_held', { eventId: event.eventId });

  const { notify } = require('../lib/notify');
  if (booking.customer_id) {
    await notify(booking.customer_id, {
      title: 'Funds secured in trust',
      body: `Your payment for booking ${booking.ref} is held securely with CheckVault.`,
      link: '/portal', type: 'payment',
    }).catch(() => {});
  }
}

/** Provider confirms the release completed. Idempotent: escrow.releaseEscrow
 *  already completes this transition synchronously, so this only covers the
 *  case where CheckVault's real release turns out to be asynchronous. */
async function onReleased(supabase, event) {
  const booking = await getBookingByProviderEscrowId(supabase, event.providerEscrowId);
  if (!booking || booking.escrow_state === escrow.STATES.RELEASED) return;
  if (booking.escrow_state !== escrow.STATES.RELEASING) return;

  await escrow.casTransition(supabase, booking.id, escrow.STATES.RELEASING, escrow.STATES.RELEASED, {
    payment_released_at: new Date().toISOString(),
  });
  await escrow.logEscrowEvent(supabase, booking.id, escrow.STATES.RELEASING, escrow.STATES.RELEASED, 'webhook:escrow.released', { eventId: event.eventId });
}

async function onRefunded(supabase, event) {
  const booking = await getBookingByProviderEscrowId(supabase, event.providerEscrowId);
  if (!booking || escrow.TERMINAL_STATES.has(booking.escrow_state)) return;

  await escrow.casTransition(supabase, booking.id, booking.escrow_state, escrow.STATES.REFUNDED, {
    refunded_at: new Date().toISOString(),
  });
  await escrow.logEscrowEvent(supabase, booking.id, booking.escrow_state, escrow.STATES.REFUNDED, 'webhook:escrow.refunded', { eventId: event.eventId });
}

async function onCancelled(supabase, event) {
  const booking = await getBookingByProviderEscrowId(supabase, event.providerEscrowId);
  if (!booking || escrow.TERMINAL_STATES.has(booking.escrow_state)) return;

  await escrow.casTransition(supabase, booking.id, booking.escrow_state, escrow.STATES.CANCELLED, {
    cancelled_at: new Date().toISOString(),
  });
}

async function onDisputed(supabase, event) {
  const booking = await getBookingByProviderEscrowId(supabase, event.providerEscrowId);
  if (!booking) return;
  const validStates = new Set([escrow.STATES.PAYMENT_HELD, escrow.STATES.DISPUTABLE]);
  if (!validStates.has(booking.escrow_state)) return;

  await escrow.casTransition(supabase, booking.id, booking.escrow_state, escrow.STATES.DISPUTED, {
    disputed_at: new Date().toISOString(),
  });
}

// ── Seller verification events ────────────────────────────────────────────────
async function onSellerVerified(supabase, event) {
  const providerAccountId = event.raw?.data?.seller?.id || event.raw?.data?.id;
  if (!providerAccountId) return;
  await supabase.from('profiles').update({ kyc_status: 'verified', paused: false, paused_reason: null })
    .eq('provider_account_id', providerAccountId);
  await supabase.from('organisations').update({ kyb_status: 'verified' })
    .eq('provider_account_id', providerAccountId);
}

async function onSellerFailed(supabase, event) {
  const providerAccountId = event.raw?.data?.seller?.id || event.raw?.data?.id;
  if (!providerAccountId) return;
  await supabase.from('profiles').update({ kyc_status: 'failed' }).eq('provider_account_id', providerAccountId);
  await supabase.from('organisations').update({ kyb_status: 'failed' }).eq('provider_account_id', providerAccountId);
}

async function onSellerRequiresAction(supabase, event) {
  const providerAccountId = event.raw?.data?.seller?.id || event.raw?.data?.id;
  if (!providerAccountId) return;
  await supabase.from('profiles').update({ kyc_status: 'requires_action' }).eq('provider_account_id', providerAccountId);
  await supabase.from('organisations').update({ kyb_status: 'requires_action' }).eq('provider_account_id', providerAccountId);
}

// ── Event dispatcher ──────────────────────────────────────────────────────────
// CHECKVAULT-SPEC: confirm with partner docs: real event type strings.
const EVENT_HANDLERS = {
  'escrow.payment_held':    onPaymentHeld,
  'escrow.released':        onReleased,
  'escrow.refunded':        onRefunded,
  'escrow.cancelled':       onCancelled,
  'escrow.disputed':        onDisputed,
  'seller.verified':        onSellerVerified,
  'seller.failed':          onSellerFailed,
  'seller.requires_action': onSellerRequiresAction,
};

/**
 * @param {Buffer} rawBody     Raw request body (for signature verification)
 * @param {object} headers     Request headers (lower-cased keys)
 * @param {object} parsedBody  JSON-parsed body
 * @returns {{ processed: boolean, eventType: string, skipped?: boolean }}
 */
async function processEvent(rawBody, headers, parsedBody) {
  const provider = getProvider();

  if (!provider.verifyWebhook(rawBody, headers)) {
    const err = new Error('Webhook signature verification failed');
    err.statusCode = 401;
    throw err;
  }

  const event = provider.mapWebhookEvent(parsedBody);
  if (!event.eventId || !event.eventType) {
    console.warn('[Webhook] Missing event id or type:', parsedBody);
    return { processed: false, eventType: 'unknown' };
  }

  const supabase = getSupabase();

  const alreadyProcessed = await markEventProcessed(supabase, event.eventId, event.eventType);
  if (alreadyProcessed) {
    console.log(`[Webhook] Skipping duplicate event: ${event.eventId} (${event.eventType})`);
    return { processed: false, skipped: true, eventType: event.eventType };
  }

  const handler = EVENT_HANDLERS[event.eventType];
  if (!handler) {
    console.log(`[Webhook] No handler for event type: ${event.eventType}, ignoring`);
    return { processed: false, eventType: event.eventType };
  }

  try {
    await handler(supabase, event);
    console.log(`[Webhook] Processed: ${event.eventType} (${event.eventId})`);
    return { processed: true, eventType: event.eventType };
  } catch (handlerErr) {
    console.error(`[Webhook] Handler failed for ${event.eventType}:`, handlerErr.message);
    await supabase.from('webhook_events')
      .update({ error: handlerErr.message, failed_at: new Date().toISOString() })
      .eq('provider_event_id', event.eventId);
    throw handlerErr;
  }
}

module.exports = { processEvent, EVENT_HANDLERS };
