/**
 * Crew PWA Service Worker
 * Strategy:
 *  - Shell files (HTML, JS, CSS): Network-first with cache fallback
 *  - Static assets (images, fonts): Cache-first
 *  - API / Supabase calls: Network-only (never cache auth traffic)
 */

const VERSION   = 'crew-v3';
const CACHE     = `${VERSION}-shell`;
const IMG_CACHE = `${VERSION}-images`;

/* ── Files to pre-cache on install ──────────────────────────── */
const SHELL = [
  '/auth.html',
  '/index.html',
  '/manifest.json',
  '/404.html',
  '/offline.html',
  '/crew-framework.js',
  '/active-jobs-panel.js',
];

/* ── Install: pre-cache shell ────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches, notify clients of update ──── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('crew-') && k !== CACHE && k !== IMG_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
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

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

/* ── Push notifications (future use) ────────────────────────── */
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
