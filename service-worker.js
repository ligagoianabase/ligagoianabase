const CACHE_NAME = 'liga-goiana-cache-v2';

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

  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
      .catch(() => {
        return caches.match('/index.html');
      })
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
    })
  );
});
