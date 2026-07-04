'use strict';

/**
 * payments/http-util.js
 *
 * Shared HTTP plumbing for payment provider adapters: retry with exponential
 * back-off, a PCI/KYC-safe redacting logger, and a typed error class.
 * Ported out of the deleted payments/zai-client.js so the same tested
 * behaviour carries over to payments/checkvault-client.js rather than being
 * rewritten from scratch.
 */

const crypto = require('crypto');

// ── Typed error ───────────────────────────────────────────────────────────────
class PaymentProviderError extends Error {
  constructor(message, statusCode, code, raw) {
    super(message);
    this.name       = 'PaymentProviderError';
    this.statusCode = statusCode;
    this.code       = code;
    this.raw        = raw;
    this.retryable  = statusCode >= 500 || statusCode === 429;
  }
}

// ── Redacting logger ──────────────────────────────────────────────────────────
// Never let a BSB, account number, card number, CRN, or credential leak into
// logs, even in verbose/debug mode.
const REDACT_KEYS = new Set([
  'card_number', 'cvv', 'cvc', 'expiry', 'expiry_date',
  'account_number', 'accountnumber', 'bsb', 'routing_number', 'crn',
  'client_secret', 'api_secret', 'access_token', 'token', 'password',
  'webhook_secret', 'signature',
]);

function redact(obj, depth = 0) {
  if (depth > 6 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1),
    ])
  );
}

function logRequest(logFlagEnvVar, tag, method, path, reqBody, resStatus, resBody, durationMs) {
  if (process.env[logFlagEnvVar] !== 'true') return;
  const safe = {
    ts: new Date().toISOString(),
    method,
    path,
    status: resStatus,
    duration: `${durationMs}ms`,
    req: reqBody ? redact(reqBody) : undefined,
    res: resBody ? redact(resBody) : undefined,
  };
  console.log(`[${tag}]`, JSON.stringify(safe));
}

// ── Idempotency key (deterministic from bookingId + action) ──────────────────
function idempotencyKey(bookingId, action) {
  return crypto.createHash('sha256').update(`${bookingId}:${action}`).digest('hex').slice(0, 64);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generic fetch-with-retry: exponential back-off on 5xx/network errors,
 * Retry-After-aware on 429. Caller supplies a function that performs one
 * fetch attempt and returns { res, rawText } or throws on network failure.
 */
async function requestWithRetry(attemptFn, { maxRetries = 3, initialDelayMs = 400 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let outcome;
    try {
      outcome = await attemptFn();
    } catch (networkErr) {
      if (attempt === maxRetries) {
        throw new PaymentProviderError(`Network error: ${networkErr.message}`, 0, 'NETWORK_ERROR', null);
      }
      await sleep(initialDelayMs * 2 ** attempt);
      continue;
    }

    const { res, resData } = outcome;
    if (res.ok) return resData;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get?.('Retry-After') || '2', 10);
      if (attempt < maxRetries) { await sleep(retryAfter * 1000); continue; }
    }
    if (res.status >= 500 && attempt < maxRetries) {
      await sleep(initialDelayMs * 2 ** attempt);
      continue;
    }

    const errMsg  = resData?.errors?.[0]?.message || resData?.error || `HTTP ${res.status}`;
    const errCode = resData?.errors?.[0]?.code || 'PROVIDER_ERROR';
    throw new PaymentProviderError(errMsg, res.status, errCode, resData);
  }
}

/**
 * Constant-time HMAC-SHA256 webhook signature verification, shared by every
 * provider adapter (real and mock).
 */
function verifyHmacSignature(rawBody, signature, secret) {
  if (!secret) throw new Error('Webhook secret is not configured');
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf   = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

module.exports = {
  PaymentProviderError,
  redact,
  logRequest,
  idempotencyKey,
  sleep,
  requestWithRetry,
  verifyHmacSignature,
};
