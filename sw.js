const CACHE_NAME = 'app-relatorios-v1';
const arquivosParaCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icone.png'
];

// Instala o motor e guarda os arquivos no cache
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(arquivosParaCache);
    })
  );
});

// Intercepta os acessos: se não tiver internet, puxa do cache
self.addEventListener('fetch', evento => {
  evento.respondWith(
    caches.match(evento.request).then(resposta => {
      return resposta || fetch(evento.request);
    })
  );
});