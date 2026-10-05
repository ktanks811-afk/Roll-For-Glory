// Network-first service worker. Its only job is to make updates reach players:
// iPhone home-screen apps hold on to cached JS, so every same-origin request
// goes to the network (revalidating with the server, cheap 304s when nothing
// changed) and the cache is only a fallback for playing offline.
const CACHE = 'mwsr-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Songs stream in byte ranges; let the browser fetch those itself.
  if (req.destination === 'audio' || req.headers.has('range')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
