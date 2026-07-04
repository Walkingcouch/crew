'use strict';

/**
 * lib/vapid.js
 *
 * VAPID key management and Web Push sending.
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY   - Base64url-encoded public key (generate once, commit to .env.example)
 *   VAPID_PRIVATE_KEY  - Base64url-encoded private key (keep secret)
 *   VAPID_SUBJECT      - mailto: or https: contact URI for the push server
 *
 * Generate keys once with:
 *   node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k);"
 */

const webpush = require('web-push');

let _configured = false;

function configure() {
  if (_configured) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error(
      'Web Push not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.'
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  _configured = true;
}

/**
 * Returns the VAPID public key for the client to use with pushManager.subscribe().
 */
function getPublicKey() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new Error('VAPID_PUBLIC_KEY not set');
  return key;
}

/**
 * Sends a push notification to a single subscription object.
 *
 * @param {object} subscription  - PushSubscription JSON from the browser
 * @param {object} payload       - { title, body, icon?, badge?, tag?, url? }
 * @returns {Promise<void>}
 */
async function sendPush(subscription, payload) {
  configure();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

module.exports = { getPublicKey, sendPush };
