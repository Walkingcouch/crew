'use strict';

/**
 * payments/provider.js
 *
 * The internal payment provider interface every adapter (checkvault-client.js,
 * checkvault-mock.js, and any future provider) must implement. All money
 * amounts are integer cents. Every method is async and idempotent for a
 * given (bookingId, action) pair, so a retried call after a network timeout
 * never double-charges or double-releases.
 *
 * This file has no logic of its own beyond documenting the contract and a
 * small runtime check used by payments/index.js to catch a misconfigured
 * adapter early (missing a method) rather than failing confusingly deep in
 * a request handler.
 *
 * ── Method contract ──────────────────────────────────────────────────────────
 *
 * createSellerAccount({ profileId, ...kycFields })
 *   -> { providerAccountId, status }
 *   Onboards a contractor (sole trader) or organisation (enterprise) as a
 *   seller able to receive escrow releases.
 *
 * getSellerStatus(providerAccountId)
 *   -> { status: 'pending'|'requires_action'|'verified'|'failed', detail }
 *
 * attachBankAccount(providerAccountId, { accountName, bsb, accountNumber })
 *   -> { bankAccountId }
 *   The account funds are disbursed to on release.
 *
 * createEscrow({ bookingId, bookingRef, totalCents, description, buyerProviderId, sellerProviderId })
 *   -> { providerEscrowId, paymentInstructions: {
 *          method: 'bank_transfer'|'bpay'|'card',
 *          reference,             // the CRW-XXXXXX reference the customer must quote
 *          bsb?, accountNumber?, accountName?,   // bank_transfer
 *          billerCode?, crn?,                    // bpay
 *          cardCheckoutUrl?,                     // card, only if PAYMENTS_CARD_ENABLED
 *        } }
 *
 * getEscrowStatus(providerEscrowId)
 *   -> { status, raw }
 *
 * releaseEscrow(providerEscrowId, { payoutCents, feeCents }, bookingId)
 *   -> { released: true, raw }
 *   Split release: payoutCents to the seller, feeCents to Crew's platform account.
 *
 * partialRefund(providerEscrowId, { refundCents, retainCents, reason }, bookingId)
 *   -> { refunded: true, raw }
 *   Needed for cancellation fees: refunds refundCents to the buyer, retains
 *   retainCents (the fee) in Crew's account.
 *
 * refundEscrow(providerEscrowId, { refundCents, reason }, bookingId)
 *   -> { refunded: true, raw }
 *   Full or partial refund with nothing retained (dispute-resolution refunds).
 *
 * raiseDispute(providerEscrowId, { reason, notes }, bookingId)
 *   -> { providerDisputeId }
 *
 * resolveDispute(providerEscrowId, providerDisputeId, { outcome, notes })
 *   -> { raw }
 *
 * cancelEscrow(providerEscrowId, { reason }, bookingId)
 *   -> { cancelled: true }
 *   Only valid before funds have been captured (CREATED/PAYMENT_PENDING).
 *
 * verifyWebhook(rawBody, headers)
 *   -> boolean
 *
 * mapWebhookEvent(parsedBody)
 *   -> { eventId, eventType, providerEscrowId, raw }
 *   Normalises a provider-specific webhook payload into the shape
 *   payments/webhooks.js expects, so the event dispatcher never needs to
 *   know which provider fired it.
 */

const REQUIRED_METHODS = [
  'createSellerAccount', 'getSellerStatus', 'attachBankAccount',
  'createEscrow', 'getEscrowStatus', 'releaseEscrow', 'partialRefund',
  'refundEscrow', 'raiseDispute', 'resolveDispute', 'cancelEscrow',
  'verifyWebhook', 'mapWebhookEvent',
];

/**
 * Throws with a clear, specific message if an adapter is missing a required
 * method, instead of failing later with a cryptic "X is not a function".
 */
function assertImplementsProvider(adapter, adapterName) {
  const missing = REQUIRED_METHODS.filter(m => typeof adapter[m] !== 'function');
  if (missing.length) {
    throw new Error(`${adapterName} does not implement the provider interface: missing ${missing.join(', ')}`);
  }
  return adapter;
}

module.exports = { REQUIRED_METHODS, assertImplementsProvider };
