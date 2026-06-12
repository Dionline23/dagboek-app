const CACHE = 'dagboek-v2';
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
  self.skipWaiting();
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
