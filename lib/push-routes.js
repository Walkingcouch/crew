'use strict';

/**
 * lib/push-routes.js
 *
 * Express router for Web Push subscription management and admin send.
 *
 * Endpoints:
 *   GET  /api/push/vapid-public-key   Return the VAPID public key to the client
 *   POST /api/push/subscribe          Save a push subscription for the current user
 *   POST /api/push/send               (admin only) Send a push to one or all users
 *
 * Subscriptions are stored in: push_subscriptions (user_id, subscription, created_at)
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireUser, requireAdmin } = require('./require-user');
const { getPublicKey, sendPush } = require('./vapid');

const router = express.Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── GET /api/push/vapid-public-key ───────────────────────────────────────────
// Public — the browser needs this before it can call pushManager.subscribe().
router.get('/push/vapid-public-key', (req, res) => {
  try {
    res.json({ publicKey: getPublicKey() });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ── POST /api/push/subscribe ─────────────────────────────────────────────────
// Saves (or replaces) the push subscription for the authenticated user.
router.post('/push/subscribe', requireUser, async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'subscription.endpoint is required' });
  }

  try {
    const supabase = getSupabase();
    await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: req.user.id, subscription, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe]', err.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── POST /api/push/send ──────────────────────────────────────────────────────
// Admin endpoint. Sends a push notification to a specific user or all users.
// Body: { userId?: string, title: string, body: string, url?: string }
router.post('/push/send', requireAdmin, async (req, res) => {
  const { userId, title, body, url, tag } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  const supabase = getSupabase();
  let query = supabase.from('push_subscriptions').select('user_id, subscription');
  if (userId) query = query.eq('user_id', userId);

  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  if (!rows?.length) return res.json({ sent: 0 });

  const payload = { title, body, url: url || '/', tag: tag || 'crew-push' };
  let sent = 0;
  const failed = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await sendPush(row.subscription, payload);
        sent++;
      } catch (err) {
        console.error('[push/send] failed for', row.user_id, err.message);
        // If subscription is gone (410/404), remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', row.user_id);
        }
        failed.push(row.user_id);
      }
    })
  );

  res.json({ sent, failed: failed.length, total: rows.length });
});

module.exports = router;
