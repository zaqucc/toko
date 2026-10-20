const CACHE_NAME = 'logiexpress-pwa-v3';
const APP_SHELL = ['./', './index.html', './detail.html', './order.html', './style.css', './script.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('logiexpress-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isImage = req.destination === 'image';

  // External images (Google Drive thumbnails, etc.) must always be fetched fresh.
  // Do not cache opaque/error responses from external image hosts; these can
  // otherwise keep broken product photos stuck after the source is fixed.
  if (!isSameOrigin) {
    if (!isImage) return;
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => Response.error()));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    try {
      const response = await fetch(req);
      if (response && response.ok) cache.put(req, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      if (cached) return cached;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
