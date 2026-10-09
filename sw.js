/* Service worker do Preços — mude CACHE a cada versão nova do app */
const CACHE = 'precos-v1_62';
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
/* Rede primeiro (pega versão nova quando online), mas com limite de 3 s: se a rede estiver lenta ou
   "meio caída", abre pelo cache na hora e a resposta da rede ainda atualiza o cache em segundo plano. */
const REDE_TIMEOUT_MS = 3000;
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
  e.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const rede = fetch(req).then(res=>{
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const doCache = ()=> cache.match(req).then(r=> r || cache.match('./index.html'));
    const timeout = new Promise(res=> setTimeout(()=>res(null), REDE_TIMEOUT_MS));
    try{
      const res = await Promise.race([rede, timeout]);
      if(res) return res;
      const c = await doCache();
      if(c){ e.waitUntil(rede.catch(()=>{})); return c; }
      return await rede;
    }catch(err){
      const c = await doCache();
      if(c) return c;
      throw err;
    }
  })());
});
