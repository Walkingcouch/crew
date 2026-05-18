'use strict';

/**
 * payments/zai-client.js
 *
 * Base Zai (Assembly Payments) HTTP client.
 *
 * Responsibilities:
 *  - OAuth2 client-credentials token acquisition + in-memory caching
 *  - Retries with exponential back-off for transient 5xx / network failures
 *  - PCI-safe request/response logging (masks card numbers, CVVs, BSBs)
 *  - Thin typed wrappers for every Zai resource used by Crew
 *
 * Required env vars:
 *   ZAI_CLIENT_ID          OAuth2 client ID
 *   ZAI_CLIENT_SECRET      OAuth2 client secret
 *   ZAI_ENVIRONMENT        "sandbox" | "production"  (default: "sandbox")
 *   ZAI_PLATFORM_ACCOUNT_ID  Crew's Zai disbursement account (receives platform fees)
 */

const crypto = require('crypto');

// ── Base URLs ─────────────────────────────────────────────────────────────────
const BASE_URLS = {
  sandbox:    'https://api.sandbox.assemblypayments.com',
  production: 'https://api.assemblypayments.com',
};

const TOKEN_URLS = {
  sandbox:    'https://au-0000.sandbox.auth.assemblypayments.com/oauth/token',
  production: 'https://au-0000.auth.assemblypayments.com/oauth/token',
};

const env     = (process.env.ZAI_ENVIRONMENT || 'sandbox').toLowerCase();
const BASE_URL = BASE_URLS[env] || BASE_URLS.sandbox;
const TOKEN_URL = TOKEN_URLS[env] || TOKEN_URLS.sandbox;

// ── Token cache ───────────────────────────────────────────────────────────────
let _tokenCache = { token: null, expiresAt: 0 };

async function _getAccessToken() {
  const now = Date.now();
  // Refresh 60s before expiry to avoid clock-edge failures
  if (_tokenCache.token && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.token;
  }

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.ZAI_CLIENT_ID,
    client_secret: process.env.ZAI_CLIENT_SECRET,
    scope:         'all',
  });

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ZaiError(`Token acquisition failed: ${res.status}`, res.status, 'AUTH_FAILED', body);
  }

  const data = await res.json();
  _tokenCache = {
    token:     data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
  };
  return _tokenCache.token;
}

// ── PCI-safe logger ───────────────────────────────────────────────────────────
const REDACT_KEYS = new Set([
  'card_number', 'cvv', 'cvc', 'expiry', 'expiry_date',
  'account_number', 'bsb', 'routing_number', 'client_secret',
  'access_token', 'token',
]);

function _redact(obj, depth = 0) {
  if (depth > 6 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => _redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      REDACT_KEYS.has(k.toLowerCase())
        ? '[REDACTED]'
        : _redact(v, depth + 1),
    ])
  );
}

function _log(method, path, reqBody, resStatus, resBody, durationMs) {
  if (process.env.ZAI_LOG !== 'true') return;
  const safe = {
    ts:  new Date().toISOString(),
    method,
    path,
    status:   resStatus,
    duration: `${durationMs}ms`,
    req:  reqBody  ? _redact(reqBody)  : undefined,
    res:  resBody  ? _redact(resBody)  : undefined,
  };
  console.log('[Zai]', JSON.stringify(safe));
}

// ── Error type ────────────────────────────────────────────────────────────────
class ZaiError extends Error {
  constructor(message, statusCode, code, raw) {
    super(message);
    this.name       = 'ZaiError';
    this.statusCode = statusCode;
    this.code       = code;     // e.g. 'INSUFFICIENT_FUNDS', 'CARD_DECLINED'
    this.raw        = raw;
    this.retryable  = statusCode >= 500 || statusCode === 429;
  }
}

