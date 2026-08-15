/* Jelajah Halal — service worker.
   Shell + API responses are cached so the guide stays browsable with a
   patchy signal (a very real scenario for the trip this app is for). */
const VERSION = "jh-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;
const IMG_CACHE = `${VERSION}-img`;

const SHELL_FILES = [
  "/", "/static/css/style.css", "/static/js/app.js",
  "/static/img/logo.svg", "/static/img/icon-192.png", "/static/img/icon-512.png",
  "/static/manifest.json",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, timeoutMs = 6000) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // SPA navigations: try the network, fall back to the cached shell so the
  // hash-router still boots offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE).then(r =>
      r.ok !== false ? r : caches.match("/")));
    return;
  }

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(networkFirst(request, API_CACHE));
    } else if (url.pathname.startsWith("/static/")) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    return;
  }

  // Wikipedia photo thumbnails — static content, cache aggressively.
  if (url.hostname === "upload.wikimedia.org") {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  // Fonts / Leaflet / map tiles: leave to the network untouched.
});
