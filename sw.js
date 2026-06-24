const CACHE_NAME = 'logi-express-v1';
const assets = [
  'index.html',
  'order.html',
  'admin.html',
  'sukses.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
