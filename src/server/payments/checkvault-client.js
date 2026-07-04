'use strict';

/**
 * payments/checkvault-client.js
 *
 * CheckVault (checkvault.com.au) HTTP adapter, implementing the interface
 * documented in payments/provider.js.
 *
 * CheckVault has no public API documentation at the time this was written,
 * the owner is in onboarding discussions with them. Every endpoint path,
 * payload shape, and field name below is a reasonable placeholder based on
 * how comparable AU escrow/trust-account providers (and the AFSL-regulated
 * escrow model CheckVault advertises) typically structure their APIs, and
 * is isolated in the single ENDPOINTS map below so reconciling against the
 * real partner docs is a one-file change, not a hunt through the codebase.
 * Every such assumption is tagged `// CHECKVAULT-SPEC: confirm with partner docs`.
 *
 * Required env vars:
 *   CHECKVAULT_API_URL       Base URL, e.g. https://api.checkvault.com.au/v1
 *   CHECKVAULT_API_KEY       API key (Bearer token or HMAC key ID depending on AUTH_MODE)
 *   CHECKVAULT_API_SECRET    HMAC signing secret (only used when AUTH_MODE=hmac)
 *   CHECKVAULT_AUTH_MODE     'bearer' | 'hmac'  (default: 'bearer')
 *   CHECKVAULT_WEBHOOK_SECRET  HMAC secret for verifying inbound webhooks
 *   CHECKVAULT_ENVIRONMENT   'mock' | 'test' | 'production'  (payments/index.js
 *                            routes to this adapter only for 'test'/'production';
 *                            'mock' uses checkvault-mock.js instead)
 */

const crypto = require('crypto');
const { PaymentProviderError, redact, logRequest, idempotencyKey, requestWithRetry, verifyHmacSignature } = require('./http-util');

// CHECKVAULT-SPEC: confirm with partner docs: exact base path structure and
// whether it's versioned (/v1) or not.
function getBaseUrl() {
  const url = process.env.CHECKVAULT_API_URL;
  if (!url) throw new Error('CHECKVAULT_API_URL is not set');
  return url.replace(/\/$/, '');
}

function assertLiveCredentials() {
  const env = (process.env.CHECKVAULT_ENVIRONMENT || 'mock').toLowerCase();
  if (env === 'mock') return; // the mock adapter is used instead, see payments/index.js
  const missing = ['CHECKVAULT_API_URL', 'CHECKVAULT_API_KEY'].filter(k => !process.env[k]);
  if (process.env.CHECKVAULT_AUTH_MODE === 'hmac' && !process.env.CHECKVAULT_API_SECRET) {
    missing.push('CHECKVAULT_API_SECRET');
  }
  if (missing.length) {
    // Loud config error, never a fake success, per the ground rules.
    throw new Error(
      `CheckVault is configured for "${env}" but is missing required env vars: ${missing.join(', ')}. ` +
      `Set CHECKVAULT_ENVIRONMENT=mock to use the mock adapter instead while credentials are pending.`
    );
  }
}

// ── Auth header construction ──────────────────────────────────────────────────
// CHECKVAULT-SPEC: confirm with partner docs: Bearer vs HMAC request signing,
// and the exact HMAC canonical-string format (method+path+body+timestamp is
// the common pattern assumed here) if AUTH_MODE=hmac turns out to be required.
function buildAuthHeaders(method, path, bodyStr) {
  const mode = (process.env.CHECKVAULT_AUTH_MODE || 'bearer').toLowerCase();

  if (mode === 'hmac') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const canonical = `${method}\n${path}\n${bodyStr || ''}\n${timestamp}`;
    const signature = crypto.createHmac('sha256', process.env.CHECKVAULT_API_SECRET).update(canonical).digest('hex');
    return {
      'X-CheckVault-Key':       process.env.CHECKVAULT_API_KEY,
      'X-CheckVault-Timestamp': timestamp,
      'X-CheckVault-Signature': signature,
    };
  }

  return { Authorization: `Bearer ${process.env.CHECKVAULT_API_KEY}` };
}

