'use strict';

/**
 * lib/__tests__/cron-jobs.test.js
 *
 * Exercises the four daily cron jobs against the same in-memory fake
 * Supabase client used by the payments tests. No live database or network
 * access required, run via `npm run test:cron`.
 */

process.env.SUPABASE_URL = 'http://fake.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
process.env.CHECKVAULT_ENVIRONMENT = 'mock';

const test = require('node:test');
const assert = require('node:assert/strict');

const { installFakeSupabase } = require('../../payments/__tests__/fake-supabase');
const store = installFakeSupabase();

const cron = require('../cron-jobs');

function iso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

test('spawnRecurringBookings creates a child booking and advances the schedule', async () => {
  await store.from('bookings').insert({
    id: 'parent_1', ref: 'BK-2026-00001', customer_id: 'cust_1', contractor_id: 'contractor_1',
    service_type: 'Lawn Mowing', service_name: 'Standard Lawn Mow', total_cents: 6500,
    pricing_mode: 'fixed', escrow_state: 'RELEASED',
    recurrence_rule: 'weekly', recurrence_remaining: 3, recurrence_next_at: iso(-1), // due 1 hour ago
  });

  const result = await cron.spawnRecurringBookings();
  assert.equal(result.spawned, 1);

  const parent = store._tables.get('bookings').find(b => b.id === 'parent_1');
  assert.equal(parent.recurrence_remaining, 2, 'remaining count should decrement');

  const children = store._tables.get('bookings').filter(b => b.parent_booking_id === 'parent_1');
  assert.equal(children.length, 1);
  assert.equal(children[0].escrow_state, 'CREATED');
  assert.equal(children[0].total_cents, 6500);

  // Running again immediately must not spawn a second child (next occurrence
  // isn't due yet, since recurrence_next_at was just advanced a week out).
  const second = await cron.spawnRecurringBookings();
  assert.equal(second.spawned, 0);
});

test('sweepCredentialExpiry pauses on an expired credential and warns on one expiring soon', async () => {
  await store.from('contractor_credentials').insert({
    id: 'cred_expired', profile_id: 'contractor_expired', kind: 'insurance', expires_at: iso(-48), verified: true,
  });
  await store.from('profiles').insert({ id: 'contractor_expired', paused: false });

  await store.from('contractor_credentials').insert({
    id: 'cred_soon', profile_id: 'contractor_soon', kind: 'licence', expires_at: iso(24 * 5), verified: true, // 5 days out
  });
  await store.from('profiles').insert({ id: 'contractor_soon', paused: false });

  const result = await cron.sweepCredentialExpiry();
  assert.equal(result.paused, 1);
  assert.equal(result.warned, 1);

  const pausedProfile = store._tables.get('profiles').find(p => p.id === 'contractor_expired');
  assert.equal(pausedProfile.paused, true);
  assert.match(pausedProfile.paused_reason, /insurance/);

  const notPausedProfile = store._tables.get('profiles').find(p => p.id === 'contractor_soon');
  assert.equal(notPausedProfile.paused, false, 'expiring-soon must warn, not pause');
});

test('sweepExpiredQuotes marks only pending + past-due quotes as expired', async () => {
  await store.from('quotes').insert({ id: 'q_expired', booking_id: 'bk_x', contractor_id: 'c1', amount_cents: 5000, status: 'pending', expires_at: iso(-1) });
  await store.from('quotes').insert({ id: 'q_future', booking_id: 'bk_x', contractor_id: 'c2', amount_cents: 5500, status: 'pending', expires_at: iso(48) });
  await store.from('quotes').insert({ id: 'q_accepted', booking_id: 'bk_x', contractor_id: 'c3', amount_cents: 4000, status: 'accepted', expires_at: iso(-1) });

  const result = await cron.sweepExpiredQuotes();
  assert.equal(result.expired, 1);

  assert.equal(store._tables.get('quotes').find(q => q.id === 'q_expired').status, 'expired');
  assert.equal(store._tables.get('quotes').find(q => q.id === 'q_future').status, 'pending');
  assert.equal(store._tables.get('quotes').find(q => q.id === 'q_accepted').status, 'accepted', 'already-resolved quotes must not be touched');
});

test('autoReleaseExpiredDisputeWindows releases a booking whose dispute window has lapsed', async () => {
  await store.from('bookings').insert({
    id: 'bk_disputable', ref: 'BK-2026-00099', customer_id: 'cust_1', contractor_id: 'contractor_1',
    total_cents: 8800, service_type: 'Lawn Mowing', service_name: 'Standard Lawn Mow',
    escrow_state: 'DISPUTABLE', dispute_deadline: iso(-2), provider_escrow_id: 'mock_esc_cron_test',
    scheduled_at: iso(-48),
  });

  const result = await cron.autoReleaseExpiredDisputeWindows();
  assert.equal(result.released, 1);

  const booking = store._tables.get('bookings').find(b => b.id === 'bk_disputable');
  assert.equal(booking.escrow_state, 'RELEASED');
});