// ── Core request with retry ───────────────────────────────────────────────────
async function _request(method, path, body, opts = {}) {
  const MAX_RETRIES   = 3;
  const INITIAL_DELAY = 400; // ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await _getAccessToken();
    const start = Date.now();

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    };
    if (opts.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }

    let res;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      if (attempt === MAX_RETRIES) {
        throw new ZaiError(`Network error: ${networkErr.message}`, 0, 'NETWORK_ERROR', null);
      }
      await _sleep(INITIAL_DELAY * 2 ** attempt);
      continue;
    }

    const rawText  = await res.text();
    const duration = Date.now() - start;
    let resData;
    try { resData = JSON.parse(rawText); } catch { resData = { raw: rawText }; }

    _log(method, path, body, res.status, resData, duration);

    // Success
    if (res.ok) return resData;

    // Rate limited — retry after Retry-After header
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      if (attempt < MAX_RETRIES) {
        await _sleep(retryAfter * 1000);
        continue;
      }
    }

    // Transient server error — exponential back-off
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await _sleep(INITIAL_DELAY * 2 ** attempt);
      continue;
    }

    // Client or unretryable error
    const errMsg   = resData?.errors?.[0]?.message || resData?.error || `HTTP ${res.status}`;
    const errCode  = resData?.errors?.[0]?.code    || 'ZAI_ERROR';
    throw new ZaiError(errMsg, res.status, errCode, resData);
  }
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Idempotency key helper (deterministic from booking ID + action) ────────────
function idempotencyKey(bookingId, action) {
  return crypto
    .createHash('sha256')
    .update(`${bookingId}:${action}`)
    .digest('hex')
    .slice(0, 64);
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function createUser(data) {
  return _request('POST', '/users', { users: data });
}
async function getUser(zaiUserId) {
  return _request('GET', `/users/${zaiUserId}`);
}
async function updateUser(zaiUserId, data) {
  return _request('PATCH', `/users/${zaiUserId}`, { users: data });
}
async function verifyUser(zaiUserId, data) {
  return _request('PATCH', `/users/${zaiUserId}/verification`, { users: data });
}

// ── Fees ──────────────────────────────────────────────────────────────────────
// Fee type: 1 = fixed, 2 = percentage
async function createFee(data) {
  return _request('POST', '/fees', { fees: data });
}
async function getFee(feeId) {
  return _request('GET', `/fees/${feeId}`);
}

// ── Items (payment intents + escrow) ─────────────────────────────────────────
async function createItem(data, bookingId) {
  return _request('POST', '/items', { items: data }, {
    idempotencyKey: idempotencyKey(bookingId, 'create_item'),
  });
}
async function getItem(itemId) {
  return _request('GET', `/items/${itemId}`);
}
async function updateItem(itemId, data) {
  return _request('PATCH', `/items/${itemId}`, { items: data });
}

// Charge: attach payment method to an item and capture
async function chargeItem(itemId, chargeData, bookingId) {
  return _request('POST', `/items/${itemId}/charges`, { charges: chargeData }, {
    idempotencyKey: idempotencyKey(bookingId, 'charge'),
  });
}

// Release escrow: splits payout to seller + fee to platform
async function releaseItem(itemId, bookingId) {
  return _request('POST', `/items/${itemId}/release_payment`,
    { release_payment: { flag_release: true } },
    { idempotencyKey: idempotencyKey(bookingId, 'release') }
  );
}

// Request refund (buyer-initiated or admin)
async function refundItem(itemId, data, bookingId) {
  return _request('POST', `/items/${itemId}/request_refund`, { refund: data }, {
    idempotencyKey: idempotencyKey(bookingId, 'refund'),
  });
}

// Raise a dispute on an item
async function raiseDispute(itemId, data, bookingId) {
  return _request('POST', `/items/${itemId}/disputes`,
    { disputes: data },
    { idempotencyKey: idempotencyKey(bookingId, 'dispute') }
  );
}

// Resolve a dispute (admin only — used in webhook handler)
async function resolveDispute(itemId, disputeId, data) {
  return _request('PATCH', `/items/${itemId}/disputes/${disputeId}`, { disputes: data });
}

// ── Wallets ───────────────────────────────────────────────────────────────────
async function getWallet(walletId) {
  return _request('GET', `/wallets/${walletId}`);
}

// ── Card accounts (tokenised by Zai.js SDK on frontend) ───────────────────────
async function createCardAccount(data) {
  return _request('POST', '/card_accounts', { card_accounts: data });
}
async function getCardAccount(cardAccountId) {
  return _request('GET', `/card_accounts/${cardAccountId}`);
}
async function listCardAccounts(zaiUserId) {
  return _request('GET', `/users/${zaiUserId}/card_accounts`);
}

// ── Bank accounts (direct debit / bank transfer) ──────────────────────────────
async function createBankAccount(data) {
  return _request('POST', '/bank_accounts', { bank_accounts: data });
}
async function getBankAccount(bankAccountId) {
  return _request('GET', `/bank_accounts/${bankAccountId}`);
}
async function listBankAccounts(zaiUserId) {
  return _request('GET', `/users/${zaiUserId}/bank_accounts`);
}

// ── Disbursements (manual payout to contractor's bank account) ─────────────────
async function createDisbursement(data, ref) {
  return _request('POST', '/disbursements', { disbursements: data }, {
    idempotencyKey: idempotencyKey(ref, 'disburse'),
  });
}
async function getDisbursement(disbursementId) {
  return _request('GET', `/disbursements/${disbursementId}`);
}

// ── Token auth (Zai.js hosted-fields session token) ───────────────────────────
// Returns a short-lived token the browser passes to Zai.js to render the card form
async function getHostedFieldsToken(zaiUserId) {
  return _request('POST', '/token_auth', {
    token_auth: { user_id: zaiUserId, token_type: 'card' },
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  ZaiError,
  idempotencyKey,

  // Users
  createUser,
  getUser,
  updateUser,
  verifyUser,

  // Fees
  createFee,
  getFee,

  // Items
  createItem,
  getItem,
  updateItem,
  chargeItem,
  releaseItem,
  refundItem,
  raiseDispute,
  resolveDispute,

  // Wallets
  getWallet,

  // Cards
  createCardAccount,
  getCardAccount,
  listCardAccounts,

  // Banks
  createBankAccount,
  getBankAccount,
  listBankAccounts,

  // Disbursements
  createDisbursement,
  getDisbursement,

  // Checkout
  getHostedFieldsToken,
};
