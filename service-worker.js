const CACHE = "hipoteca-control-v6-plazo";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./client-report.js?v=1", "./vendor/jspdf-4.2.1.umd.min.js"];
self.addEventListener('message', event => {
  if (event.data === 'hc-team-cache-safe') event.ports[0]?.postMessage(true);
});

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hipoteca-control-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Account, authentication and case data must never enter the offline cache.
  if (url.origin !== self.location.origin || url.pathname.endsWith('/equipo.html')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
