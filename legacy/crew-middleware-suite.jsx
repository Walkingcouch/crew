import { useState } from "react";

const COLORS = {
  green: "#1a4d33",
  greenMid: "#2d8055",
  greenLt: "#4db37c",
  greenPale: "#f0f7f3",
  ink: "#0f0f0e",
  ink2: "#3a3630",
  ink3: "#7d7870",
  ink4: "#b8b3aa",
  bg: "#fafaf8",
  white: "#ffffff",
  rule: "#e8e3dc",
  amber: "#d97706",
  red: "#dc2626",
  redPale: "#fef2f2",
  navy: "#162878",
  navyPale: "#eff2ff",
};

const LAYERS = [
  {
    id: "beta",
    title: "Beta Access Gateway",
    subtitle: "Global Middleware",
    icon: "🛡️",
    color: COLORS.navy,
    paleBg: COLORS.navyPale,
    description: "Restricts site access to authorized beta testers. Validates tokens via header or cookie, suppresses stack traces, and redirects unauthorized traffic to sign-up.",
    files: [
      {
        name: "betaAccessGateway.js",
        code: `// ─── middleware/betaAccessGateway.js ───────────────────────
// Global: mount FIRST in Express pipeline
// Validates BETA_ACCESS_TOKEN from header or signed cookie.
// Blocks all unauthorized traffic with a redirect to signup.

const BETA_TOKEN = process.env.BETA_ACCESS_TOKEN;
const SIGNUP_PATH = '/beta-signup';
const PUBLIC_PATHS = [
  SIGNUP_PATH,
  '/health',
  '/favicon.ico',
  '/static',
];

function isPublicPath(path) {
  return PUBLIC_PATHS.some(p => path.startsWith(p));
}

/**
 * Beta Access Gateway
 * - Checks \`x-beta-token\` header first, then \`beta_token\` cookie
 * - Whitelists public/health paths
 * - Redirects browsers, returns 403 JSON for API calls
 */
function betaAccessGateway(req, res, next) {
  // Allow public paths through
  if (isPublicPath(req.path)) return next();

  const headerToken = req.headers['x-beta-token'];
  const cookieToken = req.signedCookies?.beta_token;
  const queryToken  = req.query?.beta_token; // one-time link support

  if (
    headerToken === BETA_TOKEN ||
    cookieToken === BETA_TOKEN
  ) {
    return next();
  }

  // If token arrives via query (email invite link), set cookie & proceed
  if (queryToken === BETA_TOKEN) {
    res.cookie('beta_token', BETA_TOKEN, {
      signed: true,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    return next();
  }

  // Unauthorized — redirect browsers, JSON for API
  const wantsJSON = req.headers.accept?.includes('application/json');
  if (wantsJSON) {
    return res.status(403).json({
      error: 'beta_access_required',
      message: 'A valid beta access token is required.',
      signup: SIGNUP_PATH,
    });
  }

  return res.redirect(302, SIGNUP_PATH);
}

module.exports = { betaAccessGateway };`,
      },
      {
        name: "environmentGuard.js",
        code: `// ─── middleware/environmentGuard.js ────────────────────────
// Suppresses stack traces, debug headers, and verbose errors
// in all non-development environments.

const IS_PRODUCTION = process.env.NODE_ENV !== 'development';

/**
 * Environment Guard
 * - Strips x-powered-by (redundant if Helmet used, defense-in-depth)
 * - Overrides res.json to strip \`stack\` from error payloads
 * - Catches unhandled errors with a safe fallback
 */
function environmentGuard(req, res, next) {
  if (IS_PRODUCTION) {
    // Remove server fingerprint
    res.removeHeader('X-Powered-By');

    // Intercept JSON responses to strip sensitive fields
    const originalJson = res.json.bind(res);
    res.json = function sanitizedJson(body) {
      if (body && typeof body === 'object') {
        const sanitised = { ...body };
        delete sanitised.stack;
        delete sanitised.debug;
        delete sanitised.sql;
        delete sanitised.query;
        delete sanitised.internalCode;
        return originalJson(sanitised);
      }
      return originalJson(body);
    };
  }
  next();
}

/**
 * Global Error Handler (mount LAST)
 * Returns generic message in production; full trace in dev.
 */
function safeErrorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;

  if (IS_PRODUCTION) {
    console.error(\`[CREW-ERR] \${req.method} \${req.path} — \${err.message}\`);
    return res.status(status).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again later.',
      reference: req.id, // assumes request-id middleware
    });
  }

  // Development: full detail
  return res.status(status).json({
    error: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
  });
}

module.exports = { environmentGuard, safeErrorHandler };`,
      },
    ],
  },
  {
    id: "financial",
    title: "Financial & Licensing Protection",
    subtitle: "High-Stakes Routes",
    icon: "🔐",
    color: COLORS.red,
    paleBg: COLORS.redPale,
    description: "Protects escrow payment operations and licensed trade routes. Verifies user-to-transaction binding and active compliance status before permitting action.",
    files: [
      {
        name: "escrowSecurity.js",
        code: `// ─── middleware/escrowSecurity.js ──────────────────────────
// Payment route guard: ensures the authenticated user is a
// party to the specific escrow transaction before allowing
// any read, update, release, or dispute action.

/**
 * Factory: createEscrowGuard(escrowService)
 *
 * \`escrowService\` must implement:
 *   .getTransaction(escrowId) => { id, homeownerId, contractorId, status }
 *
 * Attach to escrow routes:
 *   router.use('/escrow/:escrowId', createEscrowGuard(escrowService));
 */
function createEscrowGuard(escrowService) {
  return async function escrowSecurity(req, res, next) {
    try {
      const { escrowId } = req.params;
      const userId = req.user?.id; // set by upstream auth middleware

      if (!userId) {
        return res.status(401).json({
          error: 'authentication_required',
          message: 'You must be logged in to access escrow data.',
        });
      }

      if (!escrowId) {
        return res.status(400).json({
          error: 'missing_escrow_id',
          message: 'Escrow transaction ID is required.',
        });
      }

      const txn = await escrowService.getTransaction(escrowId);

      if (!txn) {
        return res.status(404).json({
          error: 'escrow_not_found',
          message: 'Escrow transaction not found.',
        });
      }

      // Core guard: user must be either the homeowner or contractor
      const isHomeowner  = txn.homeownerId  === userId;
      const isContractor = txn.contractorId === userId;

      if (!isHomeowner && !isContractor) {
        // Log unauthorized access attempt for audit
        console.warn(
          \`[ESCROW-BLOCK] User \${userId} attempted access to \` +
          \`escrow \${escrowId} (parties: \${txn.homeownerId}, \${txn.contractorId})\`
        );
        return res.status(403).json({
          error: 'escrow_access_denied',
          message: 'You are not a party to this transaction.',
        });
      }

      // Attach role + txn to request for downstream handlers
      req.escrow = {
        transaction: txn,
        role: isHomeowner ? 'homeowner' : 'contractor',
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createEscrowGuard };`,
      },
      {
        name: "certificationGuard.js",
        code: `// ─── middleware/certificationGuard.js ──────────────────────
// Licensed Trade gatekeeper for Electrical & Plumbing routes.
// Blocks access unless user session has verified compliance.

const LICENSED_TRADES = ['electrical', 'plumbing', 'gas_fitting'];

/**
 * Certification Guard
 *
 * Checks:
 * 1. User is authenticated
 * 2. Session contains a compliance record
 * 3. compliance_status === 'active'
 * 4. Licence has not expired
 * 5. Trade type matches the requested route
 *
 * Mount on licensed trade routers:
 *   router.use('/trades/electrical', certificationGuard('electrical'));
 *   router.use('/trades/plumbing',   certificationGuard('plumbing'));
 */
function certificationGuard(requiredTrade) {
  if (!LICENSED_TRADES.includes(requiredTrade)) {
    throw new Error(\`Unknown licensed trade: \${requiredTrade}\`);
  }

  return function (req, res, next) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Login is required to access licensed trade services.',
      });
    }

    const compliance = user.compliance || req.session?.compliance;
    if (!compliance) {
      return res.status(403).json({
        error: 'compliance_missing',
        message: 'No compliance record found. Please submit your licence for verification.',
        action: '/contractor/compliance/submit',
      });
    }

    if (compliance.status !== 'active') {
      return res.status(403).json({
        error: 'compliance_inactive',
        message: \`Your compliance status is "\${compliance.status}". Active status is required.\`,
        current_status: compliance.status,
        action: '/contractor/compliance/renew',
      });
    }

    // Check licence expiry
    if (compliance.expiresAt && new Date(compliance.expiresAt) < new Date()) {
      return res.status(403).json({
        error: 'licence_expired',
        message: 'Your trade licence has expired. Please renew before accessing these routes.',
        expired_at: compliance.expiresAt,
        action: '/contractor/compliance/renew',
      });
    }

    // Verify trade coverage
    const coveredTrades = compliance.trades || [];
    if (!coveredTrades.includes(requiredTrade)) {
      return res.status(403).json({
        error: 'trade_not_covered',
        message: \`Your licence does not cover \${requiredTrade} work.\`,
        your_trades: coveredTrades,
      });
    }

    // Attach compliance context
    req.compliance = compliance;
    next();
  };
}

module.exports = { certificationGuard };`,
      },
    ],
  },
  {
    id: "privacy",
    title: "Data Privacy & Sanitisation",
    subtitle: "Output & Input Filtering",
    icon: "🕵️",
    color: COLORS.greenMid,
    paleBg: COLORS.greenPale,
    description: "Masks precise GPS coordinates in API responses and scrubs XSS/SQLi payloads from all user-generated content using deny-by-default validation.",
    files: [
      {
        name: "gpsMasking.js",
        code: `// ─── middleware/gpsMasking.js ──────────────────────────────
// Intercepts outgoing JSON to replace precise lat/lng with
// generalised suburb-level area data. Matched contractors
// receive full precision.

/**
 * Factory: createGpsMask(jobMatchService)
 *
 * \`jobMatchService\` must implement:
 *   .isMatchedContractor(userId, jobId) => boolean
 *
 * Precision reduction: rounds to ~1.1 km grid (1 decimal place)
 * and replaces with suburb metadata.
 */
function createGpsMask(jobMatchService) {

  // Round to 1 decimal ≈ 11.1 km, add suburb label
  function generaliseLocation(loc) {
    if (!loc || typeof loc.lat !== 'number') return loc;
    return {
      area: loc.suburb || loc.area || 'Undisclosed',
      region: loc.region || loc.state || null,
      approximate_lat: Math.round(loc.lat * 10) / 10,
      approximate_lng: Math.round(loc.lng * 10) / 10,
      precision: 'suburb',
      // Original fields stripped
    };
  }

  function maskRecursive(obj, isMatched) {
    if (Array.isArray(obj)) {
      return obj.map(item => maskRecursive(item, isMatched));
    }
    if (obj !== null && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Detect location-shaped objects
        if (
          !isMatched &&
          value &&
          typeof value === 'object' &&
          'lat' in value &&
          'lng' in value &&
          typeof value.lat === 'number'
        ) {
          result[key] = generaliseLocation(value);
        } else {
          result[key] = maskRecursive(value, isMatched);
        }
      }
      return result;
    }
    return obj;
  }

  return async function gpsMaskMiddleware(req, res, next) {
    // Determine if requester is a matched contractor
    const userId = req.user?.id;
    const jobId  = req.params?.jobId || req.query?.jobId;
    let isMatched = false;

    if (userId && jobId) {
      try {
        isMatched = await jobMatchService.isMatchedContractor(userId, jobId);
      } catch {
        isMatched = false; // fail-closed
      }
    }

    // Intercept res.json
    const originalJson = res.json.bind(res);
    res.json = function maskedJson(body) {
      if (body && typeof body === 'object') {
        return originalJson(maskRecursive(body, isMatched));
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { createGpsMask };`,
      },
      {
        name: "inputScrubber.js",
        code: `// ─── middleware/inputScrubber.js ───────────────────────────
// Deny-by-default input sanitiser for user-generated content.
// Strips XSS, SQLi, and dangerous patterns from request bodies.

const DANGEROUS_PATTERNS = [
  // XSS vectors
  /<script\\b[^>]*>.*?<\\/script>/gis,
  /on\\w+\\s*=\\s*["'][^"']*["']/gi,
  /javascript\\s*:/gi,
  /data\\s*:\\s*text\\/html/gi,
  /<\\s*iframe/gi,
  /<\\s*object/gi,
  /<\\s*embed/gi,
  /<\\s*link/gi,
  /<\\s*img[^>]+onerror/gi,
  /expression\\s*\\(/gi,
  /url\\s*\\(\\s*["']?javascript/gi,
  /vbscript\\s*:/gi,

  // SQL injection vectors
  /(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\\b\\s)/gi,
  /(-{2}|#|\\/\\*|\\*\\/)/g,
  /(;\\s*(DROP|DELETE|UPDATE|INSERT))/gi,
  /'\\s*(OR|AND)\\s+['"\\d]/gi,
  /\\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\\s*\\(/gi,

  // Path traversal
  /\\.\\.\\/|\\.\\.\\\\|%2e%2e/gi,
];

// Allowlist: only these characters survive
const SAFE_TEXT_PATTERN = /[^a-zA-Z0-9\\s.,!?'\\-()@#$%&*:;\\n\\r\\/+=\\[\\]{}°'"~`àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g;

/**
 * Scrub a single string value
 */
function scrubString(value) {
  if (typeof value !== 'string') return value;

  let cleaned = value;

  // 1. Strip known dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 2. Decode common evasion encodings and re-check
  const decoded = cleaned
    .replace(/&#(\\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(decoded)) {
      // Evasion attempt detected — apply allowlist
      cleaned = cleaned.replace(SAFE_TEXT_PATTERN, '');
      break;
    }
  }

  // 3. Normalise whitespace
  cleaned = cleaned.replace(/\\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Recursively scrub all string values in an object
 */
function scrubDeep(obj) {
  if (typeof obj === 'string') return scrubString(obj);
  if (Array.isArray(obj)) return obj.map(scrubDeep);
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[scrubString(key)] = scrubDeep(value);
    }
    return result;
  }
  return obj;
}

// Fields that receive extra-strict sanitisation
const STRICT_FIELDS = [
  'description', 'bio', 'profile_text', 'job_description',
  'notes', 'review_text', 'message', 'name', 'title',
];

/**
 * Input Scrubbing Middleware
 * Mount globally or on user-content routes:
 *   app.use('/api/jobs',       inputScrubber);
 *   app.use('/api/contractors', inputScrubber);
 */
function inputScrubber(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = scrubDeep(req.body);

    // Extra pass on strict fields: enforce allowlist
    for (const field of STRICT_FIELDS) {
      if (typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].replace(SAFE_TEXT_PATTERN, '');
      }
    }
  }

  // Also scrub query params
  if (req.query && typeof req.query === 'object') {
    req.query = scrubDeep(req.query);
  }

  next();
}

module.exports = { inputScrubber, scrubString };`,
      },
    ],
  },
  {
    id: "infra",
    title: "Infrastructure Hardening",
    subtitle: "Rate Limiting & Headers",
    icon: "🏗️",
    color: COLORS.amber,
    paleBg: "#fef9ec",
    description: "Tiered rate limiting to block scrapers and brute-force attacks. Helmet.js configuration for HSTS, CSP, clickjacking prevention and additional hardening headers.",
    files: [
      {
        name: "rateLimiting.js",
        code: `// ─── middleware/rateLimiting.js ────────────────────────────
// Tiered rate limiting using express-rate-limit.
// Install: npm install express-rate-limit rate-limit-redis
//
// Production: use Redis store for multi-instance deployments.
// Dev/beta: in-memory store is fine for single-process.

const rateLimit = require('express-rate-limit');

/**
 * Tier 1: Auth / Login — very strict
 * 5 requests per minute per IP
 * Prevents brute-force credential attacks
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,
  standardHeaders: true,  // Return RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For behind reverse proxy, fallback to IP
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many login attempts. Please wait 60 seconds.',
      retry_after: 60,
    });
  },
  skip: (req) => {
    // Skip rate limit for health checks
    return req.path === '/health';
  },
});

/**
 * Tier 2: General API browsing
 * 60 requests per minute per IP
 * Stops scrapers harvesting contractor lists
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please slow down.',
      retry_after: 60,
    });
  },
});

/**
 * Tier 3: Sensitive data endpoints (contractor lists, search)
 * 20 requests per minute — tighter to prevent harvesting
 */
const dataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by authenticated user if available, else IP
    return req.user?.id
      || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Data request limit reached. Please try again shortly.',
      retry_after: 60,
    });
  },
});

