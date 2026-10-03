// Network-only worker: this app requires live storefront data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('appprice-')).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
