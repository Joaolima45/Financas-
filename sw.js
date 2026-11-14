// Service worker: guarda o app no aparelho para funcionar sem internet
const CACHE = 'financas-v5';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './lib/pdf.min.js', './lib/pdf.worker.min.js', './lib/por.traineddata.gz',
  './lib/wasm/openjpeg.wasm', './lib/wasm/jbig2.wasm', './lib/wasm/qcms_bg.wasm'];
const CDN = ['cdn.jsdelivr.net']; // leitor de texto (OCR), guardado após o 1º uso

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN.includes(url.hostname)) {
    // CDN: usa o que já foi baixado; se não tiver, baixa e guarda
    e.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // App: responde do cache na hora e atualiza em segundo plano quando houver internet
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await net) || new Response('Offline', { status: 503 });
  }));
});
