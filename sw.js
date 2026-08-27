/* StrengthPath Service Worker
   ⚠️ ファイルを更新したら必ず CACHE のバージョンを上げること */
const CACHE = 'strengthpath-v10';
const ASSETS = ['./','./index.html','./manifest.json',
  './assets/style.css','./assets/data.js','./assets/akari.js','./assets/app.js',
  './assets/akari/normal.png','./assets/akari/think.png','./assets/akari/surprised.png',
  './assets/akari/idea.png','./assets/akari/happy.png','./assets/akari/wink.png',
  './assets/akari/cat.png',
  './assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
