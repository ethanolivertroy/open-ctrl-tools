const CACHE_NAME = 'myctrl-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Determine caching strategy based on request
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_astro/');
}

function isCacheableStaticRequest(request) {
  return ['style', 'image', 'font'].includes(request.destination);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const clone = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, clone);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.status === 200) {
        const clone = response.clone();
        void cache.put(request, clone);
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return fetch(request);
}

// Fetch handler with conservative caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Always fetch navigations from network to avoid stale HTML shell.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for immutable hashed assets.
  // This prevents stale cached bundles from persisting across deployments.
  if (isImmutableAsset(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Stale-while-revalidate for styles/images/fonts.
  if (isCacheableStaticRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network only.
  event.respondWith(fetch(request));
});
