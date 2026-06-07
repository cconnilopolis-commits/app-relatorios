const CACHE_NAME = 'app-relatorios-v2';
const arquivosParaCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icone.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(arquivosParaCache);
    })
  );
});

self.addEventListener('fetch', evento => {
  evento.respondWith(
    caches.match(evento.request).then(resposta => {
      return resposta || fetch(evento.request);
    })
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
});