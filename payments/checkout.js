'use strict';

/**
 * payments/checkout.js
 *
 * Native in-app checkout for Crew — replaces the broken external-tab redirect.
 *
 * Architecture
 * ────────────
 * The frontend uses Zai.js (hosted-fields SDK) to render a PCI-safe card
 * form inside the booking screen.  No card data touches our server or
 * Supabase.  The flow is:
 *
 *   1. Frontend calls POST /api/payments/checkout-session
 *      → backend creates Zai item + returns a short-lived session token
 *
 *   2. Frontend initialises Zai.js with the token
 *      → Zai renders card fields inside the s-book screen (iframe, no redirect)
 *
 *   3. Customer submits → Zai.js tokenises card → calls back with card_token
 *
 *   4. Frontend sends card_token to POST /api/payments/tokenize-card
 *      → backend calls Zai to create a card_account linked to the buyer
 *
 *   5. Frontend calls POST /api/payments/charge
 *      → backend calls escrow.chargeCustomer() with the card_account_id
 *
 * Bank-transfer path (NPP / direct debit)
 * ─────────────────────────────────────────
 *   1. Customer chooses "Pay by Bank Transfer"
 *   2. Frontend calls POST /api/payments/bank-transfer-setup
 *      → backend creates a bank_account record and virtual account number
 *   3. Zai monitors the BSB/account for inbound NPP credit
 *   4. On match → Zai fires webhook → escrow moves to PAYMENT_HELD
 *
 * Required env vars
 * ──────────────────
 *   ZAI_PUBLIC_KEY               Browser-safe key for Zai.js initialisation
 *   ZAI_ENVIRONMENT              'sandbox' | 'production'
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

const zai  = require('./zai-client');
const gst  = require('./gst');
const escrow = require('./escrow');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── 1. CREATE CHECKOUT SESSION ────────────────────────────────────────────────
/**
 * Creates the Zai escrow item for a booking (if not already done) and returns
 * a short-lived hosted-fields token for the browser Zai.js SDK.
 *
 * The token is scoped to the buyer and expires in 15 minutes.
 *
 * @param {object} params
 * @param {string} params.bookingId       Supabase booking UUID
 * @param {string} params.buyerSupabaseId Customer's Supabase user ID
 *
 * @returns {{
 *   sessionToken:    string,   // Pass to Zai.js init()
 *   zaiItemId:       string,
 *   zaiFeeId:        string,
 *   ledger:          object,   // Full GST-itemised ledger for checkout display
 *   expiresAt:       string,   // ISO timestamp
 *   zaiPublicKey:    string,   // ZAI_PUBLIC_KEY for Zai.js
 *   zaiEnvironment:  string,   // 'sandbox' | 'production'
 * }}
 */
async function createCheckoutSession({ bookingId, buyerSupabaseId }) {
  const supabase = getSupabase();

  // ─ Fetch booking + validate ownership ──────────────────────────────────────
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
  if (!booking.buyer_zai_id) {
    const err = new Error('Customer has no Zai account. Complete onboarding first.');
    err.statusCode = 422;
    throw err;
  }

  // ─ Idempotent escrow item creation ─────────────────────────────────────────
  let zaiItemId = booking.zai_item_id;
  let zaiFeeId  = booking.zai_fee_id;
  let ledger    = booking.ledger_json;

  if (!zaiItemId) {
    // Resolve contractor tier
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('role, full_name, zai_user_id')
      .eq('id', booking.contractor_id)
      .single();

    const tier = gst.tierForRole(sellerProfile?.role || 'crew_member');

    const escrowResult = await escrow.createJobEscrow({
      id:           bookingId,
      bookingRef:   booking.booking_ref,
      serviceName:  booking.service_name,
      amountCents:  booking.amount_cents,
      buyerZaiId:   booking.buyer_zai_id,
      sellerZaiId:  sellerProfile?.zai_user_id,
      tier,
      address:      booking.address,
    });

    zaiItemId = escrowResult.zaiItemId;
    zaiFeeId  = escrowResult.zaiFeeId;
    ledger    = escrowResult.ledger;
  }

  // ─ Get hosted-fields token scoped to the buyer ─────────────────────────────
  const tokenRes = await zai.getHostedFieldsToken(booking.buyer_zai_id);
  const sessionToken = tokenRes?.token_auth?.token;
  if (!sessionToken) throw new Error('Could not generate Zai checkout token');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // ─ Store session reference (for validation on charge step) ─────────────────
  await supabase
    .from('bookings')
    .update({
      checkout_session_at: new Date().toISOString(),
      checkout_expires_at: expiresAt,
    })
    .eq('id', bookingId);

  return {
    sessionToken,
    zaiItemId,
    zaiFeeId,
    ledger,
    expiresAt,
    zaiPublicKey:   process.env.ZAI_PUBLIC_KEY,
    zaiEnvironment: process.env.ZAI_ENVIRONMENT || 'sandbox',
  };
}

