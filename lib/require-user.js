'use strict';

/**
 * lib/require-user.js
 *
 * Shared Supabase JWT authentication middleware for Express routes.
 * Used by payments/routes.js, server.js (/api/ai), and push routes.
 */

const { createClient } = require('@supabase/supabase-js');

function makeSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * Validates the Bearer token in the Authorization header using Supabase.
 * Sets req.user on success.
 */
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization header required' });

  try {
    const supabase = makeSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Requires a valid session AND the admin or crewbase_admin role in profiles.
 */
async function requireAdmin(req, res, next) {
  await requireUser(req, res, async () => {
    try {
      const supabase = makeSupabase();
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', req.user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'crewbase_admin') {
        return res.status(403).json({ error: 'Admin role required' });
      }
      next();
    } catch (_) {
      return res.status(403).json({ error: 'Role check failed' });
    }
  });
}

module.exports = { requireUser, requireAdmin };
