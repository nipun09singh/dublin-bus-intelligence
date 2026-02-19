/// <reference lib="webworker" />

const CACHE_NAME = "busiq-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Install: cache shell assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and WebSocket
    if (request.method !== "GET") return;
    if (url.protocol === "ws:" || url.protocol === "wss:") return;

    // API calls: network-first
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then((r) => r || new Response("{}", { status: 503 }))
            )
        );
        return;
    }

    // Static assets: cache-first
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request).then((response) => {
                    // Cache successful responses
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
        )
    );
});
