'use strict';

/**
 * lib/push-routes.js
 *
 * Express router for Web Push subscription management and admin send.
 *
 * Endpoints:
 *   GET  /api/push/vapid-public-key   Return the VAPID public key to the client
 *   POST /api/push/subscribe          Save (upsert by endpoint) a push subscription for the current user
 *   POST /api/push/unsubscribe        Remove a push subscription (settings toggle "turn off")
 *   POST /api/push/send               (admin only) Send a push to one or all users
 *
 * Subscriptions are stored one row per device in: push_subscriptions
 *   (id, user_id, endpoint unique, p256dh, auth, user_agent, created_at)
 * so a single user can be subscribed from several devices at once.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireUser, requireAdmin } = require('./require-user');
const { getPublicKey, sendPush } = require('./vapid');
const { sendPushToUser } = require('./notify');

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
// Body: { subscription: PushSubscription.toJSON() shape }
// Upserts on endpoint so re-subscribing the same device (e.g. after the
// browser rotates the endpoint) replaces the old row for that endpoint,
// while other devices for the same user are left untouched.
router.post('/push/subscribe', requireUser, async (req, res) => {
  const { subscription } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh   = subscription?.keys?.p256dh;
  const auth     = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'subscription.endpoint and subscription.keys are required' });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id:     req.user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:  req.headers['user-agent'] || null,
        },
        { onConflict: 'endpoint' }
      );
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe]', err.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── POST /api/push/unsubscribe ───────────────────────────────────────────────
// Body: { endpoint }
router.post('/push/unsubscribe', requireUser, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

  try {
    const supabase = getSupabase();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/unsubscribe]', err.message);
    res.status(500).json({ error: 'Failed to remove subscription' });
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
  let query = supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
  if (userId) query = query.eq('user_id', userId);

  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  if (!rows?.length) return res.json({ sent: 0 });

  const payload = { title, body, url: url || '/', tag: tag || 'crew-push' };
  let sent = 0;
  const deadIds = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await sendPush(subscription, payload);
        sent++;
      } catch (err) {
        console.error('[push/send] failed for', row.user_id, err.message);
        const status = err.statusCode || err.status;
        if (status === 404 || status === 410) deadIds.push(row.id);
      }
    })
  );

  if (deadIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', deadIds);
  }

  res.json({ sent, pruned: deadIds.length, total: rows.length });
});

// ── POST /api/push/dispatch ──────────────────────────────────────────────────
// Triggered by a Supabase Database Webhook on `notifications` INSERT, so that
// rows created directly by a DB trigger or edge function (bypassing lib/notify.js)
// still result in a Web Push send. Secured by a shared secret header rather
// than a Supabase JWT, since the caller is Supabase's webhook system, not a user.
// Body (Supabase webhook payload shape): { type: 'INSERT', table: 'notifications', record: {...} }
router.post('/push/dispatch', async (req, res) => {
  const secret = req.headers['x-push-dispatch-secret'];
  if (!process.env.PUSH_DISPATCH_SECRET || secret !== process.env.PUSH_DISPATCH_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing dispatch secret' });
  }

  const record = req.body?.record;
  if (!record?.user_id || !record?.title) {
    return res.status(400).json({ error: 'record.user_id and record.title are required' });
  }

  try {
    const supabase = getSupabase();
    const result = await sendPushToUser(supabase, record.user_id, {
      title: record.title,
      body:  record.body || '',
      url:   record.link || '/',
      tag:   record.type || 'crew-push',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[push/dispatch]', err.message);
    res.status(500).json({ error: 'Dispatch failed' });
  }
});

module.exports = router;
