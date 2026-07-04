'use strict';

/**
 * lib/cron-jobs.js
 *
 * Everything that needs to run on a schedule rather than in response to a
 * request. Each function is independent and idempotent (safe to run twice
 * in the same day if a previous run partially failed), and returns a small
 * summary object for logging. Wired to a single daily Vercel Cron endpoint
 * in Phase 8 (api/cron/daily.js); scripts/run-cron.js runs the same
 * functions locally for manual testing.
 */

const { createClient } = require('@supabase/supabase-js');
const escrow = require('../payments/escrow');
const { notify, notifyAdmin } = require('./notify');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function addInterval(date, rule) {
  const d = new Date(date);
  switch (rule) {
    case 'weekly':     d.setDate(d.getDate() + 7); break;
    case 'fortnightly': d.setDate(d.getDate() + 14); break;
    case 'monthly':    d.setMonth(d.getMonth() + 1); break;
    default: throw new Error(`Unknown recurrence_rule: ${rule}`);
  }
  return d;
}

// ── 1. Recurring booking spawner ──────────────────────────────────────────────
// Every parent booking with a recurrence_rule whose next occurrence is due
// gets a fresh child booking created (unpaid, CREATED state, same service/
// contractor/pricing as the template), and its own recurrence_next_at
// advanced so the same parent isn't spawned twice.
async function spawnRecurringBookings() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase.from('bookings')
    .select('*')
    .not('recurrence_rule', 'is', null)
    .gt('recurrence_remaining', 0)
    .lte('recurrence_next_at', now);

  if (error) throw new Error(`spawnRecurringBookings query failed: ${error.message}`);

  let spawned = 0;
  for (const parent of due || []) {
    // CAS guard: only claim this occurrence if recurrence_next_at hasn't
    // already been advanced by a concurrent run.
    const nextAt = addInterval(parent.recurrence_next_at, parent.recurrence_rule);
    const { data: claimed } = await supabase.from('bookings')
      .update({ recurrence_next_at: nextAt.toISOString(), recurrence_remaining: parent.recurrence_remaining - 1 })
      .eq('id', parent.id)
      .eq('recurrence_next_at', parent.recurrence_next_at)
      .select('id');

    if (!claimed?.length) continue; // another run already claimed this occurrence

    const { error: insertErr } = await supabase.from('bookings').insert({
      customer_id: parent.customer_id,
      contractor_id: parent.contractor_id,
      org_id: parent.org_id,
      service_type: parent.service_type,
      service_name: parent.service_name,
      description: parent.description,
      address: parent.address,
      suburb: parent.suburb,
      lat: parent.lat,
      lng: parent.lng,
      scheduled_at: parent.recurrence_next_at, // the occurrence that was just due
      total_cents: parent.total_cents,
      pricing_mode: parent.pricing_mode,
      parent_booking_id: parent.id,
      escrow_state: 'CREATED',
    });

    if (insertErr) {
      console.error(`[cron] spawnRecurringBookings insert failed for parent ${parent.id}:`, insertErr.message);
      continue;
    }
    spawned++;

    if (parent.customer_id) {
      await notify(parent.customer_id, {
        title: 'Recurring booking created',
        body: `Your next ${parent.service_name || parent.service_type} booking is ready. Please complete payment.`,
        link: '/portal', type: 'booking',
      }).catch(() => {});
    }
  }

  return { checked: (due || []).length, spawned };
}

// ── 2. Credential expiry sweep ────────────────────────────────────────────────
// Pauses contractors whose credential has expired, and warns anyone whose
// credential expires within WARNING_DAYS so they have time to renew.
const WARNING_DAYS = 14;

async function sweepCredentialExpiry() {
  const supabase = getSupabase();
  const now = new Date();
  const warningCutoff = new Date(now.getTime() + WARNING_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: expired, error } = await supabase.from('contractor_credentials')
    .select('*').lt('expires_at', now.toISOString());
  if (error) throw new Error(`sweepCredentialExpiry query failed: ${error.message}`);

  let paused = 0;
  const alreadyPausedProfiles = new Set();
  for (const cred of expired || []) {
    if (alreadyPausedProfiles.has(cred.profile_id)) continue;
    const { data: profile } = await supabase.from('profiles').select('paused').eq('id', cred.profile_id).single();
    if (profile && !profile.paused) {
      await supabase.from('profiles').update({
        paused: true, paused_reason: `${cred.kind.replace(/_/g, ' ')} expired`,
      }).eq('id', cred.profile_id);
      await notify(cred.profile_id, {
        title: 'Account paused: credential expired',
        body: `Your ${cred.kind.replace(/_/g, ' ')} has expired. Upload a renewal to resume taking jobs.`,
        link: '/contractor', type: 'warning',
      }).catch(() => {});
      paused++;
    }
    alreadyPausedProfiles.add(cred.profile_id);
  }

  const { data: expiringSoon } = await supabase.from('contractor_credentials')
    .select('*').gte('expires_at', now.toISOString()).lte('expires_at', warningCutoff);

  let warned = 0;
  for (const cred of expiringSoon || []) {
    await notify(cred.profile_id, {
      title: 'Credential expiring soon',
      body: `Your ${cred.kind.replace(/_/g, ' ')} expires within ${WARNING_DAYS} days. Renew it to avoid an account pause.`,
      link: '/contractor', type: 'warning',
    }).catch(() => {});
    warned++;
  }

  return { paused, warned };
}

// ── 3. Quote expiry sweep ─────────────────────────────────────────────────────
async function sweepExpiredQuotes() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: expired, error } = await supabase.from('quotes')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', now)
    .select('id');

  if (error) throw new Error(`sweepExpiredQuotes failed: ${error.message}`);
  return { expired: expired?.length || 0 };
}

// ── 4. Dispute-window auto-release ────────────────────────────────────────────
// A booking sitting in DISPUTABLE past its dispute_deadline with no dispute
// raised is auto-released to the contractor.
async function autoReleaseExpiredDisputeWindows() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase.from('bookings')
    .select('*').eq('escrow_state', 'DISPUTABLE').lt('dispute_deadline', now);
  if (error) throw new Error(`autoReleaseExpiredDisputeWindows query failed: ${error.message}`);

  let released = 0;
  for (const booking of due || []) {
    try {
      await escrow.releaseEscrow(booking, 'auto_dispute_window_expired');
      released++;
    } catch (err) {
      console.error(`[cron] auto-release failed for booking ${booking.id}:`, err.message);
    }
  }

  return { checked: (due || []).length, released };
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function runDailyCron() {
  const results = {};
  const jobs = {
    recurringBookings: spawnRecurringBookings,
    credentialExpiry: sweepCredentialExpiry,
    quoteExpiry: sweepExpiredQuotes,
    disputeWindowRelease: autoReleaseExpiredDisputeWindows,
  };

  for (const [name, fn] of Object.entries(jobs)) {
    try {
      results[name] = await fn();
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err.message);
      results[name] = { error: err.message };
      await notifyAdmin({ type: 'cron_failure', message: `Daily cron job "${name}" failed: ${err.message}`, email: true }).catch(() => {});
    }
  }

  return results;
}

module.exports = {
  spawnRecurringBookings,
  sweepCredentialExpiry,
  sweepExpiredQuotes,
  autoReleaseExpiredDisputeWindows,
  runDailyCron,
};
