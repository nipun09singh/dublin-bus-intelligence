/// <reference lib="webworker" />

const CACHE_NAME = "busiq-v2";
const STATIC_ASSETS = ["/manifest.json"];

// Install: cache shell assets (skip caching / so HTML is always fresh)
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean ALL old caches
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

// Fetch handler
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and WebSocket
    if (request.method !== "GET") return;
    if (url.protocol === "ws:" || url.protocol === "wss:") return;

    // Navigation requests (HTML pages) & API calls: network-first
    if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 200 && request.mode !== "navigate") {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((r) => r || new Response("{}", { status: 503 }))
                )
        );
        return;
    }

    // Static assets (JS, CSS, images): cache-first
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request).then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
        )
    );
});
