const CACHE_NAME = 'myctrl-v5';
const OFFLINE_URL = '/offline/';

// Pages are listed at their canonical trailing-slash URL: the host redirects
// `/all` to `/all/`, and a redirected response cannot be replayed for a
// navigation. Every entry must exist — see service-worker-precache.test.ts.
const PRECACHE_URLS = [
  '/',
  '/all/',
  '/assess/',
  '/crosswalk/visualize/',
  '/compare/',
  '/guidance/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/data/frameworks/manifest.json',
  '/data/crosswalk-stats.json',
];

async function precache(cache, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  // Should a URL ever redirect anyway, store a clean copy that can be replayed.
  const storable = response.redirected
    ? new Response(await response.blob(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    : response;
  await cache.put(url, storable);
}

self.addEventListener('install', (event) => {
  // Each URL is cached on its own, so one failure cannot void the whole set
  // (and with it the offline fallback) the way an atomic addAll would.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => precache(cache, url)))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for HTML navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Cache-first for static data JSON, fonts, and hashed assets
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.startsWith('/fonts/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