async function request(method, path, body, { bookingId, action } = {}) {
  assertLiveCredentials();
  const bodyStr = body ? JSON.stringify(body) : undefined;

  return requestWithRetry(async () => {
    const start = Date.now();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...buildAuthHeaders(method, path, bodyStr),
    };
    if (bookingId && action) headers['Idempotency-Key'] = idempotencyKey(bookingId, action);

    const res = await fetch(`${getBaseUrl()}${path}`, { method, headers, body: bodyStr });
    const rawText = await res.text();
    let resData;
    try { resData = JSON.parse(rawText); } catch { resData = { raw: rawText }; }

    logRequest('CHECKVAULT_LOG', 'CheckVault', method, path, body, res.status, resData, Date.now() - start);
    return { res, resData };
  });
}

// ── Endpoint path + payload-shape map ─────────────────────────────────────────
// CHECKVAULT-SPEC: confirm with partner docs: every path and field name below.
// Kept in one object deliberately so reconciling against real API docs later
// touches only this map, not the exported functions.
const ENDPOINTS = {
  createSellerAccount: '/sellers',
  sellerStatus:         id => `/sellers/${id}`,
  attachBankAccount:    id => `/sellers/${id}/bank-accounts`,
  createEscrow:         '/escrows',
  escrowStatus:         id => `/escrows/${id}`,
  releaseEscrow:        id => `/escrows/${id}/release`,
  refundEscrow:         id => `/escrows/${id}/refund`,
  raiseDispute:         id => `/escrows/${id}/disputes`,
  resolveDispute:       (id, disputeId) => `/escrows/${id}/disputes/${disputeId}/resolve`,
  cancelEscrow:         id => `/escrows/${id}/cancel`,
};

// ── Seller onboarding ──────────────────────────────────────────────────────────
async function createSellerAccount({ profileId, ...kycFields }) {
  // CHECKVAULT-SPEC: confirm with partner docs: required KYC/KYB fields and
  // their exact names (this assumes a shape similar to other AU KYC providers).
  const res = await request('POST', ENDPOINTS.createSellerAccount, {
    external_reference: profileId,
    ...kycFields,
  }, { bookingId: profileId, action: 'create_seller' });

  return { providerAccountId: res?.id, status: res?.status || 'pending' };
}

async function getSellerStatus(providerAccountId) {
  const res = await request('GET', ENDPOINTS.sellerStatus(providerAccountId));
  // CHECKVAULT-SPEC: confirm with partner docs: the exact status enum values.
  return { status: res?.status || 'pending', detail: res?.status_detail || null };
}

async function attachBankAccount(providerAccountId, { accountName, bsb, accountNumber }) {
  const res = await request('POST', ENDPOINTS.attachBankAccount(providerAccountId), {
    account_name:   accountName,
    bsb:            String(bsb).replace(/[^0-9]/g, ''),
    account_number: accountNumber,
  }, { bookingId: providerAccountId, action: 'attach_bank_account' });

  return { bankAccountId: res?.id };
}

// ── Escrow lifecycle ──────────────────────────────────────────────────────────
async function createEscrow({ bookingId, bookingRef, totalCents, description, buyerProviderId, sellerProviderId }) {
  // CHECKVAULT-SPEC: confirm with partner docs: the exact request/response
  // shape for creating a trust-account escrow and the payment instructions
  // CheckVault returns (bank transfer BSB/account/reference, BPAY biller
  // code/CRN, and/or a hosted card checkout URL if card is enabled).
  const res = await request('POST', ENDPOINTS.createEscrow, {
    external_reference: bookingRef,
    amount_cents:        totalCents,
    currency:            'AUD',
    description,
    buyer_id:            buyerProviderId,
    seller_id:           sellerProviderId,
    card_enabled:        process.env.PAYMENTS_CARD_ENABLED === 'true',
  }, { bookingId, action: 'create_escrow' });

  const instructions = res?.payment_instructions || {};
  return {
    providerEscrowId: res?.id,
    paymentInstructions: {
      method:          instructions.method || 'bank_transfer',
      reference:       instructions.reference || bookingRef,
      bsb:             instructions.bsb,
      accountNumber:   instructions.account_number,
      accountName:     instructions.account_name,
      billerCode:      instructions.biller_code,
      crn:             instructions.crn,
      cardCheckoutUrl: instructions.card_checkout_url,
    },
  };
}

