const CACHE_NAME = 'rota-comercial-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './html5-qrcode.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // network-first para o código do app: atualizações chegam assim que há rede,
  // e o cache serve como fallback offline
  const isAppShell = url.origin === self.location.origin &&
    (url.pathname.endsWith('/app.js') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'));

  if(isAppShell){
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if(res.ok){
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // demais recursos (fontes, ícones, biblioteca): cache-first com preenchimento pela rede
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if(res.ok){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return res;
      })
    )
  );
});
