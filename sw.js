// Plume : fonctionne hors ligne une fois ouvert en ligne.
// Pages du site : réseau d'abord (les mises à jour arrivent tout de suite), cache si hors ligne.
// Bibliothèques et polices (CDN, versions figées) : cache d'abord.
const V = 'plume-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
];
// Gros moteur (≈ 10 Mo) servant à corriger le texte, caviarder, protéger : téléchargé en arrière-plan
const LATER = [
  'https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf.js',
  'https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf-wasm.js',
  'https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf-wasm.wasm',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
    caches.open(V).then(c => c.addAll(LATER)).catch(() => {});
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const put = res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); } return res; };
  if (new URL(req.url).origin === location.origin) {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req, { ignoreSearch: true, ignoreVary: true })));
  } else {
    e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(put)));
  }
});
