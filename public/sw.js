/**
 * Service Worker — offline-first cache strategy.
 *
 * Strategy:
 *   • App-shell assets (JS, CSS, HTML) → Cache-first (stale-while-revalidate)
 *   • Navigation requests              → Network-first with cache fallback
 *
 * On activation the old cache is pruned so stale assets do not accumulate.
 */

const CACHE_NAME = "ic-console-v1";

// Asset extensions to cache aggressively.
const CACHE_ASSET_EXTS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".ico"];

// ---------------------------------------------------------------------------
// Install — pre-cache the app shell
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/index.html"]).catch(() => {
        // Non-fatal: the shell will be cached on first navigation.
      })
    )
  );
  // Activate immediately without waiting for old tabs to close.
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean up old caches
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately.
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — serve from cache or network depending on resource type
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  const ext = url.pathname.substring(url.pathname.lastIndexOf("."));

  if (CACHE_ASSET_EXTS.includes(ext)) {
    // Cache-first for static assets (JS, CSS, fonts, images).
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first for HTML / navigation so users always get the freshest
    // app shell when online, but still work offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
  }
});