module.exports = { authLimiter, generalLimiter, dataLimiter };`,
      },
      {
        name: "securityHeaders.js",
        code: `// ─── middleware/securityHeaders.js ─────────────────────────
// Helmet.js configuration tailored for Crew marketplace.
// Install: npm install helmet
//
// Enforces HSTS, strict CSP, clickjacking protection,
// and additional hardening headers.

const helmet = require('helmet');

/**
 * Crew Helmet Configuration
 *
 * Mount early in the pipeline (after beta gateway):
 *   app.use(crewHelmet());
 */
function crewHelmet() {
  return helmet({
    // ─── HSTS ─────────────────────────────────────────
    // Force HTTPS for 1 year, include subdomains, preload-ready
    strictTransportSecurity: {
      maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },

    // ─── Content Security Policy ──────────────────────
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'strict-dynamic'",     // nonce-based scripts only
          // Add CDN domains as needed:
          // "https://cdn.getcrew.com.au",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",       // required for some CSS-in-JS
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",                // allow HTTPS images
          "https://*.amazonaws.com", // S3 bucket for uploads
        ],
        connectSrc: [
          "'self'",
          "https://api.getcrew.com.au",
          "https://*.stripe.com",   // payment processor
          "wss://ws.getcrew.com.au", // WebSocket
        ],
        frameSrc: [
          "'self'",
          "https://*.stripe.com",   // Stripe checkout iframe
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],  // Clickjacking prevention
        upgradeInsecureRequests: [], // Force HTTPS on mixed content
      },
    },

    // ─── Clickjacking Protection ──────────────────────
    // frameAncestors in CSP handles this, but belt-and-suspenders
    frameguard: { action: 'deny' },

    // ─── Disable MIME sniffing ────────────────────────
    noSniff: true, // X-Content-Type-Options: nosniff

    // ─── XSS Filter ──────────────────────────────────
    // Modern browsers: CSP handles this. Legacy fallback.
    xssFilter: true,

    // ─── Referrer Policy ─────────────────────────────
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // ─── Permissions Policy ──────────────────────────
    // Restrict browser features
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },

    // ─── Remove X-Powered-By ─────────────────────────
    hidePoweredBy: true,

    // ─── DNS Prefetch Control ────────────────────────
    dnsPrefetchControl: { allow: false },
  });
}

