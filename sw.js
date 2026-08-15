// Bump this version string every time you deploy an update.
// Old caches are deleted automatically, and the new SW takes over
// on next load (no "uninstall and reinstall" needed like some older
// PWAs — this one uses network-first for the app shell so updates
// show up as soon as the device is online).
const CACHE_VERSION = 'abs-pwa-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './readonly.html',
  './manifest.json',
  './manifest-readonly.json',
  './cloud-sync.js',
  './drive-backup.js',
  './firebase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-readonly-192.png',
  './icons/icon-readonly-512.png',
  './icons/icon-readonly-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for the app shell (so edits/deploys show up immediately when
// online), falling back to cache when offline. Everything else (CDN scripts,
// Firebase/Google requests) just passes through to the network as normal —
// we don't want to cache those or intercept auth redirects.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isCoreAsset = url.origin === self.location.origin;

  if (!isCoreAsset || req.method !== 'GET') return; // let it hit the network normally

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => {
        if (cached) return cached;
        // Fall back to the same "family" of page that was requested, so an
        // offline visitor to readonly.html doesn't get bounced to the
        // login-gated main app.
        const fallback = url.pathname.includes('readonly') ? './readonly.html' : './index.html';
        return caches.match(fallback);
      }))
  );
});
