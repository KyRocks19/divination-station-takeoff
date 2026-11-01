// Only the shared card pictures are kept for offline use. Pages are never stored: they hold the signed-in person's own
// readings and writing, and on a shared computer a stored copy would still show after they sign out (or to the next person).
// A new CACHE_NAME makes "activate" delete the older caches, which did keep copies of /, /readings, /spreads and /journals.
const CACHE_NAME = "tarot-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline · Divination Station</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1>You are offline</h1><p>Divination Station needs a connection to show your readings and writing. Nothing is kept on this device, so nobody else using it can read them.</p><p>Try again once you are back online.</p></body></html>`;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for card images (the /cards/<id> pages share the prefix and must not be stored)
  if (url.pathname.startsWith("/cards/") && /\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Pages: always from the network; offline, a plain note instead of a stored copy.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }))
    );
  }
});
