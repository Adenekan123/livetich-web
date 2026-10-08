// Livetich Offline & Edge-Resilience Service Worker
const CACHE_NAME = 'livetich-static-v1';
const STATIC_ASSETS = [
  '/favicon-dark.png',
  '/favicon-light.png',
  '/sounds/join.mp3',
  '/sounds/class-start.mp3',
  '/sounds/class-end.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Best effort: if some sound asset isn't present, install still succeeds
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass service worker for API, WebSocket, socket.io, or LiveKit requests
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // Cache-First strategy for static assets (fonts, sounds, images, excalidraw assets)
  if (
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.startsWith('/excalidraw-assets/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        });
      }),
    );
  }
});
