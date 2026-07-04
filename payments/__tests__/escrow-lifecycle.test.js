'use strict';

/**
 * payments/__tests__/escrow-lifecycle.test.js
 *
 * Exercises the full escrow lifecycle against the CheckVault mock provider
 * and an in-memory fake Supabase client (see fake-supabase.js): no live
 * database or network access is required, so this runs anywhere via
 * `npm run test:payments` / `node --test`.
 */

process.env.SUPABASE_URL = 'http://fake.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
process.env.CHECKVAULT_ENVIRONMENT = 'mock';

const test = require('node:test');
const assert = require('node:assert/strict');

const { installFakeSupabase } = require('./fake-supabase');
const store = installFakeSupabase();

const escrow = require('../escrow');
const gst = require('../gst');
const webhooks = require('../webhooks');
const { getProvider } = require('../index');

async function makeBooking(overrides = {}) {
  const id = overrides.id || 'bk_' + Math.random().toString(36).slice(2);
  const row = {
    id,
    ref: 'BK-2026-' + id.slice(-5),
    customer_id: 'cust_1',
    contractor_id: 'contractor_1',
    total_cents: 11000,
    amount_cents: 11000, // some code paths read amount_cents
    service_type: 'Lawn Mowing',
    service_name: 'Standard Lawn Mow',
    scheduled_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    escrow_state: 'CREATED',
    ...overrides,
  };
  await store.from('bookings').insert(row); // the builder is thenable, awaiting it runs exec()
  return row;
}

function getBooking(id) {
  return store._tables.get('bookings').find(b => b.id === id);
}

test('create -> instructions -> clear -> held -> complete -> approve -> release, with correct GST split and invoices', async () => {
  const booking = await makeBooking();

  const result = await escrow.createJobEscrow({
    id: booking.id, bookingRef: booking.ref, serviceName: booking.service_name,
    amountCents: booking.total_cents, buyerProviderId: 'buyer_p', sellerProviderId: 'seller_p', tier: 'standard',
    address: '1 Test St',
  });

  assert.ok(result.providerEscrowId, 'providerEscrowId should be returned');
  assert.equal(result.paymentInstructions.reference, booking.ref, 'reference should match the bookingRef');
  assert.equal(getBooking(booking.id).escrow_state, 'PAYMENT_PENDING');

  // Simulate the bank transfer clearing (mock mode).
  const provider = getProvider();
  const mockEvent = provider.simulateClearance(result.providerEscrowId);
  const dispatchResult = await webhooks.processEvent(Buffer.from(JSON.stringify(mockEvent)), {}, mockEvent);
  assert.equal(dispatchResult.processed, true);
  assert.equal(getBooking(booking.id).escrow_state, 'PAYMENT_HELD');

  // Contractor marks the job complete.
  await escrow.markJobComplete(getBooking(booking.id), 'contractor_1');
  assert.equal(getBooking(booking.id).escrow_state, 'DISPUTABLE');

  // Customer approves early release.
  await escrow.releaseEscrow(getBooking(booking.id), 'customer_approved');
  const released = getBooking(booking.id);
  assert.equal(released.escrow_state, 'RELEASED');

  // GST/commission split must balance to the cent.
  const ledger = released.ledger_json;
  gst.assertLedgerValid(ledger); // throws if unbalanced

  // Invoices: one per party, created and idempotent.
  const invoices = store._tables.get('invoices').filter(i => i.booking_id === booking.id);
  assert.equal(invoices.length, 2, 'expected one invoice per party');
  assert.ok(invoices.every(i => i.invoice_number.startsWith('CRW-INV-')));

  // Calling release-time invoice generation again must not create duplicates
  // (UNIQUE(booking_id, recipient) enforced by the fake store too).
  const { generateInvoicesForBooking } = require('../../lib/invoices');
  await generateInvoicesForBooking(released);
  const invoicesAfter = store._tables.get('invoices').filter(i => i.booking_id === booking.id);
  assert.equal(invoicesAfter.length, 2, 'invoice generation must be idempotent');
});

test('dispute -> admin resolves as refund', async () => {
  const booking = await makeBooking({ escrow_state: 'PAYMENT_HELD', provider_escrow_id: 'mock_esc_dispute_test' });

  await escrow.raiseDispute(booking, 'INCOMPLETE_WORK', 'cust_1', 'Job was not finished');
  assert.equal(getBooking(booking.id).escrow_state, 'DISPUTED');

  await escrow.resolveDispute(getBooking(booking.id), 'refund', 'admin_1', 'Confirmed incomplete');
  assert.equal(getBooking(booking.id).escrow_state, 'REFUNDED');
});

test('cancel-early: more than 2 hours before start, no fee, full refund', async () => {
  const scheduledAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString(); // 6 hours out
  const booking = await makeBooking({ escrow_state: 'PAYMENT_HELD', scheduled_at: scheduledAt, provider_escrow_id: 'mock_esc_cancel_early' });

  const calc = gst.calcLateCancellationFee(booking.total_cents, booking.scheduled_at);
  assert.equal(calc.isLate, false);
  assert.equal(calc.feeCents, 0);
  assert.equal(calc.refundCents, booking.total_cents);

  await escrow.cancelWithFee(booking, calc.feeCents, calc.refundCents, 'Change of plans');
  const cancelled = getBooking(booking.id);
  assert.equal(cancelled.escrow_state, 'CANCELLED');
  assert.equal(cancelled.cancellation_fee_cents, 0);
});

test('cancel-late: 2 hours or less before start, 25% fee, partial refund, ledger balances', async () => {
  const scheduledAt = new Date(Date.now() + 1 * 3600 * 1000).toISOString(); // 1 hour out
  const booking = await makeBooking({ escrow_state: 'DISPUTABLE', scheduled_at: scheduledAt, total_cents: 20000, provider_escrow_id: 'mock_esc_cancel_late' });

  const calc = gst.calcLateCancellationFee(booking.total_cents, booking.scheduled_at);
  assert.equal(calc.isLate, true);
  assert.equal(calc.feeCents, 5000, '25% of 20000 = 5000');
  assert.equal(calc.refundCents, 15000);
  assert.equal(calc.feeCents + calc.refundCents, booking.total_cents, 'fee + refund must equal the original total');

  await escrow.cancelWithFee(booking, calc.feeCents, calc.refundCents, 'Late cancellation');
  const cancelled = getBooking(booking.id);
  assert.equal(cancelled.escrow_state, 'CANCELLED');
  assert.equal(cancelled.cancellation_fee_cents, 5000);

  const transactions = store._tables.get('transactions').filter(t => t.booking_id === booking.id);
  const feeTx = transactions.find(t => t.type === 'cancellation_fee');
  const refundTx = transactions.find(t => t.type === 'refund');
  assert.ok(feeTx && feeTx.amount_cents === 5000);
  assert.ok(refundTx && refundTx.amount_cents === 15000);
});

test('CAS conflict: a second release attempt on an already-releasing booking returns 409', async () => {
  const booking = await makeBooking({ escrow_state: 'DISPUTABLE', provider_escrow_id: 'mock_esc_cas_test' });

  // First release claims RELEASING then completes to RELEASED.
  await escrow.releaseEscrow(getBooking(booking.id), 'auto');
  assert.equal(getBooking(booking.id).escrow_state, 'RELEASED');

  // A second call against the now-stale in-memory `booking` object (still
  // says DISPUTABLE) must be rejected by the CAS guard, not silently re-run.
  await assert.rejects(
    () => escrow.releaseEscrow(booking, 'auto'),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'CONCURRENT_MODIFICATION');
      return true;
    }
  );
});
