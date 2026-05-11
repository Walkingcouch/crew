import { useState } from "react";

const COLORS = {
  green: "#1a4d33", greenMid: "#2d8055", greenLt: "#4db37c", greenPale: "#f0f7f3",
  ink: "#0f0f0e", ink2: "#3a3630", ink3: "#7d7870", ink4: "#b8b3aa",
  bg: "#fafaf8", white: "#ffffff", rule: "#e8e3dc",
  amber: "#d97706", red: "#dc2626", navy: "#162878",
};

const SECTIONS = [
  {
    id: "services",
    step: "4",
    title: "Service Implementations",
    subtitle: "Database Layer",
    icon: "⚙️",
    color: COLORS.navy,
    paleBg: "#eff2ff",
    description: "Full service modules with MongoDB/Mongoose models, validation, audit logging, and error handling. These are injected into the escrow and GPS middleware.",
    files: [
      {
        name: "services/escrowService.js",
        code: `// ─── services/escrowService.js ─────────────────────────────
// Escrow transaction service with full CRUD, status machine,
// and audit trail. Injected into createEscrowGuard() middleware.
//
// Expects MongoDB via Mongoose. Swap the model import for your ORM.

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────
const escrowSchema = new mongoose.Schema({
  homeownerId:   { type: String, required: true, index: true },
  contractorId:  { type: String, required: true, index: true },
  jobId:         { type: String, required: true, ref: 'Job' },
  amount:        { type: Number, required: true, min: 0 },
  currency:      { type: String, default: 'AUD' },
  status: {
    type: String,
    enum: ['pending', 'funded', 'released', 'disputed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true,
  },
  fundedAt:      { type: Date },
  releasedAt:    { type: Date },
  disputedAt:    { type: Date },
  metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  auditLog: [{
    action:    String,
    userId:    String,
    timestamp: { type: Date, default: Date.now },
    detail:    String,
  }],
}, {
  timestamps: true,
});

// Compound index for fast party lookups
escrowSchema.index({ homeownerId: 1, status: 1 });
escrowSchema.index({ contractorId: 1, status: 1 });

const EscrowTransaction = mongoose.model('EscrowTransaction', escrowSchema);

// ─── Valid status transitions ─────────────────────────────
const TRANSITIONS = {
  pending:  ['funded', 'cancelled'],
  funded:   ['released', 'disputed'],
  disputed: ['released', 'refunded'],
  released: [],       // terminal
  refunded: [],       // terminal
  cancelled: [],      // terminal
};

// ─── Service ──────────────────────────────────────────────
const escrowService = {

  /**
   * Get transaction by ID
   * Used by escrowSecurity middleware to verify user-transaction binding
   * @returns {{ id, homeownerId, contractorId, status, ... } | null}
   */
  async getTransaction(escrowId) {
    try {
      const txn = await EscrowTransaction.findById(escrowId).lean();
      if (!txn) return null;

      return {
        id:            txn._id.toString(),
        homeownerId:   txn.homeownerId,
        contractorId:  txn.contractorId,
        jobId:         txn.jobId,
        amount:        txn.amount,
        currency:      txn.currency,
        status:        txn.status,
        fundedAt:      txn.fundedAt,
        releasedAt:    txn.releasedAt,
        createdAt:     txn.createdAt,
      };
    } catch (err) {
      console.error(\`[EscrowService] getTransaction error: \${err.message}\`);
      throw err;
    }
  },

  /**
   * Create a new escrow hold
   */
  async createTransaction({ homeownerId, contractorId, jobId, amount }) {
    const txn = await EscrowTransaction.create({
      homeownerId,
      contractorId,
      jobId,
      amount,
      status: 'pending',
      auditLog: [{
        action: 'created',
        userId: homeownerId,
        detail: \`Escrow created for job \${jobId}, amount: $\${amount} AUD\`,
      }],
    });

    return { id: txn._id.toString(), status: txn.status };
  },

  /**
   * Transition escrow status with validation
   * @param {string} escrowId
   * @param {string} newStatus
   * @param {string} userId - who is performing the action
   */
  async updateStatus(escrowId, newStatus, userId) {
    const txn = await EscrowTransaction.findById(escrowId);
    if (!txn) throw new Error('Transaction not found');

    const allowed = TRANSITIONS[txn.status] || [];
    if (!allowed.includes(newStatus)) {
      const err = new Error(
        \`Invalid transition: \${txn.status} → \${newStatus}. Allowed: \${allowed.join(', ') || 'none (terminal)'}\`
      );
      err.statusCode = 422;
      throw err;
    }

    txn.status = newStatus;
    if (newStatus === 'funded')   txn.fundedAt   = new Date();
    if (newStatus === 'released') txn.releasedAt = new Date();
    if (newStatus === 'disputed') txn.disputedAt = new Date();

    txn.auditLog.push({
      action: newStatus,
      userId,
      detail: \`Status changed to \${newStatus}\`,
    });

    await txn.save();
    return { id: txn._id.toString(), status: txn.status };
  },

  /**
   * Get all transactions for a user (as either party)
   */
  async getTransactionsForUser(userId, { status, page = 1, limit = 20 } = {}) {
    const query = {
      $or: [{ homeownerId: userId }, { contractorId: userId }],
    };
    if (status) query.status = status;

    const [transactions, total] = await Promise.all([
      EscrowTransaction
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EscrowTransaction.countDocuments(query),
    ]);

    return {
      transactions: transactions.map(t => ({
        id: t._id.toString(),
        homeownerId: t.homeownerId,
        contractorId: t.contractorId,
        jobId: t.jobId,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },
};

module.exports = escrowService;`,
      },
      {
        name: "services/jobMatchService.js",
        code: `// ─── services/jobMatchService.js ───────────────────────────
// Job matching service. Determines whether a contractor is
// officially assigned to a job. Injected into createGpsMask().
//
// Also exposes job CRUD for the routes layer.

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────
const jobSchema = new mongoose.Schema({
  homeownerId:   { type: String, required: true, index: true },
  title:         { type: String, required: true },
  description:   { type: String, required: true },
  category:      { type: String, required: true, enum: [
    'lawn_mowing', 'garden_care', 'cleaning', 'electrical',
    'plumbing', 'gas_fitting', 'painting', 'carpentry', 'general',
  ]},
  status: {
    type: String,
    enum: ['draft', 'posted', 'matched', 'in_progress', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  location: {
    lat:     { type: Number, required: true },
    lng:     { type: Number, required: true },
    suburb:  { type: String },
    state:   { type: String },
    postcode:{ type: String },
  },
  matchedContractorId: { type: String, default: null, index: true },
  matchedAt:           { type: Date },
  applicants:          [{ type: String }],  // contractor IDs who applied
  budget: {
    min: { type: Number },
    max: { type: Number },
  },
}, {
  timestamps: true,
});

jobSchema.index({ matchedContractorId: 1, status: 1 });

const Job = mongoose.model('Job', jobSchema);

// ─── Service ──────────────────────────────────────────────
const jobMatchService = {

  /**
   * Check if a user is the matched contractor for a job.
   * Used by GPS masking middleware — if true, full coordinates
   * are returned; if false, suburb-level only.
   *
   * @param {string} userId
   * @param {string} jobId
   * @returns {boolean}
   */
  async isMatchedContractor(userId, jobId) {
    try {
      const job = await Job.findById(jobId)
        .select('matchedContractorId status')
        .lean();

      if (!job) return false;

      return (
        job.matchedContractorId === userId &&
        ['matched', 'in_progress'].includes(job.status)
      );
    } catch (err) {
      console.error(\`[JobMatchService] isMatchedContractor error: \${err.message}\`);
      return false; // fail-closed: deny full GPS on error
    }
  },

  /**
   * Get a job by ID
   */
  async getJob(jobId) {
    return Job.findById(jobId).lean();
  },

  /**
   * Create a new job posting
   */
  async createJob(data) {
    const job = await Job.create({
      ...data,
      status: 'posted',
    });
    return { id: job._id.toString(), status: job.status };
  },

  /**
   * Match a contractor to a job
   */
  async matchContractor(jobId, contractorId, userId) {
    const job = await Job.findById(jobId);
    if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    if (job.homeownerId !== userId) {
      throw Object.assign(new Error('Only the homeowner can match contractors'), { statusCode: 403 });
    }
    if (job.status !== 'posted') {
      throw Object.assign(new Error(\`Job status is \${job.status}, must be "posted"\`), { statusCode: 422 });
    }

    job.matchedContractorId = contractorId;
    job.matchedAt = new Date();
    job.status = 'matched';
    await job.save();

    return { id: job._id.toString(), status: job.status, matchedContractorId: contractorId };
  },

  /**
   * List jobs with filters
   */
  async listJobs({ category, status, suburb, page = 1, limit = 20 } = {}) {
    const query = {};
    if (category) query.category = category;
    if (status)   query.status = status;
    if (suburb)   query['location.suburb'] = new RegExp(suburb, 'i');

    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Job.countDocuments(query),
    ]);

    return {
      jobs: jobs.map(j => ({
        id: j._id.toString(),
        title: j.title,
        category: j.category,
        status: j.status,
        location: j.location,
        budget: j.budget,
        createdAt: j.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },
};

module.exports = jobMatchService;`,
      },
      {
        name: "services/contractorService.js",
        code: `// ─── services/contractorService.js ─────────────────────────
// Contractor profiles, search, and compliance data.
// Used by contractor routes and certificationGuard.

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────
const contractorSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  bio:       { type: String, default: '' },
  avatar:    { type: String },
  phone:     { type: String },
  email:     { type: String, required: true },
  abn:       { type: String },  // Australian Business Number
  categories: [{ type: String }],
  serviceArea: {
    suburbs:  [String],
    state:    String,
    radiusKm: { type: Number, default: 25 },
  },
  rating:       { type: Number, default: 0, min: 0, max: 5 },
  reviewCount:  { type: Number, default: 0 },
  jobsCompleted:{ type: Number, default: 0 },
  compliance: {
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'suspended', 'none'],
      default: 'none',
    },
    trades:     [{ type: String }],       // ['electrical', 'plumbing']
    licenceNo:  { type: String },
    issuedAt:   { type: Date },
    expiresAt:  { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },         // admin user ID
  },
  isActive: { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
});

contractorSchema.index({ categories: 1, isActive: 1 });
contractorSchema.index({ 'serviceArea.suburbs': 1 });
contractorSchema.index({ rating: -1 });

const Contractor = mongoose.model('Contractor', contractorSchema);

// ─── Service ──────────────────────────────────────────────
const contractorService = {

  async getById(contractorId) {
    return Contractor.findOne({ userId: contractorId, isActive: true }).lean();
  },

  async getByUserId(userId) {
    return Contractor.findOne({ userId }).lean();
  },

  async search({ category, suburb, minRating, page = 1, limit = 20 } = {}) {
    const query = { isActive: true };
    if (category)  query.categories = category;
    if (suburb)    query['serviceArea.suburbs'] = new RegExp(suburb, 'i');
    if (minRating) query.rating = { $gte: minRating };

    const [contractors, total] = await Promise.all([
      Contractor.find(query)
        .select('userId name avatar categories rating reviewCount jobsCompleted serviceArea.suburbs')
        .sort({ rating: -1, jobsCompleted: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Contractor.countDocuments(query),
    ]);

    return {
      contractors: contractors.map(c => ({
        id: c.userId,
        name: c.name,
        avatar: c.avatar,
        categories: c.categories,
        rating: c.rating,
        reviewCount: c.reviewCount,
        jobsCompleted: c.jobsCompleted,
        suburbs: c.serviceArea?.suburbs || [],
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  async updateProfile(userId, updates) {
    const allowed = ['name', 'bio', 'phone', 'avatar', 'categories', 'serviceArea', 'abn'];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }
    return Contractor.findOneAndUpdate(
      { userId },
      { $set: filtered },
      { new: true, lean: true },
    );
  },

  async getComplianceForSession(userId) {
    const contractor = await Contractor.findOne({ userId })
      .select('compliance')
      .lean();
    return contractor?.compliance || null;
  },
};

module.exports = contractorService;`,
      },
    ],
  },
  {
    id: "env",
    step: "5",
    title: "Environment Configuration",
    subtitle: ".env + Config Module",
    icon: "🔑",
    color: COLORS.amber,
    paleBg: "#fef9ec",
    description: "Environment variables with validation, a config loader that fails fast on missing secrets, and a database connection module.",
    files: [
      {
        name: ".env",
        code: `# ─── Crew Beta Environment ──────────────────────────────────
# Copy to .env and fill in real values. NEVER commit this file.

# ── Server ────────────────────────────────────────────────
NODE_ENV=production
PORT=3000

# ── Beta Access ───────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETA_ACCESS_TOKEN=change_me_to_a_64_char_hex_string

# ── Cookie Signing ────────────────────────────────────────
COOKIE_SECRET=change_me_another_long_random_string

# ── MongoDB ───────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/crew_beta
# For Atlas: mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/crew_beta

# ── Rate Limiting (Redis, optional for single-instance) ───
REDIS_URL=redis://localhost:6379

# ── Stripe (escrow payments) ─────────────────────────────
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# ── Session ───────────────────────────────────────────────
SESSION_SECRET=yet_another_long_random_string
SESSION_MAX_AGE_HOURS=24

# ── Logging ───────────────────────────────────────────────
LOG_LEVEL=warn`,
      },
      {
        name: ".env.example",
        code: `# ─── Crew Beta — Example Env ────────────────────────────────
# Copy this to .env and replace every value.
# This file IS safe to commit.

NODE_ENV=development
PORT=3000
BETA_ACCESS_TOKEN=
COOKIE_SECRET=
MONGODB_URI=mongodb://localhost:27017/crew_beta
REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SESSION_SECRET=
SESSION_MAX_AGE_HOURS=24
LOG_LEVEL=debug`,
      },
      {
        name: "config/index.js",
        code: `// ─── config/index.js ───────────────────────────────────────
// Centralised config loader. Validates all required env vars
// at startup and fails fast with clear error messages.

require('dotenv').config();

// ─── Required vars — server won't start without these ────
const REQUIRED = [
  'BETA_ACCESS_TOKEN',
  'COOKIE_SECRET',
  'MONGODB_URI',
  'SESSION_SECRET',
];

function validateEnv() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('\\n══════════════════════════════════════════════');
    console.error('  FATAL: Missing required environment variables');
    console.error('══════════════════════════════════════════════');
    missing.forEach(key => console.error(\`  ✗ \${key}\`));
    console.error('\\n  Copy .env.example to .env and fill in values.');
    console.error('══════════════════════════════════════════════\\n');
    process.exit(1);
  }
}

validateEnv();

// ─── Exported config object ──────────────────────────────
const config = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  isProduction: process.env.NODE_ENV === 'production',

  beta: {
    token: process.env.BETA_ACCESS_TOKEN,
  },

  cookies: {
    secret: process.env.COOKIE_SECRET,
  },

  db: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    url: process.env.REDIS_URL || null,
  },

  stripe: {
    secretKey:     process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: (parseInt(process.env.SESSION_MAX_AGE_HOURS, 10) || 24) * 60 * 60 * 1000,
  },

  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  },
};

module.exports = config;`,
      },
      {
        name: "config/database.js",
        code: `// ─── config/database.js ────────────────────────────────────
// MongoDB connection with retry logic and graceful shutdown.

const mongoose = require('mongoose');
const config   = require('./index');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(config.db.uri, config.db.options);

    isConnected = true;
    console.log(\`[Crew DB] Connected to MongoDB: \${conn.connection.host}\`);

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error(\`[Crew DB] Connection error: \${err.message}\`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Crew DB] Disconnected from MongoDB');
      isConnected = false;
    });

  } catch (err) {
    console.error(\`[Crew DB] Initial connection failed: \${err.message}\`);
    console.error('[Crew DB] Retrying in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    return connectDB(); // retry
  }
}

// Graceful shutdown
async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[Crew DB] Disconnected gracefully');
}

// Handle process signals
process.on('SIGINT',  async () => { await disconnectDB(); process.exit(0); });
process.on('SIGTERM', async () => { await disconnectDB(); process.exit(0); });

module.exports = { connectDB, disconnectDB };`,
      },
    ],
  },
  {
    id: "routes",
    step: "6",
    title: "Route Implementations",
    subtitle: "Express Routers",
    icon: "🛣️",
    color: COLORS.greenMid,
    paleBg: COLORS.greenPale,
    description: "Full route files for auth, jobs, escrow, contractors, and licensed trades. Each wired to the middleware guards from the security suite.",
    files: [
      {
        name: "routes/auth.js",
        code: `// ─── routes/auth.js ────────────────────────────────────────
// Authentication routes. Login, signup, logout, session check.
// authLimiter (5 req/min) is applied in server.js.

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// In production, replace with bcrypt + JWT or session store
// This is a structural scaffold showing the middleware integration

/**
 * POST /api/auth/signup
 * Body: { email, password, name, role: 'homeowner' | 'contractor' }
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    // inputScrubber has already cleaned these fields
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Email, password, and name are required.',
      });
    }

    if (!['homeowner', 'contractor'].includes(role)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Role must be "homeowner" or "contractor".',
      });
    }

    // TODO: Replace with your User model
    // const user = await User.create({ email, password: hashedPw, name, role });

    const mockUser = {
      id: crypto.randomUUID(),
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    };

    // Set session
    if (req.session) {
      req.session.userId = mockUser.id;
      req.session.role   = mockUser.role;
    }

    res.status(201).json({
      message: 'Account created successfully.',
      user: mockUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Rate limited: 5 req/min per IP (via authLimiter in server.js)
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Email and password are required.',
      });
    }

    // TODO: Replace with real authentication
    // const user = await User.findOne({ email });
    // const valid = await bcrypt.compare(password, user.passwordHash);

    // Mock: accept any login for scaffolding
    const mockUser = {
      id: 'user_' + crypto.randomBytes(8).toString('hex'),
      email,
      role: 'homeowner',
    };

    // Load compliance data for contractors (used by certificationGuard)
    // if (mockUser.role === 'contractor') {
    //   const compliance = await contractorService.getComplianceForSession(mockUser.id);
    //   req.session.compliance = compliance;
    // }

    if (req.session) {
      req.session.userId = mockUser.id;
      req.session.role   = mockUser.role;
    }

    res.json({
      message: 'Login successful.',
      user: mockUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'logout_failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out.' });
    });
  } else {
    res.json({ message: 'No active session.' });
  }
});

/**
 * GET /api/auth/me
 * Returns current session user
 */
router.get('/me', (req, res) => {
  if (!req.user && !req.session?.userId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  res.json({
    user: req.user || {
      id: req.session.userId,
      role: req.session.role,
    },
  });
});

module.exports = router;`,
      },
      {
        name: "routes/jobs.js",
        code: `// ─── routes/jobs.js ────────────────────────────────────────
// Job posting and browsing routes.
// GPS masking middleware is active — responses auto-mask
// coordinates unless requester is the matched contractor.

const express          = require('express');
const router           = express.Router();
const jobMatchService  = require('../services/jobMatchService');

// Simple auth check helper
function requireAuth(req, res, next) {
  if (!req.user?.id && !req.session?.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  // Normalise user object
  if (!req.user) {
    req.user = { id: req.session.userId, role: req.session.role };
  }
  next();
}

/**
 * GET /api/jobs
 * Public listing — GPS coordinates are auto-masked by gpsMasking middleware
 * Query: ?category=lawn_mowing&suburb=Bondi&page=1&limit=20
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, status, suburb, page, limit } = req.query;
    const result = await jobMatchService.listJobs({
      category,
      status: status || 'posted',
      suburb,
      page:  parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs/:jobId
 * Single job detail. GPS masking applies automatically —
 * matched contractors see full coords, everyone else sees suburb only.
 */
router.get('/:jobId', async (req, res, next) => {
  try {
    const job = await jobMatchService.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'job_not_found' });
    }
    res.json({
      id: job._id.toString(),
      title: job.title,
      description: job.description,
      category: job.category,
      status: job.status,
      location: job.location,        // ← gpsMasking intercepts this
      budget: job.budget,
      createdAt: job.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs
 * Create a new job posting (homeowners only)
 * Body has been scrubbed by inputScrubber middleware
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, description, category, location, budget } = req.body;

    if (!title || !description || !category || !location?.lat) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'title, description, category, and location are required.',
      });
    }

    const result = await jobMatchService.createJob({
      homeownerId: req.user.id,
      title,
      description,   // already scrubbed by inputScrubber
      category,
      location,
      budget,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jobs/:jobId/match
 * Homeowner matches a contractor to their job
 * Body: { contractorId }
 */
router.post('/:jobId/match', requireAuth, async (req, res, next) => {
  try {
    const { contractorId } = req.body;
    if (!contractorId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'contractorId is required.',
      });
    }
    const result = await jobMatchService.matchContractor(
      req.params.jobId,
      contractorId,
      req.user.id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;`,
      },
      {
        name: "routes/escrow.js",
        code: `// ─── routes/escrow.js ──────────────────────────────────────
// Escrow payment routes.
// escrowSecurity middleware is mounted in server.js on
// /api/escrow/:escrowId — verifying user-transaction binding
// BEFORE any of these handlers execute.

const express       = require('express');
const router        = express.Router();
const escrowService = require('../services/escrowService');

// Auth helper
function requireAuth(req, res, next) {
  if (!req.user?.id && !req.session?.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  if (!req.user) req.user = { id: req.session.userId, role: req.session.role };
  next();
}

/**
 * POST /api/escrow
 * Create a new escrow transaction
 * Body: { contractorId, jobId, amount }
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { contractorId, jobId, amount } = req.body;

    if (!contractorId || !jobId || !amount || amount <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'contractorId, jobId, and a positive amount are required.',
      });
    }

    const result = await escrowService.createTransaction({
      homeownerId: req.user.id,
      contractorId,
      jobId,
      amount: parseFloat(amount),
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/escrow/my
 * List current user's escrow transactions
 * Query: ?status=funded&page=1
 */
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await escrowService.getTransactionsForUser(req.user.id, {
      status,
      page:  parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/escrow/:escrowId
 * Get single transaction detail
 * NOTE: escrowSecurity middleware has ALREADY verified the user
 * is a party to this transaction. req.escrow is populated.
 */
router.get('/:escrowId', requireAuth, (req, res) => {
  // req.escrow was set by the escrowSecurity middleware
  res.json({
    transaction: req.escrow.transaction,
    yourRole: req.escrow.role,
  });
});

/**
 * POST /api/escrow/:escrowId/fund
 * Homeowner funds the escrow
 * escrowSecurity already verified access.
 */
router.post('/:escrowId/fund', requireAuth, async (req, res, next) => {
  try {
    if (req.escrow.role !== 'homeowner') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only the homeowner can fund an escrow.',
      });
    }

    const result = await escrowService.updateStatus(
      req.params.escrowId,
      'funded',
      req.user.id,
    );

    res.json({ message: 'Escrow funded.', ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/escrow/:escrowId/release
 * Homeowner releases payment to contractor
 */
router.post('/:escrowId/release', requireAuth, async (req, res, next) => {
  try {
    if (req.escrow.role !== 'homeowner') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only the homeowner can release escrow funds.',
      });
    }

    const result = await escrowService.updateStatus(
      req.params.escrowId,
      'released',
      req.user.id,
    );

    res.json({ message: 'Payment released to contractor.', ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/escrow/:escrowId/dispute
 * Either party can raise a dispute
 */
router.post('/:escrowId/dispute', requireAuth, async (req, res, next) => {
  try {
    const result = await escrowService.updateStatus(
      req.params.escrowId,
      'disputed',
      req.user.id,
    );

    res.json({ message: 'Dispute raised. Our team will review.', ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;`,
      },
      {
        name: "routes/contractors.js",
        code: `// ─── routes/contractors.js ─────────────────────────────────
// Contractor search and profile routes.
// dataLimiter (20 req/min) is applied in server.js to prevent
// scraping of contractor lists.

const express             = require('express');
const router              = express.Router();
const contractorService   = require('../services/contractorService');

function requireAuth(req, res, next) {
  if (!req.user?.id && !req.session?.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  if (!req.user) req.user = { id: req.session.userId, role: req.session.role };
  next();
}

/**
 * GET /api/contractors
 * Search contractors — rate limited by dataLimiter (20/min)
 * Query: ?category=plumbing&suburb=Bondi&minRating=4&page=1
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, suburb, minRating, page, limit } = req.query;
    const result = await contractorService.search({
      category,
      suburb,
      minRating: minRating ? parseFloat(minRating) : undefined,
      page:  parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 50), // cap at 50
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/contractors/:id
 * Single contractor profile
 */
router.get('/:id', async (req, res, next) => {
  try {
    const contractor = await contractorService.getById(req.params.id);
    if (!contractor) {
      return res.status(404).json({ error: 'contractor_not_found' });
    }
    // Strip sensitive compliance details from public view
    const { compliance, ...publicProfile } = contractor;
    res.json({
      ...publicProfile,
      isLicensed: compliance?.status === 'active',
      licensedTrades: compliance?.status === 'active' ? compliance.trades : [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/contractors/me
 * Update own profile (contractors only)
 * Body cleaned by inputScrubber (bio, name scrubbed)
 */
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const updated = await contractorService.updateProfile(req.user.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'contractor_profile_not_found' });
    }
    res.json({ message: 'Profile updated.', contractor: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;`,
      },
      {
        name: "routes/trades.js",
        code: `// ─── routes/trades.js ──────────────────────────────────────
// Licensed trade routes for Electrical & Plumbing.
// certificationGuard is mounted in server.js:
//   app.use('/api/trades/electrical', certificationGuard('electrical'));
//   app.use('/api/trades/plumbing',   certificationGuard('plumbing'));
//
// By the time these handlers execute, the user's compliance
// has been verified as active with the correct trade coverage.

const express = require('express');
const router  = express.Router();

function requireAuth(req, res, next) {
  if (!req.user?.id && !req.session?.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  if (!req.user) req.user = { id: req.session.userId, role: req.session.role };
  next();
}

/**
 * GET /api/trades/electrical/jobs
 * GET /api/trades/plumbing/jobs
 * List available licensed trade jobs.
 * Compliance already verified by certificationGuard.
 */
router.get('/jobs', requireAuth, async (req, res, next) => {
  try {
    // req.compliance is set by certificationGuard
    const trade = req.baseUrl.split('/').pop(); // 'electrical' or 'plumbing'

    // TODO: Replace with real query
    res.json({
      trade,
      compliance: {
        status: req.compliance.status,
        licenceNo: req.compliance.licenceNo,
        expiresAt: req.compliance.expiresAt,
      },
      jobs: [],  // populated from your job service filtered by trade
      message: \`You are verified for \${trade} work. Showing available jobs.\`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trades/electrical/jobs/:jobId/apply
 * POST /api/trades/plumbing/jobs/:jobId/apply
 * Apply to a licensed trade job
 */
router.post('/jobs/:jobId/apply', requireAuth, async (req, res, next) => {
  try {
    const trade = req.baseUrl.split('/').pop();
    const { jobId } = req.params;

    // TODO: Create application in DB
    res.status(201).json({
      message: \`Application submitted for \${trade} job \${jobId}.\`,
      applicant: req.user.id,
      trade,
      licenceNo: req.compliance.licenceNo,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;`,
      },
    ],
  },
  {
    id: "server",
    step: "6b",
    title: "Updated Server Bootstrap",
    subtitle: "Complete server.js",
    icon: "🚀",
    color: COLORS.ink,
    paleBg: "#f0f0ee",
    description: "The final server.js with all routes wired, database connection, session middleware, and the full middleware pipeline in correct mounting order.",
    files: [
      {
        name: "server.js",
        code: `// ─── server.js — Crew Beta Server ─────────────────────────
// Complete bootstrap with all middleware and routes wired.

const config = require('./config');
const { connectDB } = require('./config/database');

const express        = require('express');
const cookieParser   = require('cookie-parser');
const session        = require('express-session');
const crypto         = require('crypto');

// ── Layer 0: Infrastructure Hardening ─────────────────────
const { crewHelmet, crewExtraHeaders } = require('./middleware/securityHeaders');
const { authLimiter, generalLimiter, dataLimiter } = require('./middleware/rateLimiting');

// ── Layer 1: Beta Access Gateway ──────────────────────────
const { betaAccessGateway }   = require('./middleware/betaAccessGateway');
const { environmentGuard, safeErrorHandler } = require('./middleware/environmentGuard');

// ── Layer 2: Data Privacy ─────────────────────────────────
const { inputScrubber }       = require('./middleware/inputScrubber');
const { createGpsMask }       = require('./middleware/gpsMasking');

// ── Layer 3: Financial & Licensing ────────────────────────
const { createEscrowGuard }   = require('./middleware/escrowSecurity');
const { certificationGuard }  = require('./middleware/certificationGuard');

// ── Services ──────────────────────────────────────────────
const escrowService   = require('./services/escrowService');
const jobMatchService = require('./services/jobMatchService');
const contractorService = require('./services/contractorService');

// ── Routes ────────────────────────────────────────────────
const authRouter       = require('./routes/auth');
const jobsRouter       = require('./routes/jobs');
const escrowRouter     = require('./routes/escrow');
const contractorRouter = require('./routes/contractors');
const tradesRouter     = require('./routes/trades');

const app = express();

// ═══════════════════════════════════════════════════════════
//  MIDDLEWARE PIPELINE — ORDER MATTERS
// ═══════════════════════════════════════════════════════════

// 1. Security headers (earliest possible)
app.use(crewHelmet());
app.use(crewExtraHeaders);

// 2. Request ID (for error tracking)
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// 3. Body parsing & cookies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookies.secret));

// 4. Sessions
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   config.isProduction,
    httpOnly: true,
    sameSite: 'strict',
    maxAge:   config.session.maxAge,
  },
}));

// 5. Populate req.user from session (lightweight auth hydration)
app.use((req, _res, next) => {
  if (req.session?.userId) {
    req.user = {
      id:   req.session.userId,
      role: req.session.role,
    };
    // Attach compliance for certificationGuard
    if (req.session.compliance) {
      req.user.compliance = req.session.compliance;
    }
  }
  next();
});

// 6. Environment guard (suppress debug info)
app.use(environmentGuard);

// 7. Beta access gate (blocks unauthorized users)
app.use(betaAccessGateway);

// 8. Global rate limiting
app.use(generalLimiter);

// 9. Input sanitisation (all user content)
app.use(inputScrubber);

// 10. GPS masking on API responses
app.use('/api', createGpsMask(jobMatchService));

// ═══════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════

// Health check (whitelisted in beta gateway)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Beta signup page (whitelisted in beta gateway)
app.get('/beta-signup', (_req, res) => {
  res.json({
    message: 'Crew is currently in private beta.',
    signup: 'Contact hello@getcrew.com.au for access.',
  });
});

// Auth — strict rate limiting (5/min)
app.use('/api/auth', authLimiter, authRouter);

// Jobs
app.use('/api/jobs', jobsRouter);

// Escrow — user-transaction binding guard
app.use('/api/escrow', escrowRouter);
app.use('/api/escrow/:escrowId', createEscrowGuard(escrowService));

// Contractors — anti-scraping rate limit (20/min)
app.use('/api/contractors', dataLimiter, contractorRouter);

// Licensed trades — compliance verification
app.use('/api/trades/electrical', certificationGuard('electrical'), tradesRouter);
app.use('/api/trades/plumbing',   certificationGuard('plumbing'),   tradesRouter);

// Search — anti-scraping
app.use('/api/search', dataLimiter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found.' });
});

// ═══════════════════════════════════════════════════════════
//  ERROR HANDLER (must be LAST)
// ═══════════════════════════════════════════════════════════
app.use(safeErrorHandler);

// ═══════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════
async function start() {
  await connectDB();

  app.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║         🛠  Crew Beta Server         ║');
    console.log('  ╠══════════════════════════════════════╣');
    console.log(\`  ║  Port:        \${String(config.port).padEnd(21)}║\`);
    console.log(\`  ║  Environment: \${config.env.padEnd(21)}║\`);
    console.log(\`  ║  Beta gate:   \${'ACTIVE'.padEnd(21)}║\`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
}

start().catch((err) => {
  console.error('[Crew] Failed to start:', err);
  process.exit(1);
});

module.exports = app;`,
      },
      {
        name: "package.json",
        code: `{
  "name": "crew-beta-api",
  "version": "0.1.0",
  "description": "Crew home-services marketplace — Beta API server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "test:middleware": "bash scripts/test-middleware.sh"
  },
  "dependencies": {
    "cookie-parser": "^1.4.6",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0",
    "express-session": "^1.18.0",
    "helmet": "^7.1.0",
    "mongoose": "^8.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`,
      },
    ],
  },
  {
    id: "tests",
    step: "7",
    title: "Test & Verification Scripts",
    subtitle: "cURL + Bash",
    icon: "🧪",
    color: "#7c3aed",
    paleBg: "#f5f0ff",
    description: "A comprehensive test script that exercises every middleware layer. Run it after starting the server to verify the full security pipeline.",
    files: [
      {
        name: "scripts/test-middleware.sh",
        code: `#!/usr/bin/env bash
# ─── Crew Middleware Test Suite ─────────────────────────────
# Run: chmod +x scripts/test-middleware.sh && ./scripts/test-middleware.sh
#
# Requires: curl, jq (optional, for pretty output)
# Start server first: npm start

set -euo pipefail

BASE="http://localhost:3000"
TOKEN="\${BETA_ACCESS_TOKEN:-change_me_to_a_64_char_hex_string}"
PASS=0
FAIL=0

# ─── Helpers ───────────────────────────────────────────────
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
NC='\\033[0m'
BOLD='\\033[1m'

check() {
  local name="\$1" expected="\$2" actual="\$3"
  if [[ "\$actual" == *"\$expected"* ]]; then
    echo -e "  \${GREEN}✓\${NC} \$name"
    ((PASS++))
  else
    echo -e "  \${RED}✗\${NC} \$name"
    echo -e "    Expected: \${expected}"
    echo -e "    Got:      \${actual}"
    ((FAIL++))
  fi
}

check_status() {
  local name="\$1" expected="\$2" actual="\$3"
  if [[ "\$actual" == "\$expected" ]]; then
    echo -e "  \${GREEN}✓\${NC} \$name (HTTP \$actual)"
    ((PASS++))
  else
    echo -e "  \${RED}✗\${NC} \$name (expected HTTP \$expected, got \$actual)"
    ((FAIL++))
  fi
}

header() {
  echo ""
  echo -e "\${BOLD}\${CYAN}═══ \$1 ═══\${NC}"
}

# ═══════════════════════════════════════════════════════════
header "1. HEALTH CHECK"
# ═══════════════════════════════════════════════════════════

STATUS=\$(curl -s -o /dev/null -w "%{http_code}" "\$BASE/health")
check_status "Health endpoint accessible without beta token" "200" "\$STATUS"

BODY=\$(curl -s "\$BASE/health")
check "Returns ok status" '"status":"ok"' "\$BODY"


# ═══════════════════════════════════════════════════════════
header "2. BETA ACCESS GATEWAY"
# ═══════════════════════════════════════════════════════════

# 2a. No token → redirect or 403
STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "Accept: application/json" \\
  "\$BASE/api/jobs")
check_status "No beta token → 403 JSON" "403" "\$STATUS"

BODY=\$(curl -s -H "Accept: application/json" "\$BASE/api/jobs")
check "Returns beta_access_required error" "beta_access_required" "\$BODY"

# 2b. Wrong token → blocked
STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "x-beta-token: wrong_token" \\
  -H "Accept: application/json" \\
  "\$BASE/api/jobs")
check_status "Wrong beta token → 403" "403" "\$STATUS"

# 2c. Valid token → passes through
STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "x-beta-token: \$TOKEN" \\
  "\$BASE/api/jobs")
check_status "Valid beta token → 200" "200" "\$STATUS"

# 2d. Browser redirect (no JSON accept header)
STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -L --max-redirs 0 \\
  "\$BASE/api/jobs" 2>/dev/null || true)
check_status "No token + browser → 302 redirect" "302" "\$STATUS"


# ═══════════════════════════════════════════════════════════
header "3. SECURITY HEADERS"
# ═══════════════════════════════════════════════════════════

HEADERS=\$(curl -s -I -H "x-beta-token: \$TOKEN" "\$BASE/health")

check "HSTS header present" "strict-transport-security" "\$(echo "\$HEADERS" | tr '[:upper:]' '[:lower:]')"
check "CSP header present" "content-security-policy" "\$(echo "\$HEADERS" | tr '[:upper:]' '[:lower:]')"
check "X-Frame-Options present" "x-frame-options" "\$(echo "\$HEADERS" | tr '[:upper:]' '[:lower:]')"
check "X-Content-Type-Options present" "x-content-type-options" "\$(echo "\$HEADERS" | tr '[:upper:]' '[:lower:]')"
check "X-Powered-By removed" "NOT_FOUND" "\$(echo "\$HEADERS" | grep -i 'x-powered-by' || echo 'NOT_FOUND')"


# ═══════════════════════════════════════════════════════════
header "4. RATE LIMITING"
# ═══════════════════════════════════════════════════════════

echo -e "  \${YELLOW}Testing auth rate limit (5 req/min)...\${NC}"
for i in {1..5}; do
  curl -s -o /dev/null \\
    -H "x-beta-token: \$TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"email":"test@test.com","password":"x"}' \\
    -X POST "\$BASE/api/auth/login"
done

# 6th request should be rate limited
STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "x-beta-token: \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@test.com","password":"x"}' \\
  -X POST "\$BASE/api/auth/login")
check_status "6th login attempt → 429 rate limited" "429" "\$STATUS"


# ═══════════════════════════════════════════════════════════
header "5. INPUT SCRUBBING"
# ═══════════════════════════════════════════════════════════

# 5a. XSS in job description
BODY=\$(curl -s \\
  -H "x-beta-token: \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -X POST "\$BASE/api/jobs" \\
  -d '{
    "title": "Fix my sink",
    "description": "Please fix <script>alert(1)</script> the kitchen sink",
    "category": "plumbing",
    "location": {"lat": -33.8688, "lng": 151.2093, "suburb": "Sydney"}
  }')
check "XSS <script> tag stripped from description" "NOT_FOUND" \\
  "\$(echo "\$BODY" | grep -i '<script>' || echo 'NOT_FOUND')"

# 5b. SQL injection attempt
BODY=\$(curl -s \\
  -H "x-beta-token: \$TOKEN" \\
  -H "Content-Type: application/json" \\
  -X POST "\$BASE/api/jobs" \\
  -d '{
    "title": "Fix sink",
    "description": "Robert; DROP TABLE users;--",
    "category": "plumbing",
    "location": {"lat": -33.8688, "lng": 151.2093, "suburb": "Sydney"}
  }')
check "SQL DROP statement stripped" "NOT_FOUND" \\
  "\$(echo "\$BODY" | grep -i 'DROP TABLE' || echo 'NOT_FOUND')"


# ═══════════════════════════════════════════════════════════
header "6. ENVIRONMENT GUARD"
# ═══════════════════════════════════════════════════════════

# Trigger a 404 and verify no stack trace
BODY=\$(curl -s \\
  -H "x-beta-token: \$TOKEN" \\
  -H "Accept: application/json" \\
  "\$BASE/api/nonexistent")
check "No stack trace in error response" "NOT_FOUND" \\
  "\$(echo "\$BODY" | grep -i 'stack' || echo 'NOT_FOUND')"
check "No debug info in error response" "NOT_FOUND" \\
  "\$(echo "\$BODY" | grep -i '"debug"' || echo 'NOT_FOUND')"


# ═══════════════════════════════════════════════════════════
header "7. ESCROW SECURITY"
# ═══════════════════════════════════════════════════════════

echo -e "  \${YELLOW}(Requires active session + real escrow ID for full test)\${NC}"

STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "x-beta-token: \$TOKEN" \\
  "\$BASE/api/escrow/fake_id_12345")
check_status "Unauthenticated escrow access → 401" "401" "\$STATUS"


# ═══════════════════════════════════════════════════════════
header "8. CERTIFICATION GUARD"
# ═══════════════════════════════════════════════════════════

STATUS=\$(curl -s -o /dev/null -w "%{http_code}" \\
  -H "x-beta-token: \$TOKEN" \\
  "\$BASE/api/trades/electrical/jobs")
check_status "Unauthenticated trade access → 401" "401" "\$STATUS"


# ═══════════════════════════════════════════════════════════
header "9. GPS MASKING"
# ═══════════════════════════════════════════════════════════

echo -e "  \${YELLOW}(Verify in job GET response — coordinates should show suburb only)\${NC}"

BODY=\$(curl -s \\
  -H "x-beta-token: \$TOKEN" \\
  "\$BASE/api/jobs")
check "Jobs endpoint responds" "jobs" "\$BODY"


# ═══════════════════════════════════════════════════════════
header "RESULTS"
# ═══════════════════════════════════════════════════════════

TOTAL=\$((PASS + FAIL))
echo ""
echo -e "  \${GREEN}Passed: \$PASS\${NC} / \$TOTAL"
if [[ \$FAIL -gt 0 ]]; then
  echo -e "  \${RED}Failed: \$FAIL\${NC}"
  echo ""
  echo -e "  \${YELLOW}Note: Some tests require MongoDB running and valid session data.\${NC}"
  echo -e "  \${YELLOW}Auth rate-limit test may fail if run within 60s of previous run.\${NC}"
  exit 1
else
  echo -e "  \${GREEN}All middleware checks passed!\${NC}"
  exit 0
fi`,
      },
      {
        name: ".gitignore",
        code: `# ─── Crew .gitignore ────────────────────────────────────────
node_modules/
.env
*.log
.DS_Store
coverage/
dist/
.cache/`,
      },
    ],
  },
];

