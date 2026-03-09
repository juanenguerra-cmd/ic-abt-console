// Service worker for ic-abt-console.
// Forces immediate activation on new deploys to prevent stale cached bundles
// from surviving across releases (skipWaiting + clients.claim).

self.addEventListener('install', (event) => {
  console.log('[SW] installed — skipping waiting to take control immediately');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activated — claiming all clients');
  event.waitUntil(
    clients.claim().then(() => {
      // Purge any caches created by earlier service worker versions.
      return caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            console.log('[SW] deleting stale cache:', name);
            return caches.delete(name);
          })
        )
      );
    })
  );
});
