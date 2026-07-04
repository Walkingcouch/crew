'use strict';

/**
 * lib/admin-routes.js
 *
 * Admin metrics dashboard data, reading the 5 read-only views defined in
 * supabase/migrations/0001_init.sql (metrics_gmv_daily, metrics_take_rate,
 * metrics_disputes, metrics_time_to_match, metrics_contractor_utilisation).
 * Consumed by the Command Center admin metrics panel.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAdmin } = require('./require-user');

const router = express.Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── GET /api/admin/metrics ─────────────────────────────────────────────────────
router.get('/admin/metrics', requireAdmin, async (req, res) => {
  const supabase = getSupabase();

  const [gmv, takeRate, disputes, timeToMatch, utilisation] = await Promise.all([
    supabase.from('metrics_gmv_daily').select('*').order('day', { ascending: false }).limit(30),
    supabase.from('metrics_take_rate').select('*'),
    supabase.from('metrics_disputes').select('*'),
    supabase.from('metrics_time_to_match').select('*'),
    supabase.from('metrics_contractor_utilisation').select('*').order('jobs_completed', { ascending: false }).limit(50),
  ]);

  const firstError = [gmv, takeRate, disputes, timeToMatch, utilisation].find(r => r.error);
  if (firstError) return res.status(500).json({ error: 'Could not load one or more metrics views' });

  res.json({
    gmvDaily: gmv.data,
    takeRate: takeRate.data,
    disputes: disputes.data,
    timeToMatch: timeToMatch.data,
    contractorUtilisation: utilisation.data,
  });
});

module.exports = router;
