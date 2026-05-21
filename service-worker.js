const CACHE_NAME = 'liga-goiana-cache-v3';

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/perfil.html',
  '/jogos.html',
  '/sumulas.html',
  '/sumula-offline.html',
  '/campeonatos.html',
  '/times.html',
  '/jogadores.html',
  '/tecnicos.html',
  '/arbitros.html',
  '/assistentes.html',
  '/noticias.html',

  '/manifest.json',
  '/firebase.js',

  '/logo-liga.jfif',
  '/hero-liga.jpeg',
  '/fundo.png',
  '/patrocinio.png',

  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  if (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => caches.match(event.request).then(response => {
          return response || caches.match('/index.html');
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
