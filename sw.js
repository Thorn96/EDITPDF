// Plume : fonctionne hors ligne une fois ouvert en ligne. Tout est hébergé sur le site.
// Page et scripts de Plume : réseau d'abord (les mises à jour arrivent tout de suite), cache si hors ligne.
// Bibliothèques et polices (versions figées) : cache d'abord.
const V = 'plume-v2';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './css/plume.css', './fonts/ui/fonts.css', './fonts/pdf/fonts.css',
  './lib/pdfjs/pdf.min.js', './lib/pdfjs/pdf.worker.min.js', './lib/pdf-lib/pdf-lib.min.js', './lib/pdf-lib/fontkit.umd.min.js',
];
// Moteurs plus lourds (correction du texte, OCR) et polices les plus courantes : téléchargés en arrière-plan
const LATER = [
  './lib/mupdf/mupdf.js', './lib/mupdf/mupdf-wasm.js', './lib/mupdf/mupdf-wasm.wasm',
  './lib/tesseract/tesseract.min.js', './lib/tesseract/worker.min.js', './lib/tesseract/tesseract-core-simd-lstm.wasm.js', './lib/tesseract/lang/fra.traineddata.gz',
  ...['Regular', 'Bold', 'Italic', 'BoldItalic'].map(s => `./fonts/pdf/LiberationSans-${s}.ttf`),
];
const FROZEN = /\/(lib|fonts)\//; // fichiers qui ne changent jamais pour une URL donnée

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
  const put = res => { if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); } return res; };
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // rien à mettre en cache ailleurs
  if (FROZEN.test(url.pathname)) e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(put)));
  else e.respondWith(fetch(req).then(put).catch(() => caches.match(req, { ignoreSearch: true, ignoreVary: true })));
});
