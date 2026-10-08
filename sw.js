/* Service worker do Preços — mude CACHE a cada versão nova do app */
const CACHE = 'precos-v1_55';
const ARQUIVOS = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
/* Rede primeiro (pega versão nova quando online), cache se estiver offline */
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res && res.ok){ const copia = res.clone(); caches.open(CACHE).then(c=>c.put(req, copia)); }
      return res;
    }).catch(()=> caches.match(req).then(r=> r || caches.match('./index.html')))
  );
});
