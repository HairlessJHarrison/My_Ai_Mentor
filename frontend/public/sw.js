// Bump CACHE_VERSION whenever a deployment changes the app shell.
// This causes the activate handler to wipe the old cache so users
// never get the blank-page state where index.html references JS
// chunks that no longer exist in the cache.
const CACHE_VERSION = 2;
const CACHE_NAME = `unplugged-v${CACHE_VERSION}`;

const PRECACHE_URLS = ['/index.html', '/manifest.json'];

// Install: pre-cache the minimal shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

// Activate: delete ALL old caches so stale Vite chunks are purged
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch strategy:
//   API           → network-first, cache as offline fallback
//   Navigation    → network-first so the latest index.html is always fetched;
//                   fall back to cached /index.html for offline SPA routing
//   Hashed assets → cache-first (Vite content hashes guarantee immutability)
//   Everything else → network-first with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin GET requests; skip WebSocket upgrades
    if (request.method !== 'GET' || url.pathname === '/ws') return;

    // API: network-first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Navigation (HTML pages): network-first so deploys are picked up
    // immediately. Fall back to cached /index.html for offline SPA routing.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Hashed Vite bundles (/assets/): cache-first — content-addressed files
    // are immutable so it's safe to serve forever from cache.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // All other static assets: network-first with cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                return response;
            })
            .catch(() => caches.match(request))
    );
});
