// Network-only worker: this app requires live storefront data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('appprice-v2.0.0').then(() => self.clients.claim()));
});
