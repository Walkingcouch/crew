'use strict';

/**
 * payments/checkvault-mock.js
 *
 * In-process mock of the CheckVault provider interface (see provider.js),
 * used when CHECKVAULT_ENVIRONMENT=mock. Lets the entire escrow lifecycle,
 * checkout, and invoice flow be built and demoed before real CheckVault
 * credentials arrive.
 *
 * Escrow state itself lives in bookings.escrow_state (owned by escrow.js's
 * CAS transitions, exactly as it will with the real provider). This module
 * only tracks the one piece of state the real CheckVault would hold that we
 * don't: whether a bank-transfer/BPAY payment has actually "cleared" yet,
 * simulated via POST /api/payments/mock/clear-funds instead of a real
 * incoming bank transfer. That map is process-local and intentionally
 * resets on restart, this is a development aid, not a source of truth.
 */

const crypto = require('crypto');

const _mockEscrows = new Map(); // providerEscrowId -> { status, bookingId, totalCents, reference }

function generateReference() {
  const digits = crypto.randomInt(100000, 999999);
  return `CRW-${digits}`;
}

function fakeBsbAndAccount(seed) {
  // Deterministic-looking but clearly fake BSB/account for demo purposes.
  const hash = crypto.createHash('sha256').update(String(seed)).digest('hex');
  const bsb = `06${hash.slice(0, 2)}`.slice(0, 6).padEnd(6, '0');
  const account = parseInt(hash.slice(2, 10), 16).toString().slice(0, 9).padStart(9, '0');
  return { bsb, account };
}

// ── Seller onboarding ──────────────────────────────────────────────────────────
async function createSellerAccount({ profileId }) {
  return { providerAccountId: `mock_seller_${profileId}`, status: 'verified' };
}

async function getSellerStatus(providerAccountId) {
  return { status: 'verified', detail: `Mock account ${providerAccountId} is auto-verified in mock mode` };
}

async function attachBankAccount(providerAccountId) {
  return { bankAccountId: `mock_bank_${providerAccountId}` };
}

// ── Escrow lifecycle ──────────────────────────────────────────────────────────
async function createEscrow({ bookingId, bookingRef, totalCents }) {
  const providerEscrowId = `mock_esc_${bookingId}`;
  const reference = bookingRef || generateReference();
  const { bsb, account } = fakeBsbAndAccount(bookingId);

  _mockEscrows.set(providerEscrowId, {
    status: 'pending',
    bookingId,
    totalCents,
    reference,
  });

  const cardEnabled = process.env.PAYMENTS_CARD_ENABLED === 'true';

  return {
    providerEscrowId,
    paymentInstructions: {
      method: cardEnabled ? 'card' : 'bank_transfer',
      reference,
      bsb,
      accountNumber: account,
      accountName: 'Crew Trust Account (Mock)',
      billerCode: '123456',
      crn: reference.replace('CRW-', ''),
      cardCheckoutUrl: cardEnabled ? `/mock-card-checkout?ref=${reference}` : undefined,
    },
  };
}

async function getEscrowStatus(providerEscrowId) {
  const record = _mockEscrows.get(providerEscrowId);
  if (!record) return { status: 'unknown', raw: null };
  return { status: record.status, raw: record };
}

async function releaseEscrow(providerEscrowId, { payoutCents, feeCents }) {
  const record = _mockEscrows.get(providerEscrowId);
  if (record) record.status = 'released';
  return { released: true, raw: { providerEscrowId, payoutCents, feeCents } };
}

async function partialRefund(providerEscrowId, { refundCents, retainCents, reason }) {
  const record = _mockEscrows.get(providerEscrowId);
  if (record) record.status = 'partially_refunded';
  return { refunded: true, raw: { providerEscrowId, refundCents, retainCents, reason } };
}

async function refundEscrow(providerEscrowId, { refundCents, reason }) {
  const record = _mockEscrows.get(providerEscrowId);
  if (record) record.status = 'refunded';
  return { refunded: true, raw: { providerEscrowId, refundCents, reason } };
}

async function raiseDispute(providerEscrowId, { reason }) {
  const record = _mockEscrows.get(providerEscrowId);
  if (record) record.status = 'disputed';
  return { providerDisputeId: `mock_dispute_${providerEscrowId}`, reason };
}

async function resolveDispute(providerEscrowId, providerDisputeId, { outcome }) {
  return { raw: { providerEscrowId, providerDisputeId, outcome } };
}

async function cancelEscrow(providerEscrowId) {
  const record = _mockEscrows.get(providerEscrowId);
  if (record) record.status = 'cancelled';
  return { cancelled: true };
}

// ── Mock-only: simulate a bank transfer / BPAY payment clearing ──────────────
// Called by POST /api/payments/mock/clear-funds (mock mode only). Marks the
// mock escrow as funded and returns a webhook-shaped event so the caller can
// feed it through the same event dispatcher a real webhook would use.
function simulateClearance(providerEscrowId) {
  const record = _mockEscrows.get(providerEscrowId);
  if (!record) {
    const err = new Error(`No mock escrow found for ${providerEscrowId}. Create a booking and checkout session first.`);
    err.statusCode = 404;
    throw err;
  }
  record.status = 'held';
  return {
    id: `mock_evt_${Date.now()}`,
    type: 'escrow.payment_held',
    data: { escrow: { id: providerEscrowId, status: 'held' } },
  };
}

// ── Webhooks (not used directly in mock mode, but implemented so switching
//    CHECKVAULT_ENVIRONMENT doesn't require code changes elsewhere) ─────────
function verifyWebhook() {
  return true; // mock mode has no real inbound webhooks to verify
}

function mapWebhookEvent(parsedBody) {
  return {
    eventId: parsedBody?.id,
    eventType: parsedBody?.type,
    providerEscrowId: parsedBody?.data?.escrow?.id,
    raw: parsedBody,
  };
}

module.exports = {
  createSellerAccount, getSellerStatus, attachBankAccount,
  createEscrow, getEscrowStatus, releaseEscrow, partialRefund, refundEscrow,
  raiseDispute, resolveDispute, cancelEscrow,
  verifyWebhook, mapWebhookEvent,
  simulateClearance,
};
