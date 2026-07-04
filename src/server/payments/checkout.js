'use strict';

/**
 * payments/checkout.js
 *
 * Checkout for Crew, against CheckVault escrow.
 *
 * Unlike the old Zai hosted-fields flow, CheckVault has no card-tokenisation
 * SDK to initialise client-side and the customer never registers their own
 * bank account with the provider. The flow is simply:
 *
 *   1. Frontend calls POST /api/payments/checkout-session
 *      -> backend creates the CheckVault escrow (idempotent) and returns
 *         paymentInstructions: bank transfer BSB/account/reference, BPAY
 *         biller code/CRN, and/or a card checkout URL if
 *         PAYMENTS_CARD_ENABLED=true.
 *   2. The customer pays using whichever method they choose, outside our
 *      app for bank transfer/BPAY (1 to 2 business days to clear), or via
 *      the card checkout URL if enabled.
 *   3. A webhook (or, in mock mode, POST /api/payments/mock/clear-funds)
 *      moves the booking from PAYMENT_PENDING to PAYMENT_HELD.
 *
 * Required env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (CheckVault's
 * own credentials are read directly by payments/checkvault-client.js).
 */

const gst    = require('./gst');
const escrow = require('./escrow');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── CREATE CHECKOUT SESSION ───────────────────────────────────────────────────
/**
 * Idempotently creates the CheckVault escrow for a booking (if not already
 * done) and returns the payment instructions for display.
 *
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.buyerSupabaseId  Customer's Supabase user ID (must own the booking)
 *
 * @returns {{ providerEscrowId, paymentInstructions, ledger, cardEnabled }}
 */
async function createCheckoutSession({ bookingId, buyerSupabaseId }) {
  const supabase = getSupabase();

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('customer_id', buyerSupabaseId)
    .single();

  if (bErr || !booking) {
    const err = new Error('Booking not found or access denied');
    err.statusCode = 404;
    throw err;
  }

  if (booking.pricing_mode === 'quoted' && !booking.contractor_id) {
    const err = new Error('This booking is awaiting a quote acceptance before checkout can start.');
    err.statusCode = 422;
    throw err;
  }

  // Already created: idempotent, just re-fetch and return the same instructions.
  if (booking.provider_escrow_id) {
    return {
      providerEscrowId: booking.provider_escrow_id,
      paymentInstructions: {
        method: booking.payment_method,
        reference: booking.payment_reference,
      },
      ledger: booking.ledger_json,
      cardEnabled: process.env.PAYMENTS_CARD_ENABLED === 'true',
    };
  }

  const { data: customerProfile } = await supabase
    .from('profiles').select('provider_account_id').eq('id', buyerSupabaseId).single();
  const { data: sellerProfile } = await supabase
    .from('profiles').select('role, full_name, provider_account_id').eq('id', booking.contractor_id).single();

  const tier = gst.tierForRole(sellerProfile?.role || 'crew_member');

  const result = await escrow.createJobEscrow({
    id: bookingId,
    bookingRef: booking.ref,
    serviceName: booking.service_name || booking.service_type,
    amountCents: booking.total_cents,
    buyerProviderId: customerProfile?.provider_account_id,
    sellerProviderId: sellerProfile?.provider_account_id,
    tier,
    address: booking.address,
  });

  return {
    providerEscrowId: result.providerEscrowId,
    paymentInstructions: result.paymentInstructions,
    ledger: result.ledger,
    cardEnabled: process.env.PAYMENTS_CARD_ENABLED === 'true',
  };
}

module.exports = { createCheckoutSession };
