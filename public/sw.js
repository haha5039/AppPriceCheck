const CACHE_NAME = 'appprice-v2.0.0';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always try network first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
