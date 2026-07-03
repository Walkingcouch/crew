'use strict';

/**
 * payments/routes.js
 *
 * Express Router exposing all Crew payment, checkout, onboarding,
 * and webhook endpoints.
 *
 * Mount in server.js:
 *   const paymentRoutes = require('./payments/routes');
 *   app.use('/api', paymentRoutes);
 *
 * Endpoint summary
 * ──────────────────────────────────────────────────────────
 *  POST /api/payments/checkout-session      Create checkout session + GST ledger
 *  POST /api/payments/tokenize-card         Exchange Zai.js token for card_account_id
 *  POST /api/payments/charge                Charge customer + move to PAYMENT_PENDING
 *  POST /api/payments/bank-transfer-setup   Set up NPP bank transfer option
 *  POST /api/payments/job-complete          Mark job done, open 12h dispute window
 *  POST /api/payments/approve-release       Customer approves early release
 *  POST /api/payments/dispute               Customer raises a dispute
 *  POST /api/payments/refund                Admin refund
 *  POST /api/payments/cancel                Cancel pre-payment escrow
 *  GET  /api/payments/ledger/:bookingId     Fetch itemised GST ledger
 *  GET  /api/payments/status/:bookingId     Fetch live escrow state
 *  GET  /api/payments/methods               List saved payment methods
 *
 *  POST /api/onboarding/sole-trader         Onboard individual contractor
 *  POST /api/onboarding/enterprise          Onboard enterprise company
 *  POST /api/onboarding/bank-account        Add disbursement bank account
 *  GET  /api/onboarding/status/:zaiUserId   Check KYC/KYB status
 *
 *  POST /api/webhooks/zai                   Zai webhook receiver (HMAC verified)
 *
 * Auth model
 * ──────────
 * All payment routes require a valid Supabase JWT in the Authorization header.
 * The webhooks/zai route is verified by HMAC, NOT by Supabase JWT.
 * The refund and dispute-resolve routes require the 'admin' role.
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');

const { requireUser: requireAuth, requireAdmin } = require('../lib/require-user');

const checkout   = require('./checkout');
const escrow     = require('./escrow');
const gst        = require('./gst');
const onboarding = require('./onboarding');
const webhooks   = require('./webhooks');

const router = express.Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { error: 'Too many checkout requests. Please wait a moment.' },
  standardHeaders: true, legacyHeaders: false,
});

const chargeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: { error: 'Too many charge attempts. Please wait.' },
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
      const status = err.statusCode || (err.name === 'ZaiError' ? 502 : 500);
      console.error(`[Route] ${req.method} ${req.path}:`, err.message);
      res.status(status).json({
        error:   err.message,
        code:    err.code || 'INTERNAL_ERROR',
      });
    }
  };
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function requireFields(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === '');
  if (missing.length > 0) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/payments/checkout-session
// Creates Zai escrow item + hosted-fields session token for Zai.js
router.post('/payments/checkout-session', requireAuth, checkoutLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);
  const session = await checkout.createCheckoutSession({
    bookingId:        req.body.bookingId,
    buyerSupabaseId:  req.user.id,
  });
  res.json(session);
}));

// POST /api/payments/tokenize-card
// Receives Zai.js one-time token → creates persistent card_account
router.post('/payments/tokenize-card', requireAuth, chargeLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['buyerZaiId', 'cardToken']);
  const card = await checkout.tokenizeCard({
    buyerZaiId: req.body.buyerZaiId,
    cardToken:  req.body.cardToken,
    saveCard:   req.body.saveCard ?? false,
  });
  res.json(card);
}));

// POST /api/payments/charge
// Initiates the actual charge on the escrow item
router.post('/payments/charge', requireAuth, chargeLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId', 'accountId']);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', req.body.bookingId)
    .eq('customer_id', req.user.id)
    .single();

  if (error || !booking) return res.status(404).json({ error: 'Booking not found' });

  checkout.assertSessionValid(booking);

  const ipAddress = (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );

  const chargeRes = await escrow.chargeCustomer(booking, req.body.accountId, ipAddress);
  res.json({ status: 'PAYMENT_PENDING', zaiChargeId: chargeRes?.charges?.id });
}));

// POST /api/payments/bank-transfer-setup
// Creates a bank account record for NPP/direct-debit payment path
router.post('/payments/bank-transfer-setup', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['buyerZaiId', 'accountName', 'bsb', 'accountNumber']);
  const result = await checkout.createBankTransferAuth(req.body);
  res.json(result);
}));

// POST /api/payments/job-complete
// Contractor marks job done → opens 12-hour dispute window
router.post('/payments/job-complete', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', req.body.bookingId)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Only the assigned contractor or an admin can mark complete
  const isContractor = booking.contractor_id === req.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', req.user.id).single();
  const isAdmin = ['admin', 'crewbase_admin'].includes(profile?.role);

  if (!isContractor && !isAdmin) {
    return res.status(403).json({ error: 'Only the assigned contractor can mark a job complete' });
  }

  const result = await escrow.markJobComplete(booking, req.user.id);
  res.json({ status: escrow.STATES.DISPUTABLE, releaseAt: result.releaseAt });
}));

// POST /api/payments/approve-release
// Customer approves early release before 12h window expires
router.post('/payments/approve-release', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', req.body.bookingId)
    .eq('customer_id', req.user.id)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });
  if (booking.escrow_state !== escrow.STATES.DISPUTABLE) {
    return res.status(409).json({ error: `Cannot approve release from state: ${booking.escrow_state}` });
  }

  await escrow.releaseEscrow(booking, 'customer_approved');
  res.json({ status: escrow.STATES.RELEASING });
}));

// POST /api/payments/dispute
// Customer raises a dispute within the 12-hour window
router.post('/payments/dispute', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId', 'reason']);

  const VALID_REASONS = ['INCOMPLETE_WORK', 'POOR_QUALITY', 'NO_SHOW', 'OTHER'];
  if (!VALID_REASONS.includes(req.body.reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', req.body.bookingId)
    .eq('customer_id', req.user.id)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found or access denied' });

  const validStates = new Set([escrow.STATES.PAYMENT_HELD, escrow.STATES.DISPUTABLE]);
  if (!validStates.has(booking.escrow_state)) {
    return res.status(409).json({ error: `Cannot raise dispute from state: ${booking.escrow_state}` });
  }

  const result = await escrow.raiseDispute(
    booking,
    req.body.reason,
    req.user.id,
    req.body.notes || ''
  );
  res.json({ status: escrow.STATES.DISPUTED, disputeId: result?.disputes?.id });
}));

// POST /api/payments/refund  (admin only)
router.post('/payments/refund', requireAdmin, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId', 'refundCents', 'reason']);

  if (!Number.isInteger(req.body.refundCents) || req.body.refundCents <= 0) {
    return res.status(400).json({ error: 'refundCents must be a positive integer' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking } = await supabase
    .from('bookings').select('*').eq('id', req.body.bookingId).single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  await escrow.refundCustomer(booking, req.body.refundCents, req.body.reason);
  res.json({ status: escrow.STATES.REFUNDED, refundCents: req.body.refundCents });
}));

// POST /api/payments/cancel
router.post('/payments/cancel', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['bookingId']);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: booking } = await supabase
    .from('bookings').select('*').eq('id', req.body.bookingId).single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Only customer or admin can cancel
  const isOwner = booking.customer_id === req.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', req.user.id).single();
  const isAdmin = ['admin', 'crewbase_admin'].includes(profile?.role);

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Insufficient permissions to cancel this booking' });
  }

  await escrow.cancelEscrow(booking, req.body.reason || '');
  res.json({ status: escrow.STATES.CANCELLED });
}));

// GET /api/payments/ledger/:bookingId
// Returns the full itemised GST ledger for a booking
router.get('/payments/ledger/:bookingId', requireAuth, wrap(async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, profiles!bookings_contractor_id_fkey(role, full_name)')
    .eq('id', req.params.bookingId)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Allow: customer, contractor on this booking, or admin
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', req.user.id).single();
  const isAdmin    = ['admin', 'crewbase_admin'].includes(profile?.role);
  const isParty    = booking.customer_id === req.user.id || booking.contractor_id === req.user.id;
  if (!isParty && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  // Re-build from stored ledger or re-calculate
  const ledger = booking.ledger_json || gst.buildLedger({
    jobTotalCents:  booking.amount_cents,
    tier:           gst.tierForRole(booking.profiles?.role || 'crew_member'),
    serviceName:    booking.service_name,
    contractorName: booking.profiles?.full_name || 'Contractor',
    bookingRef:     booking.booking_ref,
    dateISO:        booking.created_at,
  });

  // Return full ledger + audience-appropriate text receipt
  const audience = booking.customer_id === req.user.id ? 'customer' : isAdmin ? 'admin' : 'contractor';
  res.json({
    ledger,
    receipt: gst.ledgerToText(ledger, audience),
  });
}));

// GET /api/payments/status/:bookingId
router.get('/payments/status/:bookingId', requireAuth, wrap(async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, escrow_state, zai_item_id, amount_cents, auto_release_at, disputed_at, payment_released_at')
    .eq('id', req.params.bookingId)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const statusData = await escrow.getEscrowStatus(booking);
  res.json(statusData);
}));

// GET /api/payments/methods
router.get('/payments/methods', requireAuth, wrap(async (req, res) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: profile } = await supabase
    .from('profiles').select('zai_user_id').eq('id', req.user.id).single();

  if (!profile?.zai_user_id) return res.json({ cards: [], bankAccounts: [] });

  const methods = await checkout.listPaymentMethods(profile.zai_user_id);
  res.json(methods);
}));

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/onboarding/sole-trader
router.post('/onboarding/sole-trader', requireAuth, onboardingLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['firstName', 'lastName', 'mobile', 'dob', 'abn',
                            'addressLine1', 'city', 'state', 'postcode']);

  const result = await onboarding.onboardSoleTrader({
    supabaseUserId: req.user.id,
    email:          req.user.email,
    ...req.body,
  });
  res.status(201).json(result);
}));

// POST /api/onboarding/enterprise
router.post('/onboarding/enterprise', requireAuth, onboardingLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['companyName', 'acn', 'abn', 'registrationState',
                            'addressLine1', 'city', 'state', 'postcode',
                            'email', 'phone', 'beneficialOwners', 'supabaseOrgId']);

  if (!Array.isArray(req.body.beneficialOwners) || !req.body.beneficialOwners.length) {
    return res.status(400).json({ error: 'beneficialOwners must be a non-empty array' });
  }

  const result = await onboarding.onboardEnterpriseContractor({
    adminSupabaseUserId: req.user.id,
    ...req.body,
  });
  res.status(201).json(result);
}));

// POST /api/onboarding/bank-account
router.post('/onboarding/bank-account', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['zaiUserId', 'accountName', 'bsb', 'accountNumber']);
  const result = await onboarding.addDisbursementAccount(req.body);
  res.status(201).json(result);
}));

// GET /api/onboarding/status/:zaiUserId
router.get('/onboarding/status/:zaiUserId', requireAuth, wrap(async (req, res) => {
  const status = await onboarding.getVerificationStatus(req.params.zaiUserId);
  res.json(status);
}));

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOK ROUTE
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/webhooks/zai
// IMPORTANT: This route uses raw body parsing (applied inline below).
// Do NOT apply requireAuth — Zai does not send a Supabase JWT.
router.post(
  '/webhooks/zai',
  // Capture raw body before any body parsing middleware transforms it
  express.raw({ type: 'application/json', limit: '512kb' }),
  wrap(async (req, res) => {
    const signature  = req.headers['x-zai-signature'] || '';
    const rawBody    = req.body; // Buffer when using express.raw()
    const parsedBody = (() => {
      try { return JSON.parse(rawBody.toString('utf8')); }
      catch { return null; }
    })();

    if (!parsedBody) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const result = await webhooks.processEvent(rawBody, signature, parsedBody);

    // Zai expects a 2xx response to acknowledge receipt.
    // Return 200 even for skipped duplicates so Zai doesn't retry.
    res.status(200).json({ received: true, ...result });
  })
);

module.exports = router;
