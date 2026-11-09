const PREFIX = 'steady-cycle-checkin-';
const CACHE = PREFIX + 'v7';
const ROOT = new URL('./', self.registration.scope);
const SHELL = new URL('./index.html', ROOT).href;
const ASSETS = [
  './index.html', './styles.css?v=7', './app.js?v=7', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable.png'
].map(path => new URL(path, ROOT).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(SHELL))));
  } else if (ASSETS.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
  }
});
