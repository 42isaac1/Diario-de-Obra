const CACHE = "diario-campo-v1.1.0";
const ASSETS = ["/campo/","/campo/index.html","/campo/styles.css","/campo/app.js","/campo/manifest.webmanifest","/campo/icon.svg","/vendor/react.production.min.js","/vendor/react-dom.production.min.js","/vendor/pdf-lib.min.js","/vendor/jszip.min.js"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(ASSETS.map(asset => cache.add(asset)))).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("/campo/index.html"))));
});
