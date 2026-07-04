'use strict';

/**
 * payments/routes.js
 *
 * Express Router exposing all Crew payment, checkout, onboarding and
 * webhook endpoints, running against CheckVault (real or mock, see
 * payments/index.js).
 *
 * Endpoint summary
 * ──────────────────────────────────────────────────────────────────────────
 *  POST /api/payments/checkout-session      Create/fetch the escrow + payment instructions
 *  POST /api/payments/job-complete          Contractor marks job done, opens dispute window
 *  POST /api/payments/approve-release       Customer approves early release
 *  POST /api/payments/dispute               Either party raises a dispute
 *  POST /api/payments/refund                Admin refund
 *  POST /api/payments/cancel                Cancel, with automatic late-cancellation fee
 *  GET  /api/payments/ledger/:bookingId     Itemised GST ledger
 *  GET  /api/payments/status/:bookingId     Live escrow state
 *  POST /api/payments/mock/clear-funds      Mock-mode only: simulate a bank transfer clearing
 *
 *  POST /api/onboarding/sole-trader
 *  POST /api/onboarding/enterprise
 *  POST /api/onboarding/bank-account
 *  GET  /api/onboarding/status/:providerAccountId
 *
 *  POST /api/webhooks/checkvault            Raw body, HMAC-verified, no Supabase JWT
 *
 * Auth model: every route (other than the webhook, which is HMAC-verified)
 * requires a valid Supabase JWT via lib/require-user.js. No endpoint trusts
 * a client-supplied user ID, role, or demo-mode state; refund requires the
 * admin/crewbase_admin role read from the profiles table.
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const { requireUser: requireAuth, requireAdmin } = require('../lib/require-user');
const { notify } = require('../lib/notify');

const checkout   = require('./checkout');
const escrow     = require('./escrow');
const gst        = require('./gst');
const onboarding = require('./onboarding');
const webhooks   = require('./webhooks');
const { getProvider } = require('./index');

const router = express.Router();

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _supabase;
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { error: 'Too many checkout requests. Please wait a moment.' },
  standardHeaders: true, legacyHeaders: false,
});
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many onboarding attempts.' },
  standardHeaders: true, legacyHeaders: false,
});

// ── Error wrapper ─────────────────────────────────────────────────────────────
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.statusCode || 500;
      console.error(`[Route] ${req.method} ${req.path}:`, err.message);
      // Sanitise: never echo a raw provider error body back to the client.
      const safeMessage = err.statusCode ? err.message : 'Something went wrong. Please try again.';
      res.status(status).json({ error: safeMessage, code: err.code || 'INTERNAL_ERROR' });
    }
  };
}

function requireFields(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === '');
  if (missing.length > 0) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

async function loadCallerProfile(userId) {
  const { data } = await getSupabase().from('profiles').select('role, provider_account_id').eq('id', userId).single();
  return data;
}

function isPrivileged(role) {
  return role === 'admin' || role === 'crewbase_admin';
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.post('/payments/checkout-session', requireAuth, checkoutLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);
  const session = await checkout.createCheckoutSession({
    bookingId: req.body.bookingId,
    buyerSupabaseId: req.user.id,
  });
  res.json(session);
}));

router.post('/payments/job-complete', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const { data: booking } = await getSupabase().from('bookings').select('*').eq('id', req.body.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const profile = await loadCallerProfile(req.user.id);
  const isContractor = booking.contractor_id === req.user.id;
  if (!isContractor && !isPrivileged(profile?.role)) {
    return res.status(403).json({ error: 'Only the assigned contractor can mark a job complete' });
  }

  const result = await escrow.markJobComplete(booking, req.user.id);
  res.json({ status: escrow.STATES.DISPUTABLE, releaseAt: result.releaseAt });
}));

router.post('/payments/approve-release', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const { data: booking } = await getSupabase().from('bookings').select('*')
    .eq('id', req.body.bookingId).eq('customer_id', req.user.id).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });
  if (booking.escrow_state !== escrow.STATES.DISPUTABLE) {
    return res.status(409).json({ error: `Cannot approve release from state: ${booking.escrow_state}` });
  }

  await escrow.releaseEscrow(booking, 'customer_approved');

  if (booking.contractor_id) {
    await notify(booking.contractor_id, {
      title: 'Payment released',
      body: `The customer approved release for booking ${booking.ref}. Funds are on their way.`,
      link: '/contractor', type: 'payment',
    }).catch(() => {});
  }

  res.json({ status: escrow.STATES.RELEASED });
}));

// Either party to the booking may raise a dispute.
router.post('/payments/dispute', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId', 'reason']);

  const VALID_REASONS = ['INCOMPLETE_WORK', 'POOR_QUALITY', 'NO_SHOW', 'OTHER'];
  if (!VALID_REASONS.includes(req.body.reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  const { data: booking } = await getSupabase().from('bookings').select('*').eq('id', req.body.bookingId).single();
  if (!booking || (booking.customer_id !== req.user.id && booking.contractor_id !== req.user.id)) {
    return res.status(404).json({ error: 'Booking not found or access denied' });
  }

  const validStates = new Set([escrow.STATES.PAYMENT_HELD, escrow.STATES.DISPUTABLE]);
  if (!validStates.has(booking.escrow_state)) {
    return res.status(409).json({ error: `Cannot raise dispute from state: ${booking.escrow_state}` });
  }

  const result = await escrow.raiseDispute(booking, req.body.reason, req.user.id, req.body.notes || '');

  const otherParty = booking.customer_id === req.user.id ? booking.contractor_id : booking.customer_id;
  if (otherParty) {
    await notify(otherParty, {
      title: 'Dispute opened',
      body: `A dispute was raised on booking ${booking.ref}. Our team will review the evidence.`,
      link: '/portal', type: 'alert',
    }).catch(() => {});
  }

  res.json({ status: escrow.STATES.DISPUTED, providerDisputeId: result?.providerDisputeId });
}));

router.post('/payments/refund', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId', 'refundCents', 'reason']);
  if (!Number.isInteger(req.body.refundCents) || req.body.refundCents <= 0) {
    return res.status(400).json({ error: 'refundCents must be a positive integer' });
  }

  const { data: booking } = await getSupabase().from('bookings').select('*').eq('id', req.body.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await escrow.refundCustomer(booking, req.body.refundCents, req.body.reason);

  if (booking.customer_id) {
    await notify(booking.customer_id, {
      title: 'Refund processed',
      body: `${gst.formatAUD(req.body.refundCents)} has been refunded for booking ${booking.ref}.`,
      link: '/portal', type: 'payment',
    }).catch(() => {});
  }

  res.json({ status: escrow.STATES.REFUNDED, refundCents: req.body.refundCents });
}));

// Cancellation with an automatic late-cancellation fee. The customer sees the
// exact fee before confirming (frontend computes the same figure via
// gst.calcLateCancellationFee for the confirm dialog); this endpoint is the
// source of truth and recomputes it server-side rather than trusting the
// client's displayed number. Admin may override the fee to 0.
router.post('/payments/cancel', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const { data: booking } = await getSupabase().from('bookings').select('*').eq('id', req.body.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const profile = await loadCallerProfile(req.user.id);
  const isOwner = booking.customer_id === req.user.id;
  const admin = isPrivileged(profile?.role);
  if (!isOwner && !admin) return res.status(403).json({ error: 'Insufficient permissions to cancel this booking' });

  const preCaptureStates = new Set([escrow.STATES.CREATED, escrow.STATES.PAYMENT_PENDING]);
  if (preCaptureStates.has(booking.escrow_state)) {
    await escrow.cancelEscrow(booking, req.body.reason || '');
    return res.json({ status: escrow.STATES.CANCELLED, feeCents: 0, refundCents: 0 });
  }

  const heldStates = new Set([escrow.STATES.PAYMENT_HELD, escrow.STATES.DISPUTABLE]);
  if (!heldStates.has(booking.escrow_state)) {
    return res.status(409).json({ error: `Cannot cancel from state: ${booking.escrow_state}` });
  }

  const calc = gst.calcLateCancellationFee(booking.total_cents, booking.scheduled_at);
  // Admin can override the fee to 0 (e.g. contractor no-show, goodwill).
  const feeCents = (admin && req.body.waiveFee) ? 0 : calc.feeCents;
  const refundCents = booking.total_cents - feeCents;

  await escrow.cancelWithFee(booking, feeCents, refundCents, req.body.reason || '');

  res.json({ status: escrow.STATES.CANCELLED, feeCents, refundCents, wasLate: calc.isLate });
}));

router.get('/payments/ledger/:bookingId', requireAuth, wrap(async (req, res) => {
  const { data: booking } = await getSupabase().from('bookings')
    .select('*, profiles!bookings_contractor_id_fkey(role, full_name)')
    .eq('id', req.params.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const profile = await loadCallerProfile(req.user.id);
  const admin = isPrivileged(profile?.role);
  const isParty = booking.customer_id === req.user.id || booking.contractor_id === req.user.id;
  if (!isParty && !admin) return res.status(403).json({ error: 'Access denied' });

  const ledger = booking.ledger_json || gst.buildLedger({
    jobTotalCents: booking.total_cents,
    tier: gst.tierForRole(booking.profiles?.role || 'crew_member'),
    serviceName: booking.service_name || booking.service_type,
    contractorName: booking.profiles?.full_name || 'Contractor',
    bookingRef: booking.ref,
    dateISO: booking.created_at,
  });

  const audience = booking.customer_id === req.user.id ? 'customer' : admin ? 'admin' : 'contractor';
  res.json({ ledger, receipt: gst.ledgerToText(ledger, audience) });
}));

// Signed download URL for the customer's or contractor's own invoice PDF.
router.get('/payments/invoice/:bookingId', requireAuth, wrap(async (req, res) => {
  const { data: booking } = await getSupabase().from('bookings')
    .select('id, customer_id, contractor_id').eq('id', req.params.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const recipient = booking.customer_id === req.user.id ? 'customer'
    : booking.contractor_id === req.user.id ? 'contractor' : null;
  if (!recipient) return res.status(403).json({ error: 'Access denied' });

  const { getInvoiceDownloadUrl } = require('../lib/invoices');
  const url = await getInvoiceDownloadUrl(booking.id, recipient);
  if (!url) return res.status(404).json({ error: 'Invoice not available yet' });
  res.json({ url });
}));

router.get('/payments/status/:bookingId', requireAuth, wrap(async (req, res) => {
  const { data: booking } = await getSupabase().from('bookings')
    .select('id, customer_id, contractor_id, escrow_state, provider_escrow_id, total_cents, auto_release_at, disputed_at, payment_released_at')
    .eq('id', req.params.bookingId).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const profile = await loadCallerProfile(req.user.id);
  const admin = isPrivileged(profile?.role);
  const isParty = booking.customer_id === req.user.id || booking.contractor_id === req.user.id;
  if (!isParty && !admin) return res.status(403).json({ error: 'Access denied' });

  const statusData = await escrow.getEscrowStatus(booking);
  res.json(statusData);
}));

// Mock mode only: simulate a bank transfer/BPAY payment clearing.
router.post('/payments/mock/clear-funds', requireAuth, wrap(async (req, res) => {
  if ((process.env.CHECKVAULT_ENVIRONMENT || 'mock').toLowerCase() !== 'mock') {
    return res.status(403).json({ error: 'Only available when CHECKVAULT_ENVIRONMENT=mock' });
  }
  requireFields(req.body, ['bookingId']);

  const { data: booking } = await getSupabase().from('bookings').select('*')
    .eq('id', req.body.bookingId).eq('customer_id', req.user.id).single();
  if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });
  if (!booking.provider_escrow_id) return res.status(409).json({ error: 'No escrow created for this booking yet' });

  const provider = getProvider();
  if (typeof provider.simulateClearance !== 'function') {
    return res.status(400).json({ error: 'The active provider does not support mock clearance' });
  }

  const mockEvent = provider.simulateClearance(booking.provider_escrow_id);
  const result = await webhooks.processEvent(Buffer.from(JSON.stringify(mockEvent)), {}, mockEvent);
  res.json({ ok: true, ...result });
}));

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.post('/onboarding/sole-trader', requireAuth, onboardingLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['firstName', 'lastName', 'mobile', 'dob', 'abn', 'addressLine1', 'city', 'state', 'postcode']);
  const result = await onboarding.onboardSoleTrader({
    supabaseUserId: req.user.id, email: req.user.email, ...req.body,
  });
  res.status(201).json(result);
}));

router.post('/onboarding/enterprise', requireAuth, onboardingLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['companyName', 'acn', 'abn', 'registrationState', 'addressLine1', 'city', 'state', 'postcode', 'email', 'beneficialOwners', 'supabaseOrgId']);
  if (!Array.isArray(req.body.beneficialOwners) || !req.body.beneficialOwners.length) {
    return res.status(400).json({ error: 'beneficialOwners must be a non-empty array' });
  }
  const result = await onboarding.onboardEnterpriseContractor({
    adminSupabaseUserId: req.user.id, ...req.body,
  });
  res.status(201).json(result);
}));

// The caller's own provider_account_id is looked up server-side; never trust
// a client-supplied account id, or any authenticated user could attach a
// bank account to someone else's provider account.
router.post('/onboarding/bank-account', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['accountName', 'bsb', 'accountNumber']);

  const profile = await loadCallerProfile(req.user.id);
  if (!profile?.provider_account_id) {
    return res.status(409).json({ error: 'Complete contractor onboarding before adding a bank account' });
  }

  const result = await onboarding.addDisbursementAccount({ ...req.body, providerAccountId: profile.provider_account_id });
  res.status(201).json(result);
}));

// Only the account owner (or an admin) may check a given account's status.
router.get('/onboarding/status/:providerAccountId', requireAuth, wrap(async (req, res) => {
  const profile = await loadCallerProfile(req.user.id);
  const admin = isPrivileged(profile?.role);
  const isOwnAccount = profile?.provider_account_id === req.params.providerAccountId;
  if (!admin && !isOwnAccount) return res.status(403).json({ error: 'Access denied' });

  const status = await onboarding.getVerificationStatus(req.params.providerAccountId);
  res.json(status);
}));

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOK ROUTE
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/webhooks/checkvault
// Raw body parsing is applied inline (server.js excludes this path from the
// global express.json() middleware so the raw bytes survive for HMAC
// verification). Never apply requireAuth: CheckVault does not send a
// Supabase JWT, only its own HMAC signature.
router.post(
  '/webhooks/checkvault',
  express.raw({ type: 'application/json', limit: '512kb' }),
  wrap(async (req, res) => {
    const rawBody = req.body; // Buffer when using express.raw()
    const parsedBody = (() => {
      try { return JSON.parse(rawBody.toString('utf8')); } catch { return null; }
    })();

    if (!parsedBody) return res.status(400).json({ error: 'Invalid JSON body' });

    const result = await webhooks.processEvent(rawBody, req.headers, parsedBody);

    // Always 2xx on receipt (including skipped duplicates) so the provider
    // doesn't retry a message we've already processed.
    res.status(200).json({ received: true, ...result });
  })
);

module.exports = router;