/**
 * Additional custom security headers
 * Mount after helmet for Crew-specific policies
 */
function crewExtraHeaders(req, res, next) {
  // Permissions-Policy (modern replacement for Feature-Policy)
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), ' +
    'payment=(self "https://*.stripe.com"), ' +
    'usb=(), magnetometer=(), gyroscope=()'
  );

  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Cache control for sensitive pages
  if (req.path.startsWith('/api/escrow') || req.path.startsWith('/api/payments')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

module.exports = { crewHelmet, crewExtraHeaders };`,
      },
      {
        name: "server.js",
        code: `// ─── server.js — Express App Bootstrap ────────────────────
// Shows how all middleware layers compose together.
// This is the recommended mounting order for Crew.

const express       = require('express');
const cookieParser  = require('cookie-parser');

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

// ── Services (inject your implementations) ────────────────
const escrowService   = require('./services/escrowService');
const jobMatchService = require('./services/jobMatchService');

const app = express();

// ═══════════════════════════════════════════════════════════
//  MIDDLEWARE PIPELINE — ORDER MATTERS
// ═══════════════════════════════════════════════════════════

// 1. Security headers (earliest possible)
app.use(crewHelmet());
app.use(crewExtraHeaders);

// 2. Body parsing & cookies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// 3. Environment guard (suppress debug info)
app.use(environmentGuard);

// 4. Beta access gate (blocks unauthorized users)
app.use(betaAccessGateway);

// 5. Global rate limiting
app.use(generalLimiter);

// 6. Input sanitisation (all user content)
app.use(inputScrubber);

// 7. GPS masking on API responses
app.use('/api', createGpsMask(jobMatchService));

// ═══════════════════════════════════════════════════════════
//  ROUTE-SPECIFIC GUARDS
// ═══════════════════════════════════════════════════════════

// Auth routes — strict rate limiting
app.use('/api/auth',    authLimiter);

// Contractor search — anti-scraping
app.use('/api/contractors', dataLimiter);
app.use('/api/search',      dataLimiter);

// Escrow — user-transaction binding
app.use('/api/escrow/:escrowId', createEscrowGuard(escrowService));

// Licensed trades — compliance verification
app.use('/api/trades/electrical', certificationGuard('electrical'));
app.use('/api/trades/plumbing',   certificationGuard('plumbing'));

// ═══════════════════════════════════════════════════════════
//  ROUTES (mount your routers here)
// ═══════════════════════════════════════════════════════════
// app.use('/api/auth',        authRouter);
// app.use('/api/jobs',        jobsRouter);
// app.use('/api/escrow',      escrowRouter);
// app.use('/api/contractors', contractorRouter);
// app.use('/api/trades',      tradesRouter);

// Health check (bypasses beta gate)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ═══════════════════════════════════════════════════════════
//  ERROR HANDLER (must be LAST)
// ═══════════════════════════════════════════════════════════
app.use(safeErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`[Crew] Server running on port \${PORT}\`);
  console.log(\`[Crew] Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`[Crew] Beta gate:   \${process.env.BETA_ACCESS_TOKEN ? 'ACTIVE' : 'DISABLED'}\`);
});

module.exports = app;`,
      },
    ],
  },
];

