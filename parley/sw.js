// Offline support: precache the app, then serve cache-first and refresh in the background.
const VERSION = 'parley-v1';
const ASSETS = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png",
    "icon.svg",
    "css/app.css",
    "js/app.js",
    "js/avatar.js",
    "js/backdrops.js",
    "js/content/courses/clarity.js",
    "js/content/courses/confidence.js",
    "js/content/courses/connection.js",
    "js/content/courses/conversation.js",
    "js/content/courses/leadership.js",
    "js/content/courses/presence.js",
    "js/content/index.js",
    "js/content/prompts.js",
    "js/content/scenarios.js",
    "js/content/smalltalk.js",
    "js/flashcards.js",
    "js/icons.js",
    "js/lesson.js",
    "js/quiz.js",
    "js/rewards.js",
    "js/scenes.js",
    "js/sfx.js",
    "js/smalltalk.js",
    "js/speech/analysis.js",
    "js/speech/analyzer.js",
    "js/speech/capture-worklet.js",
    "js/speech/db.js",
    "js/speech/recorder.js",
    "js/store.js",
    "js/tts.js",
    "js/ui.js",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