// ── 2. TOKENISE CARD (receive Zai.js token → create card_account) ─────────────
/**
 * After the customer fills in their card details via Zai.js, the browser
 * receives a one-time card_token.  This endpoint creates a persistent
 * card_account in Zai linked to the buyer, ready for charging.
 *
 * @param {object} params
 * @param {string} params.buyerZaiId    Buyer's Zai user ID
 * @param {string} params.cardToken     Token returned by Zai.js tokenize()
 * @param {boolean} params.saveCard     If true, the card_account is retained for future bookings
 *
 * @returns {{ cardAccountId: string, last4: string, cardType: string }}
 */
async function tokenizeCard({ buyerZaiId, cardToken, saveCard = false }) {
  if (!buyerZaiId || !cardToken) {
    throw new TypeError('buyerZaiId and cardToken are required');
  }

  const res = await zai.createCardAccount({
    user_id:    buyerZaiId,
    token:      cardToken,
    store_card: saveCard,
  });

  const card = res?.card_accounts;
  if (!card?.id) throw new Error('Zai card account creation failed');

  return {
    cardAccountId: card.id,
    last4:         card.number?.slice(-4) || '****',
    cardType:      card.card_type || 'card',
    expiryMonth:   card.expiry_month,
    expiryYear:    card.expiry_year,
  };
}

// ── 3. LIST SAVED PAYMENT METHODS ─────────────────────────────────────────────
/**
 * Returns all card + bank accounts linked to a buyer in Zai.
 * Used to show "Saved cards" in the checkout UI.
 *
 * @param {string} buyerZaiId
 * @returns {{ cards: array, bankAccounts: array }}
 */
async function listPaymentMethods(buyerZaiId) {
  const [cardsRes, banksRes] = await Promise.allSettled([
    zai.listCardAccounts(buyerZaiId),
    zai.listBankAccounts(buyerZaiId),
  ]);

  const cards = (cardsRes.status === 'fulfilled'
    ? cardsRes.value?.card_accounts || []
    : []
  ).map(c => ({
    id:          c.id,
    type:        'card',
    label:       `${c.card_type || 'Card'} ending ****${(c.number || '').slice(-4)}`,
    expiryMonth: c.expiry_month,
    expiryYear:  c.expiry_year,
    active:      c.active,
  }));

  const bankAccounts = (banksRes.status === 'fulfilled'
    ? banksRes.value?.bank_accounts || []
    : []
  ).map(b => ({
    id:          b.id,
    type:        'bank',
    label:       `${b.bank_name || 'Bank'} ****${(b.account_number || '').slice(-3)}`,
    bsb:         b.routing_number,
    active:      b.active,
  }));

  return { cards, bankAccounts };
}

// ── 4. BANK TRANSFER SETUP ────────────────────────────────────────────────────
/**
 * Sets up a direct debit authority for the buyer — used for PayID/NPP
 * bank-transfer payment path.
 *
 * Zai assigns a virtual account (BSB + account number).  The customer
 * transfers funds to this account; Zai reconciles and fires a webhook.
 *
 * @param {object} params
 * @param {string} params.buyerZaiId
 * @param {string} params.accountName      Legal name on bank account
 * @param {string} params.bsb              6-digit BSB (dashes stripped)
 * @param {string} params.accountNumber    Bank account number
 *
 * @returns {{ bankAccountId, virtualBsb, virtualAccountNumber, payId }}
 */
async function createBankTransferAuth({ buyerZaiId, accountName, bsb, accountNumber }) {
  // Normalise BSB: strip dashes/spaces
  const normBsb = String(bsb).replace(/[^0-9]/g, '');
  if (normBsb.length !== 6) throw new RangeError(`Invalid BSB: ${bsb}`);
  if (!accountNumber || accountNumber.length < 5) throw new RangeError(`Invalid account number`);

  const res = await zai.createBankAccount({
    user_id:        buyerZaiId,
    account_name:   accountName,
    routing_number: normBsb,
    account_number: accountNumber,
    account_type:   'savings',  // 'savings' | 'checking'
    country:        'AUS',
    currency:       'AUD',
    holder_type:    'personal', // 'personal' | 'business'
  });

  const bank = res?.bank_accounts;
  if (!bank?.id) throw new Error('Zai bank account creation failed');

  return {
    bankAccountId:          bank.id,
    virtualBsb:             bank.direct_debit_authority?.bsb,
    virtualAccountNumber:   bank.direct_debit_authority?.account_number,
    payId:                  bank.direct_debit_authority?.pay_id,
  };
}

// ── 5. VALIDATE CHECKOUT SESSION EXPIRY ──────────────────────────────────────
/**
 * Guard called before charging — ensures the checkout session hasn't expired.
 * Raises an error if the session is stale (prevents replay attacks).
 *
 * @param {object} booking   Supabase booking row
 */
function assertSessionValid(booking) {
  if (!booking.checkout_expires_at) {
    throw new Error('No active checkout session. Call /checkout-session first.');
  }
  if (new Date(booking.checkout_expires_at) < new Date()) {
    const err = new Error('Checkout session has expired. Please restart checkout.');
    err.statusCode = 410;
    throw err;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  createCheckoutSession,
  tokenizeCard,
  listPaymentMethods,
  createBankTransferAuth,
  assertSessionValid,
};
