const CACHE = 'dagboek-v26';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/charts.js',
  './js/backup.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  // geen skipWaiting hier: nieuwe versie wacht, zodat de app een update-melding kan tonen
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first: app werkt volledig offline; nieuwe versies komen binnen via een nieuwe cache-naam.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});

// "Vernieuwen"-knop in de app stuurt dit bericht zodat de nieuwe versie direct actief wordt
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
