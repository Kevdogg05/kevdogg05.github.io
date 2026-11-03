/* Doodle Pals offline support: keeps the app, its icons and its libraries on the device,
   so it still opens on a tablet with no internet. The page itself is fetched fresh when
   online (so updates arrive) and falls back to the saved copy when offline. */
const CACHE = 'doodle-pals-v1';
const CORE = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './qr-code.svg'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.18/dist/index.global.js',
  'https://cdn.jsdelivr.net/npm/lucide@0.541.0/dist/umd/lucide.min.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap',
];
const CDN = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

async function keep(cache, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    if (url.includes('fonts.googleapis.com')) {
      // the font stylesheet points at the font files; keep those too
      const css = await res.clone().text();
      await Promise.all([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => keep(cache, m[1])));
    }
    await cache.put(url, res);
  } catch (e) { /* offline or blocked: the app still works with fallback fonts */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.all(LIBS.map(u => keep(cache, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('./') : Response.error())));
  } else if (CDN.test(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
