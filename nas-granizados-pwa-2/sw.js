const CACHE = 'nas-granizados-v11';
const CORE = [
  './', './index.html', './data.js', './firebase-config.js', './manifest.json',
  './logo.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './icons/slushie-flat.png', './icons/brownie-flat.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
];

self.addEventListener('install', (e) => {
  // Guarda una copia para poder funcionar sin internet (best-effort).
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Permite forzar activación inmediata si el cliente lo pide.
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // deja pasar escrituras a Firebase
  const url = req.url;
  if (url.includes('firebaseio.com') || url.includes('google.com/')) return; // datos en tiempo real: sin caché

  const sameOrigin = url.startsWith(self.location.origin);
  const isCode = sameOrigin && (
    req.mode === 'navigate' || /\.(html|js|json)(\?.*)?$/.test(url) || url.endsWith('/')
  );

  if (isCode) {
    // NETWORK-FIRST: online siempre trae la última versión; offline usa la copia.
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
  } else {
    // CACHE-FIRST para estáticos (iconos, logo, SDK de Firebase): rápido y estable.
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.status === 200 && (sameOrigin || url.includes('gstatic.com'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
});
