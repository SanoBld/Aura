/* ============================================================
   AURA — sw.js
   Basic service worker for instant load caching.
   Caches core assets on install; serves from cache first,
   falls back to network for everything else.
   ============================================================ */

const CACHE_NAME = 'aura-v1';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/i18n.js',
  // Google Fonts — cache the stylesheet; individual font files are cached on first use
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;700&family=JetBrains+Mono&family=Playfair+Display:ital,wght@0,700;1,700&family=Outfit:wght@400;800&display=swap',
];

// Install — pre-cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// Activate — remove outdated caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for local assets, network-first for API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls (Last.fm, Lanyard, LRCLIB, NetEase, Genius)
  const isApiCall = [
    'ws.audioscrobbler.com',
    'api.lanyard.rest',
    'lrclib.net',
    'music.163.com',
    'api.genius.com',
    'corsproxy.io',
    'umami',
  ].some(host => url.hostname.includes(host));

  if (isApiCall) return; // let the browser handle it normally

  // Cache-first for same-origin assets and Google Fonts
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses for fonts and same-origin files
        if (
          response.ok &&
          (url.origin === self.location.origin ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html')); // offline fallback
    })
  );
});
