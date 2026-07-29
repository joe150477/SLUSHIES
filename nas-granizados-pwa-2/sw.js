const CACHE = 'nas-granizados-v4';
const ASSETS = [
  './index.html', './data.js', './firebase-config.js', './manifest.json',
  './logo.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Cachea uno por uno para que un fallo (ej. sin internet) no rompa la instalación.
      Promise.all(ASSETS.map((url) => c.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // deja pasar las escrituras a Firebase
  // No interceptamos el tráfico de la base de datos (tiempo real).
  if (req.url.includes('firebaseio.com') || req.url.includes('google.com/')) return;

  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        // Guarda en caché copias de recursos GET válidos (app shell + SDK).
        if (res && res.status === 200 && (req.url.startsWith(self.location.origin) || req.url.includes('gstatic.com'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached)
    )
  );
});
