'use strict';

/**
 * lib/notify.js
 *
 * The single entry point every server-side event uses to tell a user
 * something happened. Two things always happen together:
 *   1. A row is inserted into the `notifications` table (read by the
 *      in-app notification bell via Realtime, see crew-framework.js).
 *   2. A Web Push notification is sent to every device the user has
 *      subscribed from (push_subscriptions), so the message reaches them
 *      even when the app is closed.
 *
 * Dead subscriptions (410 Gone / 404 Not Found from the push service) are
 * pruned automatically.
 *
 * Required env vars for push (optional — notify() still writes the
 * in-app notification if these are absent, it just skips the push send):
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */

const { createClient } = require('@supabase/supabase-js');
const { sendPush } = require('./vapid');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * @param {string} userId              Supabase profile id of the recipient
 * @param {object} payload
 * @param {string} payload.title       Short heading shown in the in-app bell and the push notification
 * @param {string} [payload.body]      Longer detail text
 * @param {string} [payload.link]      In-app path to open when the notification is clicked (must start with "/")
 * @param {string} [payload.type]      Category, e.g. 'booking', 'dispute', 'payment', 'alert', 'warning'
 * @returns {Promise<{ notificationId: any, pushed: number, pruned: number }>}
 */
async function notify(userId, payload) {
  const { title, body = '', link = null, type = 'info' } = payload || {};
  if (!userId) throw new Error('notify() requires a userId');
  if (!title) throw new Error('notify() requires a title');

  const supabase = getSupabase();

  const { data: row, error: insertErr } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body,
      link,
      type,
      read: false,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[notify] notifications insert failed:', insertErr.message);
  }

  const pushResult = await sendPushToUser(supabase, userId, { title, body, url: link || '/', tag: type });

  return { notificationId: row?.id, pushed: pushResult.pushed, pruned: pushResult.pruned };
}

/**
 * Sends a Web Push notification to every subscription on file for a user,
 * pruning any that the push service reports as gone (404/410).
 */
async function sendPushToUser(supabase, userId, pushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { pushed: 0, pruned: 0 };
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !subs?.length) return { pushed: 0, pruned: 0 };

  let pushed = 0;
  const deadIds = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await sendPush(subscription, pushPayload);
        pushed++;
      } catch (err) {
        const status = err.statusCode || err.status;
        if (status === 404 || status === 410) {
          deadIds.push(row.id);
        } else {
          console.error('[notify] push send failed for subscription', row.id, err.message);
        }
      }
    })
  );

  if (deadIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', deadIds);
  }

  return { pushed, pruned: deadIds.length };
}

/**
 * Admin-only alert helper, separate from notify(): inserts into
 * admin_notifications and optionally emails ADMIN_EMAIL via Resend.
 * Used for operational alerts (SOS, disbursement failures) rather than
 * per-user in-app/push notifications.
 *
 * @param {object} opts
 * @param {string}  opts.type
 * @param {string}  opts.message
 * @param {object}  [opts.meta]
 * @param {boolean} [opts.email]
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
    console.error('[notify] admin_notifications insert failed:', err.message);
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

module.exports = { notify, notifyAdmin, sendPushToUser };
