/*
 * F1ISL service worker (PW-1).
 *
 * Freshness is the priority — league data must never go stale:
 *   - Navigations (HTML):        NETWORK-FIRST → cache fallback → offline page.
 *   - Immutable build assets:    CACHE-FIRST   (/_next/static/* is hashed).
 *   - Other same-origin GET:     NETWORK-FIRST → cache fallback (no offline page).
 *   - Cross-origin (Sheets CSV, fonts CDN, GA): not intercepted at all.
 *
 * Versioned cache names + activate-time cleanup + skipWaiting/clients.claim
 * mean a new deploy takes over immediately and old caches are purged, so a
 * stale service worker can't pin an old build.
 */
const VERSION = "f1isl-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/site.webmanifest",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Let the network own everything cross-origin (Google Sheets CSV, font CDNs,
  // analytics). We only manage same-origin traffic.
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed build assets: safe to serve from cache first.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // HTML navigations: always try the network first so standings/results/etc.
  // are fresh; fall back to a cached copy, then to the branded offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Other same-origin GET (data/API): network-first, cache only as a fallback.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
