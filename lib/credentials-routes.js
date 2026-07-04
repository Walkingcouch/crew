'use strict';

/**
 * lib/credentials-routes.js
 *
 * Licence and insurance credential tracking for contractors, against the
 * contractor_credentials table (profile_id, kind, number, issuer,
 * expires_at, document_path, verified, verified_at, verified_by,
 * rejected_reason; UNIQUE(profile_id, kind), see supabase/migrations).
 *
 * A contractor uploads a credential; an admin verifies it; a daily cron job
 * (lib/cron-jobs.js) pauses any contractor whose credential has expired
 * unverified, and warns them ahead of expiry.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireUser: requireAuth, requireAdmin } = require('./require-user');
const { notify } = require('./notify');

const router = express.Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const CREDENTIAL_KINDS = ['licence', 'insurance', 'photo_id'];

// ── POST /api/credentials ──────────────────────────────────────────────────────
// A contractor adds or replaces one of their credentials. The file itself is
// uploaded straight to the `credentials` Storage bucket from the client
// (RLS scopes it to the uploader's own folder); this just records the
// metadata and expiry date once the file is up.
router.post('/credentials', requireAuth, async (req, res) => {
  const { kind, number, issuer, expiresAt, documentPath } = req.body || {};
  if (!CREDENTIAL_KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${CREDENTIAL_KINDS.join(', ')}` });
  }
  if (!expiresAt || isNaN(new Date(expiresAt).getTime())) {
    return res.status(400).json({ error: 'A valid expiresAt date is required' });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('contractor_credentials').upsert({
    profile_id: req.user.id,
    kind,
    number: number || null,
    issuer: issuer || null,
    expires_at: expiresAt,
    document_path: documentPath || null,
    verified: false,
    verified_at: null,
    rejected_reason: null,
  }, { onConflict: 'profile_id,kind' }).select('*').single();

  if (error) return res.status(500).json({ error: 'Could not save credential' });
  res.status(201).json(data);
});

// ── GET /api/credentials ────────────────────────────────────────────────────────
// A contractor's own credentials, or (with ?profileId=) an admin's view of
// anyone's for the verification queue.
router.get('/credentials', requireAuth, async (req, res) => {
  const supabase = getSupabase();

  if (req.query.profileId && req.query.profileId !== req.user.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
    if (!['admin', 'crewbase_admin'].includes(profile?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const profileId = req.query.profileId || req.user.id;
  const { data, error } = await supabase.from('contractor_credentials').select('*').eq('profile_id', profileId);
  if (error) return res.status(500).json({ error: 'Could not load credentials' });
  res.json({ credentials: data });
});

// ── GET /api/credentials/verification-queue ───────────────────────────────────
// Admin: every unverified credential with a document actually submitted,
// oldest first.
router.get('/credentials/verification-queue', requireAdmin, async (req, res) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('contractor_credentials')
    .select('*, profiles!contractor_credentials_profile_id_fkey(full_name, email)')
    .eq('verified', false)
    .not('document_path', 'is', null)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'Could not load verification queue' });
  res.json({ queue: data });
});

// ── POST /api/credentials/:id/verify ──────────────────────────────────────────
// Admin approves a credential. If this was the contractor's only reason for
// being paused, un-pause them (only if no other credential is still
// unverified or expired).
router.post('/credentials/:id/verify', requireAdmin, async (req, res) => {
  const supabase = getSupabase();
  const { data: credential } = await supabase.from('contractor_credentials').select('*').eq('id', req.params.id).single();
  if (!credential) return res.status(404).json({ error: 'Credential not found' });

  await supabase.from('contractor_credentials').update({
    verified: true, verified_at: new Date().toISOString(), verified_by: req.user.id,
  }).eq('id', credential.id);

  const { data: outstanding } = await supabase.from('contractor_credentials')
    .select('id').eq('profile_id', credential.profile_id)
    .or(`verified.eq.false,expires_at.lt.${new Date().toISOString()}`);

  if (!outstanding?.length) {
    await supabase.from('profiles').update({ paused: false, paused_reason: null }).eq('id', credential.profile_id);
  }

  await notify(credential.profile_id, {
    title: 'Credential verified',
    body: `Your ${credential.kind.replace(/_/g, ' ')} has been verified.`,
    link: '/contractor', type: 'alert',
  }).catch(() => {});

  res.json({ ok: true });
});

// ── POST /api/credentials/:id/reject ──────────────────────────────────────────
router.post('/credentials/:id/reject', requireAdmin, async (req, res) => {
  const supabase = getSupabase();
  const { data: credential } = await supabase.from('contractor_credentials').select('*').eq('id', req.params.id).single();
  if (!credential) return res.status(404).json({ error: 'Credential not found' });

  await supabase.from('contractor_credentials').update({
    verified: false, document_path: null, rejected_reason: req.body?.reason || null,
  }).eq('id', credential.id);

  await notify(credential.profile_id, {
    title: 'Credential needs attention',
    body: `Your ${credential.kind.replace(/_/g, ' ')} could not be verified${req.body?.reason ? `: ${req.body.reason}` : '.'}`,
    link: '/contractor', type: 'warning',
  }).catch(() => {});

  res.json({ ok: true });
});

module.exports = router;
