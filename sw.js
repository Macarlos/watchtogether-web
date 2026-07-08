// Watch2Night service worker — app shell caching + offline fallback.
// Bump CACHE_NAME whenever you want to force clients to pick up new
// cached shell files (rare — most of the app's content comes live from
// the API and is never cached here).
const CACHE_NAME = "w2n-shell-v2";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests; let everything else (POST /api/ping etc.) pass through untouched.
  if (req.method !== "GET") return;

  // Never intercept calls to the backend API — that data must always be live.
  if (req.url.includes("watchtogether-backend-zxwy.onrender.com")) return;

  // Page navigations: try the network first (so users always get the latest
  // build when online), fall back to the cached shell, then to the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(
          () =>
            caches.match("./index.html") ||
            caches.match("./offline.html")
        )
    );
    return;
  }

  // Static shell assets (icons, manifest, etc.): cache-first, network fallback.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});
