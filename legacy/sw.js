/**
 * Crew PWA Service Worker
 * Strategy:
 *  - Shell files (HTML, JS, CSS): Network-first with cache fallback
 *  - Static assets (images, fonts): Cache-first
 *  - API / Supabase calls: Network-only (never cache auth traffic)
 */

const VERSION   = 'crew-v5';
const CACHE     = `${VERSION}-shell`;
const IMG_CACHE = `${VERSION}-images`;

/* ── Files to pre-cache on install ──────────────────────────── */
/* Includes every role app and its manifest so an installed PWA can cold-start
   fully offline, not just the marketing/auth shell. */
const SHELL = [
  '/auth.html',
  '/auth/callback.html',
  '/reset-password.html',
  '/index.html',
  '/manifest.json',
  '/manifest-customer.json',
  '/manifest-pro.json',
  '/manifest-manager.json',
  '/manifest-field.json',
  '/manifest-supervisor.json',
  '/manifest-command.json',
  '/404.html',
  '/offline.html',
  '/crew-framework.js',
  '/active-jobs-panel.js',
  '/Crew_App_Customer_Role.html',
  '/Crew_App_Crew_Member.html',
  '/Crew_App_Crew_Manager.html',
  '/CrewBase_Field_Worker_App.html',
  '/CrewBase_Supervisor_App.html',
  '/Command_Center_Desktop.html',
  '/Command_Center_Tablet.html',
  '/CrewBase_Dashboard.html',
];

/* ── Install: pre-cache shell ────────────────────────────────── */
/* Each file is cached independently so one missing/failed file cannot
   silently take down the entire offline shell (cache.addAll is atomic
   and aborts all-or-nothing on a single failure). */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url =>
        cache.add(url).catch(err => console.warn(`[SW] Failed to pre-cache ${url}:`, err))
      )))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ──────────────────────────────── */
/* Update notification is handled entirely on the page side via
   registration.onupdatefound (see crew-framework.js registerSW), not
   broadcast here — a broadcast on every activate would show a brand-new
   user "new version available" the first time they ever open the app. */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('crew-') && k !== CACHE && k !== IMG_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch strategy ─────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Never intercept: Supabase API, cross-origin, non-GET */
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('jsdelivr.net')) return;
  if (url.hostname !== self.location.hostname) return;

  /* Images: cache-first */
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  /* HTML + everything else: network-first */
  event.respondWith(networkFirst(request, CACHE));
});

/* ── Helpers ─────────────────────────────────────────────────── */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    /* Fallback to offline page for navigation requests */
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/offline.html');
      return fallback || new Response('Offline — please reconnect.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    return new Response('', { status: 503 });
  }
}

const IMG_CACHE_MAX_ENTRIES = 200;

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      await trimCache(cache, IMG_CACHE_MAX_ENTRIES);
    }
    return response;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

/* Simple FIFO trim: caches.keys() returns entries in insertion order, so the
   oldest entries are the ones added first. Good enough as an LRU approximation
   without tracking access times. */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

/* ── Push notifications ──────────────────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (_) { data = { title: 'Crew', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Crew', {
      body:  data.body || '',
      icon:  data.icon  || undefined,
      badge: data.badge || undefined,
      data:  data.url   || '/',
      tag:   data.tag   || 'crew-notification',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* The push service occasionally rotates a subscription's endpoint. When that
   happens, re-subscribe with the same applicationServerKey and hand the new
   subscription to an open page (crew-framework.js) so it can be uploaded to
   /api/push/subscribe with the user's auth token, which the service worker
   itself doesn't have access to. */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription ? event.oldSubscription.options.applicationServerKey : undefined,
    })
      .then(newSubscription =>
        self.clients.matchAll({ type: 'window' }).then(clientList => {
          clientList.forEach(client => client.postMessage({
            type: 'PUSH_RESUBSCRIBED',
            subscription: newSubscription.toJSON(),
          }));
        })
      )
      .catch(err => console.warn('[SW] pushsubscriptionchange re-subscribe failed:', err))
  );
});
