'use strict';

/**
 * api/push/dispatch.js
 *
 * Vercel serverless function equivalent of the /api/push/dispatch route in
 * lib/push-routes.js (used by server.js for local dev). Wired into the
 * Vercel routing properly in Phase 8 — this file exists now so a Supabase
 * Database Webhook has a stable URL to target as soon as the project is
 * deployed. Secured by the PUSH_DISPATCH_SECRET shared-secret header, since
 * the caller is Supabase's webhook system rather than a signed-in user.
 *
 * Supabase Database Webhook setup: Database → Webhooks → new webhook on
 * `notifications`, event INSERT, HTTP POST to
 * https://getcrew.com.au/api/push/dispatch with header
 * X-Push-Dispatch-Secret: <PUSH_DISPATCH_SECRET>. See DEPLOY.md.
 */

const { createClient } = require('@supabase/supabase-js');
const { sendPushToUser } = require('../../lib/notify');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/push/dispatch]', err.message);
    res.status(500).json({ error: 'Dispatch failed' });
  }
};
