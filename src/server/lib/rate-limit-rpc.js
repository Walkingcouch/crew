'use strict';

/**
 * lib/rate-limit-rpc.js
 *
 * Database-backed rate limiting via the bump_rate_limit(key, window, max)
 * RPC (supabase/migrations/0001_init.sql). In-memory rate limiters
 * (express-rate-limit's default store) don't work correctly once this app
 * runs as Vercel serverless functions: each concurrent invocation can land
 * on a different, independent container with its own memory, so an
 * in-memory counter under-counts real traffic. The RPC's UPSERT-based
 * counter in Postgres is the single shared source of truth every
 * invocation sees, which is what actually enforces a limit in that
 * environment. Kept as a small opt-in middleware rather than replacing
 * express-rate-limit everywhere, since local `npm run dev` still works
 * fine with the in-memory version and doesn't need a DB round-trip for
 * every request.
 */

const { createClient } = require('@supabase/supabase-js');

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

/**
 * @param {object} opts
 * @param {string} opts.keyPrefix       Distinguishes this limiter's counters from others, e.g. 'checkout'
 * @param {number} opts.windowSeconds   Rolling window size
 * @param {number} opts.max             Max requests allowed per window per key
 * @param {'ip'|'user'} [opts.keyBy]    Key by client IP (default) or by req.user.id (route must run after requireAuth)
 */
function rateLimitRpc({ keyPrefix, windowSeconds, max, keyBy = 'ip' }) {
  return async (req, res, next) => {
    const identity = keyBy === 'user' && req.user?.id ? req.user.id : req.ip;
    const key = `${keyPrefix}:${identity}`;

    try {
      const { data: allowed, error } = await getSupabase().rpc('bump_rate_limit', {
        p_key: key, p_window_seconds: windowSeconds, p_max: max,
      });

      if (error) {
        // Fail open: a rate-limiter outage must never take the whole API down.
        console.error('[rate-limit-rpc] bump_rate_limit failed, allowing request:', error.message);
        return next();
      }

      if (!allowed) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      }
      next();
    } catch (err) {
      console.error('[rate-limit-rpc] unexpected error, allowing request:', err.message);
      next();
    }
  };
}

module.exports = { rateLimitRpc };
