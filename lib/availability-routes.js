'use strict';

/**
 * lib/availability-routes.js
 *
 * A contractor's weekly recurring availability (availability), one-off
 * exceptions (availability_exceptions, e.g. "closed on 25 Dec" or "open
 * an extra Sunday"), and the postcodes they service (service_areas). Used
 * by the matching filter when a customer requests quotes for a postcode.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireUser: requireAuth } = require('./require-user');

const router = express.Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── GET /api/availability ─────────────────────────────────────────────────────
// ?profileId= to view someone else's (public: used when a customer is
// picking a time slot for a contractor); defaults to the caller's own.
router.get('/availability', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  const profileId = req.query.profileId || req.user.id;

  const { data: weekly, error: weeklyErr } = await supabase.from('availability')
    .select('*').eq('profile_id', profileId).order('weekday', { ascending: true });
  if (weeklyErr) return res.status(500).json({ error: 'Could not load availability' });

  const { data: exceptions } = await supabase.from('availability_exceptions')
    .select('*').eq('profile_id', profileId).gte('date', new Date().toISOString().slice(0, 10));

  res.json({ weekly, exceptions: exceptions || [] });
});

// ── PUT /api/availability ─────────────────────────────────────────────────────
// Replaces the caller's entire weekly availability grid in one call (the
// frontend sends the full 7-day grid, not incremental patches).
// Body: { slots: [{ weekday: 0-6, startTime: 'HH:MM', endTime: 'HH:MM' }, ...] }
router.put('/availability', requireAuth, async (req, res) => {
  const { slots } = req.body || {};
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });

  for (const slot of slots) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
      return res.status(400).json({ error: 'Each slot needs weekday 0-6 (0=Sunday)' });
    }
    if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
      return res.status(400).json({ error: 'startTime/endTime must be HH:MM 24-hour' });
    }
    if (slot.startTime >= slot.endTime) {
      return res.status(400).json({ error: `Slot on weekday ${slot.weekday} has startTime >= endTime` });
    }
  }

  const supabase = getSupabase();
  await supabase.from('availability').delete().eq('profile_id', req.user.id);

  if (slots.length) {
    const { error } = await supabase.from('availability').insert(
      slots.map(s => ({ profile_id: req.user.id, weekday: s.weekday, start_time: s.startTime, end_time: s.endTime }))
    );
    if (error) return res.status(500).json({ error: 'Could not save availability' });
  }

  res.json({ ok: true, count: slots.length });
});

// ── POST /api/availability/exception ──────────────────────────────────────────
// Body: { date: 'YYYY-MM-DD', available: boolean }
router.post('/availability/exception', requireAuth, async (req, res) => {
  const { date, available } = req.body || {};
  if (!date || isNaN(new Date(date).getTime())) return res.status(400).json({ error: 'A valid date is required' });

  const supabase = getSupabase();
  const { error } = await supabase.from('availability_exceptions').upsert({
    profile_id: req.user.id, date, available: !!available,
  }, { onConflict: 'profile_id,date' });

  if (error) return res.status(500).json({ error: 'Could not save exception' });
  res.json({ ok: true });
});

// ── DELETE /api/availability/exception/:date ──────────────────────────────────
router.delete('/availability/exception/:date', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  await supabase.from('availability_exceptions').delete()
    .eq('profile_id', req.user.id).eq('date', req.params.date);
  res.json({ ok: true });
});

// ── GET /api/service-areas ─────────────────────────────────────────────────────
router.get('/service-areas', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  const profileId = req.query.profileId || req.user.id;
  const { data, error } = await supabase.from('service_areas').select('postcode').eq('profile_id', profileId);
  if (error) return res.status(500).json({ error: 'Could not load service areas' });
  res.json({ postcodes: (data || []).map(r => r.postcode) });
});

// ── PUT /api/service-areas ─────────────────────────────────────────────────────
// Replaces the caller's full postcode list. Body: { postcodes: ['2000', '2010', ...] }
router.put('/service-areas', requireAuth, async (req, res) => {
  const { postcodes } = req.body || {};
  if (!Array.isArray(postcodes)) return res.status(400).json({ error: 'postcodes must be an array' });

  const invalid = postcodes.filter(p => !/^\d{4}$/.test(p));
  if (invalid.length) return res.status(400).json({ error: `Invalid Australian postcodes: ${invalid.join(', ')}` });

  const supabase = getSupabase();
  await supabase.from('service_areas').delete().eq('profile_id', req.user.id);

  if (postcodes.length) {
    const { error } = await supabase.from('service_areas').insert(
      postcodes.map(postcode => ({ profile_id: req.user.id, postcode }))
    );
    if (error) return res.status(500).json({ error: 'Could not save service areas' });
  }

  res.json({ ok: true, count: postcodes.length });
});

// ── GET /api/service-areas/match/:postcode ────────────────────────────────────
// Matching contractors for a given postcode + service type + not paused,
// used to notify likely quoters when a "get quotes" booking is posted.
router.get('/service-areas/match/:postcode', requireAuth, async (req, res) => {
  if (!/^\d{4}$/.test(req.params.postcode)) return res.status(400).json({ error: 'Invalid postcode' });

  const supabase = getSupabase();
  const { data: areaRows, error } = await supabase.from('service_areas')
    .select('profile_id').eq('postcode', req.params.postcode);
  if (error) return res.status(500).json({ error: 'Could not match service areas' });

  const profileIds = (areaRows || []).map(r => r.profile_id);
  if (!profileIds.length) return res.json({ contractors: [] });

  const { data: contractors } = await supabase.from('profiles')
    .select('id, full_name, rating_avg, rating_count')
    .in('id', profileIds)
    .eq('paused', false)
    .in('role', ['crew_member', 'crew_manager']);

  res.json({ contractors: contractors || [] });
});

module.exports = router;
