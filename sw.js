// Ahmed Alfaraj Trading Portfolio — Service Worker
// Caches the app shell so it loads instantly and works offline.
// Firebase/Firestore has its own offline persistence (IndexedDB) so data syncs automatically.

const CACHE_VERSION = 'v7-2026-04-18-icos';
const CACHE_NAME = 'ahmed-trading-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k.startsWith('ahmed-trading-')).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML navigations: network-first (get updates), fallback to cache when offline
// - App shell assets: cache-first (fast load)
// - API calls (Binance, CoinGecko, Firebase, Firestore, Google APIs): always network (never cache)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests
  if (req.method !== 'GET') return;

  // Skip requests to external APIs — let them hit the network directly
  const externalHosts = [
    'api.binance.com',
    'api.coingecko.com',
    'firestore.googleapis.com',
    'firebaseapp.com',
    'googleapis.com',
    'gstatic.com',
    'googleusercontent.com',
    'accounts.google.com'
  ];
  if (externalHosts.some(h => url.hostname.includes(h))) {
    return; // Default browser behavior (network)
  }

  // HTML navigation: network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Update the cache with the latest HTML
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Only cache successful same-origin responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});

// Listen for messages from the page (e.g., to force update)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