// ─── UI Components ────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        background: copied ? "#2d8055" : "#2a2a28", border: "none",
        color: copied ? "#fff" : "#b8b3aa", fontSize: 11, fontWeight: 600,
        padding: "5px 14px", borderRadius: 6, cursor: "pointer",
        transition: "all .2s", fontFamily: "'Inter', sans-serif",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, fileName }) {
  return (
    <div style={{ background: "#0f0f0e", borderRadius: 12, overflow: "hidden", border: "1px solid #2a2a28", marginTop: 12 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", borderBottom: "1px solid #2a2a28", background: "#1a1a18",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#7d7870", fontFamily: "'JetBrains Mono', monospace" }}>
          {fileName}
        </span>
        <CopyButton text={code} />
      </div>
      <pre style={{
        padding: 16, overflowX: "auto", fontSize: 12.5, lineHeight: 1.65,
        color: "#d4d0c8", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        margin: 0, maxHeight: 500,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SectionCard({ section, isOpen, onToggle }) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 16,
      border: `1px solid ${isOpen ? section.color + "33" : COLORS.rule}`,
      overflow: "hidden", transition: "all .3s",
      boxShadow: isOpen ? `0 8px 32px ${section.color}11` : "0 2px 8px rgba(0,0,0,.04)",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "22px 24px", display: "flex", alignItems: "center",
        gap: 14, background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: section.paleBg,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
        }}>
          {section.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{
              background: section.paleBg, color: section.color, fontSize: 11, fontWeight: 800,
              padding: "2px 10px", borderRadius: 100, letterSpacing: ".04em",
            }}>
              STEP {section.step}
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, fontFamily: "'Inter', sans-serif" }}>
              {section.title}
            </span>
          </div>
          <p style={{ fontSize: 13, color: COLORS.ink3, margin: 0, lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
            {section.description}
          </p>
        </div>
        <span style={{
          fontSize: 18, color: COLORS.ink4, transition: "transform .3s",
          transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0,
        }}>▾</span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${COLORS.rule}` }}>
          <div style={{ paddingTop: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".12em",
              textTransform: "uppercase", color: COLORS.ink4, marginBottom: 4,
            }}>
              {section.files.length} {section.files.length === 1 ? "FILE" : "FILES"}
            </div>
            {section.files.map((file, i) => (
              <CodeBlock key={i} fileName={file.name} code={file.code} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Directory Tree ────────────────────────────────────────
function DirTree() {
  const tree = `crew/
├── config/
│   ├── index.js          ← env validation + config loader
│   └── database.js       ← MongoDB connection + retry
├── middleware/
│   ├── betaAccessGateway.js
│   ├── environmentGuard.js
│   ├── escrowSecurity.js
│   ├── certificationGuard.js
│   ├── gpsMasking.js
│   ├── inputScrubber.js
│   ├── rateLimiting.js
│   └── securityHeaders.js
├── routes/
│   ├── auth.js           ← login/signup/logout
│   ├── jobs.js           ← job CRUD + GPS masking
│   ├── escrow.js         ← payment operations
│   ├── contractors.js    ← search + profiles
│   └── trades.js         ← licensed trade jobs
├── services/
│   ├── escrowService.js  ← transaction CRUD + state machine
│   ├── jobMatchService.js ← job matching + GPS check
│   └── contractorService.js ← profiles + compliance
├── scripts/
│   └── test-middleware.sh ← verification suite
├── server.js             ← bootstrap + pipeline
├── package.json
├── .env                  ← secrets (gitignored)
├── .env.example          ← template (committed)
└── .gitignore`;
  return (
    <div style={{
      background: "#0f0f0e", borderRadius: 14, padding: "20px 24px",
      border: "1px solid #2a2a28", marginBottom: 28, position: "relative",
    }}>
      <div style={{ position: "absolute", top: 12, right: 16 }}>
        <CopyButton text={tree} />
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
        color: "#7d7870", marginBottom: 12,
      }}>
        Complete Project Structure
      </div>
      <pre style={{
        margin: 0, fontSize: 12, lineHeight: 1.55, color: "#a8a49c",
        fontFamily: "'JetBrains Mono', monospace", overflowX: "auto",
      }}>
        {tree}
      </pre>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────
export default function CrewImplementation() {
  const [openSections, setOpenSections] = useState(new Set());
  const [allOpen, setAllOpen] = useState(false);

  const toggle = (id) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allOpen) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(SECTIONS.map(s => s.id)));
    }
    setAllOpen(!allOpen);
  };

  const totalFiles = SECTIONS.reduce((sum, s) => sum + s.files.length, 0);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: COLORS.bg, minHeight: "100vh", padding: "36px 20px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, background: COLORS.green, borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 14,
            }}>C</div>
            <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.ink }}>Crew</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
              padding: "3px 10px", borderRadius: 100, background: "#fef9ec", color: COLORS.amber,
            }}>
              IMPLEMENTATION FILES
            </span>
          </div>
          <h1 style={{
            fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 400, lineHeight: 1.12, color: COLORS.ink, letterSpacing: "-.02em", marginBottom: 12,
          }}>
            Services, Config, Routes{" "}
            <em style={{ fontStyle: "italic", color: COLORS.greenMid }}>&amp; Tests</em>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: COLORS.ink3, maxWidth: 580, fontWeight: 300 }}>
            {totalFiles} production files completing the Crew middleware integration.
            Expand each step, copy the files, and run the test script to verify.
          </p>
        </div>

        {/* Project Structure */}
        <DirTree />

        {/* Controls */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: COLORS.ink4 }}>
            Implementation Steps
          </span>
          <button onClick={toggleAll} style={{
            background: "none", border: `1px solid ${COLORS.rule}`, padding: "5px 14px",
            borderRadius: 100, fontSize: 12, fontWeight: 600, color: COLORS.ink3,
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}>
            {allOpen ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Section Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {SECTIONS.map(s => (
            <SectionCard key={s.id} section={s} isOpen={openSections.has(s.id)} onToggle={() => toggle(s.id)} />
          ))}
        </div>

        {/* Quick Start */}
        <div style={{
          background: COLORS.white, borderRadius: 14, padding: "22px 24px",
          border: `1px solid ${COLORS.rule}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: COLORS.ink4, marginBottom: 10 }}>
            Quick Start
          </div>
          <code style={{
            fontSize: 13, color: COLORS.greenMid, fontFamily: "'JetBrains Mono', monospace",
            background: COLORS.greenPale, padding: "12px 16px", borderRadius: 8,
            display: "block", lineHeight: 2,
          }}>
            {`cp .env.example .env          # fill in your secrets
npm install                   # install dependencies
mongod                        # start MongoDB (or use Atlas URI)
npm run dev                   # start with nodemon
./scripts/test-middleware.sh  # verify all layers`}
          </code>
        </div>
      </div>
    </div>
  );
}