async function getEscrowStatus(providerEscrowId) {
  const res = await request('GET', ENDPOINTS.escrowStatus(providerEscrowId));
  // CHECKVAULT-SPEC: confirm with partner docs: status enum values and how
  // they map onto our internal escrow_state machine (see mapWebhookEvent).
  return { status: res?.status, raw: res };
}

async function releaseEscrow(providerEscrowId, { payoutCents, feeCents }, bookingId) {
  const res = await request('POST', ENDPOINTS.releaseEscrow(providerEscrowId), {
    payout_cents: payoutCents,
    fee_cents:    feeCents,
  }, { bookingId, action: 'release' });

  return { released: true, raw: res };
}

async function partialRefund(providerEscrowId, { refundCents, retainCents, reason }, bookingId) {
  // CHECKVAULT-SPEC: confirm with partner docs: whether CheckVault supports
  // a true partial refund (refund part, retain part as a fee) in one call,
  // or whether this needs to be modelled as refund + separate fee capture.
  // This is required for the cancellation-fee flow (Phase 6); flag loudly to
  // the partner during onboarding if unsupported (see DEPLOY.md).
  const res = await request('POST', ENDPOINTS.refundEscrow(providerEscrowId), {
    refund_cents: refundCents,
    retain_cents: retainCents,
    reason,
  }, { bookingId, action: 'partial_refund' });

  return { refunded: true, raw: res };
}

async function refundEscrow(providerEscrowId, { refundCents, reason }, bookingId) {
  const res = await request('POST', ENDPOINTS.refundEscrow(providerEscrowId), {
    refund_cents: refundCents,
    reason,
  }, { bookingId, action: 'refund' });

  return { refunded: true, raw: res };
}

async function raiseDispute(providerEscrowId, { reason, notes }, bookingId) {
  const res = await request('POST', ENDPOINTS.raiseDispute(providerEscrowId), {
    reason_code: reason,
    notes:       (notes || '').slice(0, 500),
  }, { bookingId, action: 'dispute' });

  return { providerDisputeId: res?.id };
}

async function resolveDispute(providerEscrowId, providerDisputeId, { outcome, notes }) {
  const res = await request('PATCH', ENDPOINTS.resolveDispute(providerEscrowId, providerDisputeId), {
    outcome,
    notes: (notes || '').slice(0, 500),
  });
  return { raw: res };
}

async function cancelEscrow(providerEscrowId, { reason }, bookingId) {
  await request('POST', ENDPOINTS.cancelEscrow(providerEscrowId), { reason }, { bookingId, action: 'cancel' });
  return { cancelled: true };
}

// ── Webhooks ───────────────────────────────────────────────────────────────────
function verifyWebhook(rawBody, headers) {
  // CHECKVAULT-SPEC: confirm with partner docs: the exact header name for
  // the webhook signature (assumed X-CheckVault-Signature).
  const signature = headers['x-checkvault-signature'] || headers['X-CheckVault-Signature'];
  return verifyHmacSignature(rawBody, signature, process.env.CHECKVAULT_WEBHOOK_SECRET);
}

function mapWebhookEvent(parsedBody) {
  // CHECKVAULT-SPEC: confirm with partner docs: the real event envelope
  // shape and event type names. This assumes an envelope similar to
  // { id, type, data: { escrow: { id, status } } }.
  return {
    eventId:          parsedBody?.id,
    eventType:        parsedBody?.type,
    providerEscrowId: parsedBody?.data?.escrow?.id || parsedBody?.data?.id,
    raw:              parsedBody,
  };
}

module.exports = {
  createSellerAccount, getSellerStatus, attachBankAccount,
  createEscrow, getEscrowStatus, releaseEscrow, partialRefund, refundEscrow,
  raiseDispute, resolveDispute, cancelEscrow,
  verifyWebhook, mapWebhookEvent,
  PaymentProviderError,
};