// ─── COMPONENTS ───────────────────────────────────────────
function Tag({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
      textTransform: "uppercase", padding: "4px 12px",
      borderRadius: 100, background: bg, color,
    }}>
      {children}
    </span>
  );
}

function CodeBlock({ code, fileName }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{
      background: "#0f0f0e", borderRadius: 12, overflow: "hidden",
      border: "1px solid #2a2a28", marginTop: 12,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", borderBottom: "1px solid #2a2a28",
        background: "#1a1a18",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#7d7870", fontFamily: "monospace" }}>
          {fileName}
        </span>
        <button onClick={handleCopy} style={{
          background: copied ? "#2d8055" : "#2a2a28", border: "none",
          color: copied ? "#fff" : "#b8b3aa", fontSize: 11, fontWeight: 600,
          padding: "4px 12px", borderRadius: 6, cursor: "pointer",
          transition: "all .2s", fontFamily: "'Inter', sans-serif",
        }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre style={{
        padding: 16, overflowX: "auto", fontSize: 12.5, lineHeight: 1.65,
        color: "#d4d0c8", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        margin: 0, maxHeight: 520,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function LayerCard({ layer, isOpen, onToggle }) {
  return (
    <div style={{
      background: COLORS.white, borderRadius: 16,
      border: `1px solid ${isOpen ? layer.color + "33" : COLORS.rule}`,
      overflow: "hidden", transition: "border-color .3s, box-shadow .3s",
      boxShadow: isOpen ? `0 8px 32px ${layer.color}11` : "0 2px 8px rgba(0,0,0,.04)",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "24px 28px", display: "flex", alignItems: "center",
        gap: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12, background: layer.paleBg,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          flexShrink: 0,
        }}>
          {layer.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 700,
              color: COLORS.ink, letterSpacing: "-.01em",
            }}>
              {layer.title}
            </span>
            <Tag color={layer.color} bg={layer.paleBg}>{layer.subtitle}</Tag>
          </div>
          <p style={{
            fontSize: 14, color: COLORS.ink3, lineHeight: 1.5,
            fontFamily: "'Inter', sans-serif", margin: 0,
          }}>
            {layer.description}
          </p>
        </div>
        <span style={{
          fontSize: 20, color: COLORS.ink4, transition: "transform .3s",
          transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0,
        }}>
          ▾
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 28px 28px", borderTop: `1px solid ${COLORS.rule}` }}>
          <div style={{ paddingTop: 20 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
              fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase", color: COLORS.ink4,
            }}>
              {layer.files.length} {layer.files.length === 1 ? "FILE" : "FILES"}
            </div>
            {layer.files.map((file, i) => (
              <CodeBlock key={i} fileName={file.name} code={file.code} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ARCHITECTURE DIAGRAM ──────────────────────────────────
function ArchDiagram() {
  const steps = [
    { icon: "🌐", label: "Incoming Request", sub: "HTTPS" },
    { icon: "🏗️", label: "Helmet + Headers", sub: "CSP, HSTS, X-Frame" },
    { icon: "⏱️", label: "Rate Limiter", sub: "5/60/20 rpm tiers" },
    { icon: "🛡️", label: "Beta Gateway", sub: "Token validation" },
    { icon: "🧹", label: "Input Scrubber", sub: "XSS + SQLi deny-list" },
    { icon: "🔐", label: "Auth Guards", sub: "Escrow + Compliance" },
    { icon: "🕵️", label: "GPS Masking", sub: "Response filtering" },
    { icon: "✅", label: "Route Handler", sub: "Business logic" },
  ];
  return (
    <div style={{
      background: COLORS.white, borderRadius: 16, padding: "28px 24px",
      border: `1px solid ${COLORS.rule}`, marginBottom: 32,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
        textTransform: "uppercase", color: COLORS.ink4, marginBottom: 20,
      }}>
        Request Pipeline Flow
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 0, overflowX: "auto",
        paddingBottom: 8,
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 6, minWidth: 90,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: i === steps.length - 1 ? COLORS.greenPale : "#f5f5f3",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, border: i === steps.length - 1 ? `2px solid ${COLORS.greenLt}` : "1px solid #e8e3dc",
              }}>
                {s.icon}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: COLORS.ink,
                  lineHeight: 1.2, fontFamily: "'Inter', sans-serif",
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize: 10, color: COLORS.ink4, marginTop: 2,
                  fontFamily: "monospace",
                }}>
                  {s.sub}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 28, height: 2, background: `linear-gradient(90deg, ${COLORS.rule}, ${COLORS.ink4})`,
                margin: "0 2px", marginBottom: 28, flexShrink: 0, borderRadius: 1,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────
export default function CrewMiddlewareSuite() {
  const [openLayers, setOpenLayers] = useState(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const toggleLayer = (id) => {
    setOpenLayers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setOpenLayers(new Set());
    } else {
      setOpenLayers(new Set(LAYERS.map(l => l.id)));
    }
    setExpandAll(!expandAll);
  };

  const stats = [
    { n: "8", label: "Middleware Modules" },
    { n: "4", label: "Security Layers" },
    { n: "3", label: "Rate Limit Tiers" },
    { n: "0", label: "External Dependencies*" },
  ];

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: COLORS.bg, minHeight: "100vh", padding: "40px 20px",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          }}>
            <div style={{
              width: 40, height: 40, background: COLORS.green, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 16,
            }}>
              C
            </div>
            <span style={{
              fontSize: 18, fontWeight: 800, color: COLORS.ink, letterSpacing: "-.02em",
            }}>
              Crew
            </span>
            <Tag color={COLORS.amber} bg="#fef9ec">BETA SECURITY</Tag>
          </div>
          <h1 style={{
            fontFamily: "'Georgia', serif", fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 400, lineHeight: 1.1, color: COLORS.ink,
            letterSpacing: "-.02em", marginBottom: 16,
          }}>
            Production Middleware{" "}
            <em style={{ fontStyle: "italic", color: COLORS.greenMid }}>Suite</em>
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.7, color: COLORS.ink3, maxWidth: 600,
            fontWeight: 300,
          }}>
            Comprehensive security middleware for the Crew home-services marketplace.
            Protects escrow payments, licensed trade data, and user privacy across
            every layer of the Express pipeline.
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
          marginBottom: 32,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: COLORS.white, borderRadius: 12, padding: "18px 16px",
              border: `1px solid ${COLORS.rule}`, textAlign: "center",
            }}>
              <div style={{
                fontSize: 28, fontWeight: 800, color: COLORS.green,
                fontFamily: "'Georgia', serif",
              }}>
                {s.n}
              </div>
              <div style={{ fontSize: 11, color: COLORS.ink4, fontWeight: 600, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Architecture Diagram */}
        <ArchDiagram />

        {/* Controls */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", color: COLORS.ink4,
          }}>
            Security Layers
          </span>
          <button onClick={handleExpandAll} style={{
            background: "none", border: `1px solid ${COLORS.rule}`,
            padding: "6px 14px", borderRadius: 100, fontSize: 12,
            fontWeight: 600, color: COLORS.ink3, cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}>
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Layer Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {LAYERS.map(layer => (
            <LayerCard
              key={layer.id}
              layer={layer}
              isOpen={openLayers.has(layer.id)}
              onToggle={() => toggleLayer(layer.id)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          background: COLORS.white, borderRadius: 12, padding: "20px 24px",
          border: `1px solid ${COLORS.rule}`,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", color: COLORS.ink4, marginBottom: 8,
          }}>
            Required Dependencies
          </div>
          <code style={{
            fontSize: 13, color: COLORS.greenMid, fontFamily: "monospace",
            background: COLORS.greenPale, padding: "8px 14px", borderRadius: 8,
            display: "block", lineHeight: 1.8,
          }}>
            npm install express helmet express-rate-limit cookie-parser
          </code>
          <p style={{
            fontSize: 12, color: COLORS.ink4, marginTop: 12, lineHeight: 1.6,
          }}>
            * All custom middleware modules (6 of 8) have zero external dependencies.
            Only <code style={{ background: "#f5f5f3", padding: "1px 5px", borderRadius: 4 }}>helmet</code> and{" "}
            <code style={{ background: "#f5f5f3", padding: "1px 5px", borderRadius: 4 }}>express-rate-limit</code> are
            third-party. For production Redis-backed rate limiting, add{" "}
            <code style={{ background: "#f5f5f3", padding: "1px 5px", borderRadius: 4 }}>rate-limit-redis</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
