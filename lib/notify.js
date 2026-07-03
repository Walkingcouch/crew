'use strict';

/**
 * lib/notify.js
 *
 * Admin notification helper.
 * Inserts a record into admin_notifications and optionally sends an email via Resend.
 *
 * Table: admin_notifications (id, type, message, meta, read, created_at)
 *
 * Required env vars for email (optional):
 *   RESEND_API_KEY   - Resend API key
 *   ADMIN_EMAIL      - destination address for alert emails
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * @param {object} opts
 * @param {string}  opts.type     - Notification category e.g. 'sos', 'dispute', 'escrow_error'
 * @param {string}  opts.message  - Human-readable summary
 * @param {object}  [opts.meta]   - Arbitrary structured data attached to the record
 * @param {boolean} [opts.email]  - Whether to also send an alert email via Resend
 */
async function notifyAdmin({ type, message, meta = {}, email = false }) {
  const supabase = getSupabase();

  try {
    await supabase.from('admin_notifications').insert({
      type,
      message,
      meta,
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[notify] DB insert failed:', err.message);
  }

  if (email && process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    'Crew Alerts <alerts@getcrew.com.au>',
          to:      [process.env.ADMIN_EMAIL],
          subject: `[Crew Alert] ${type}: ${message.slice(0, 60)}`,
          text:    `Type: ${type}\n\n${message}\n\n${JSON.stringify(meta, null, 2)}`,
        }),
      });
    } catch (err) {
      console.error('[notify] Resend error:', err.message);
    }
  }
}

module.exports = { notifyAdmin };
