// Hand-rolled service worker (chose this over Serwist: Turbopack
// compatibility with Serwist's webpack-based build step was unproven and
// this app's caching needs are simple, see DECISIONS.md).
//
// Strategy:
//  - Navigation requests: network-first, falling back to the cached
//    offline page when the network is unreachable. Never falls back to a
//    stale cached HTML page (auth-gated content must never look logged in
//    when it isn't).
//  - Static assets (_next/static, icons, images): cache-first, they're
//    content-hashed by Next.js so a cache hit is always correct.
//  - Everything else (API calls, auth): always network, never cached.
//    Escrow/payment state must never be served stale.

const CACHE_VERSION = "crew-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/assets/logo_Crew.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (isStaticAsset(url) && event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
            }
            return response;
          }),
      ),
    );
  }
});

// Lets the client detect a genuinely new service worker version (as
// opposed to the very first install) so it can show an "update available"
// toast instead of nagging every visit, see useServiceWorker.ts.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
