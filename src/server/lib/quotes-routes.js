'use strict';

/**
 * lib/quotes-routes.js
 *
 * Quotes/offers flow: a customer posts a booking with pricing_mode='quoted'
 * and no contractor assigned yet; matching contractors (service_type +
 * service_areas + not paused) are notified and can submit a quote; the
 * customer accepts one, which atomically assigns the contractor and total,
 * and auto-declines every other pending quote for that booking.
 *
 * Accept is the one operation that must be server-authoritative rather than
 * pure RLS: it touches two tables (bookings + quotes) atomically and must
 * never let two competing accepts both succeed.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireUser: requireAuth } = require('./require-user');
const { notify } = require('./notify');

const router = express.Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── POST /api/quotes ──────────────────────────────────────────────────────────
// A contractor submits a quote on an open "get quotes" booking.
router.post('/quotes', requireAuth, async (req, res) => {
  const { bookingId, amountCents, message, expiresInHours } = req.body || {};
  if (!bookingId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: 'bookingId and a positive integer amountCents are required' });
  }

  const supabase = getSupabase();

  const { data: profile } = await supabase.from('profiles').select('role, paused').eq('id', req.user.id).single();
  if (!['crew_member', 'crew_manager'].includes(profile?.role)) {
    return res.status(403).json({ error: 'Only contractors can submit quotes' });
  }
  if (profile.paused) {
    return res.status(403).json({ error: 'Your account is paused. Update your credentials to resume quoting.' });
  }

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.pricing_mode !== 'quoted' || booking.contractor_id) {
    return res.status(409).json({ error: 'This booking is not open for quotes' });
  }

  const expiresAt = new Date(Date.now() + (expiresInHours || 72) * 3600 * 1000).toISOString();

  const { data: quote, error } = await supabase.from('quotes').insert({
    booking_id: bookingId,
    contractor_id: req.user.id,
    amount_cents: amountCents,
    message: message || null,
    status: 'pending',
    expires_at: expiresAt,
  }).select('*').single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'You already have a pending quote on this booking' });
    return res.status(500).json({ error: 'Could not submit quote' });
  }

  if (booking.customer_id) {
    await notify(booking.customer_id, {
      title: 'New quote received',
      body: `A contractor quoted for booking ${booking.ref}.`,
      link: '/portal', type: 'booking',
    }).catch(() => {});
  }

  res.status(201).json(quote);
});

// ── GET /api/quotes/:bookingId ────────────────────────────────────────────────
// The booking's customer sees every quote (ranked by price then rating);
// a contractor sees only their own.
router.get('/quotes/:bookingId', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  const { data: booking } = await supabase.from('bookings').select('customer_id').eq('id', req.params.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isCustomer = booking.customer_id === req.user.id;

  let query = supabase.from('quotes')
    .select('*, profiles!quotes_contractor_id_fkey(full_name, rating_avg, rating_count)')
    .eq('booking_id', req.params.bookingId);

  if (!isCustomer) query = query.eq('contractor_id', req.user.id);

  const { data: quotes, error } = await query;
  if (error) return res.status(500).json({ error: 'Could not load quotes' });

  if (isCustomer) {
    quotes.sort((a, b) => a.amount_cents - b.amount_cents || (b.profiles?.rating_avg || 0) - (a.profiles?.rating_avg || 0));
  }

  res.json({ quotes });
});

// ── POST /api/quotes/:id/accept ───────────────────────────────────────────────
// Customer accepts a quote: assigns the contractor + total to the booking,
// auto-declines every other pending quote. Uses a CAS-style guard (only
// updates the booking if it's still un-assigned) so two concurrent accepts
// on the same booking can't both succeed.
router.post('/quotes/:id/accept', requireAuth, async (req, res) => {
  const supabase = getSupabase();

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', req.params.id).single();
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  if (quote.status !== 'pending') return res.status(409).json({ error: `Quote is ${quote.status}, not pending` });

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', quote.booking_id).single();
  if (!booking || booking.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the booking customer can accept a quote' });
  }
  if (booking.contractor_id) {
    return res.status(409).json({ error: 'This booking already has a contractor assigned' });
  }

  const { data: assigned } = await supabase.from('bookings')
    .update({ contractor_id: quote.contractor_id, total_cents: quote.amount_cents })
    .eq('id', booking.id)
    .is('contractor_id', null) // CAS guard: only if still unassigned
    .select('id');

  if (!assigned?.length) {
    return res.status(409).json({ error: 'This booking was just assigned to another contractor' });
  }

  await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote.id);
  await supabase.from('quotes').update({ status: 'declined' })
    .eq('booking_id', booking.id).eq('status', 'pending').neq('id', quote.id);

  await notify(quote.contractor_id, {
    title: 'Quote accepted',
    body: `Your quote for booking ${booking.ref} was accepted. Proceed to checkout once the customer pays.`,
    link: '/contractor', type: 'booking',
  }).catch(() => {});

  res.json({ ok: true, bookingId: booking.id, contractorId: quote.contractor_id, totalCents: quote.amount_cents });
});

// ── POST /api/quotes/:id/decline ──────────────────────────────────────────────
// Customer declines a specific quote without accepting another yet.
router.post('/quotes/:id/decline', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  const { data: quote } = await supabase.from('quotes').select('*, bookings(customer_id)').eq('id', req.params.id).single();
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  if (quote.bookings?.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (quote.status !== 'pending') return res.status(409).json({ error: `Quote is ${quote.status}, not pending` });

  await supabase.from('quotes').update({ status: 'declined' }).eq('id', quote.id);
  res.json({ ok: true });
});

// ── POST /api/quotes/:id/withdraw ─────────────────────────────────────────────
// A contractor withdraws their own pending quote.
router.post('/quotes/:id/withdraw', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', req.params.id).single();
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  if (quote.contractor_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (quote.status !== 'pending') return res.status(409).json({ error: `Quote is ${quote.status}, not pending` });

  await supabase.from('quotes').update({ status: 'withdrawn' }).eq('id', quote.id);
  res.json({ ok: true });
});

module.exports = router;
