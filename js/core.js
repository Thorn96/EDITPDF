// Plume · Base : utilitaires, traduction, fenêtres, historique
// Tout est hébergé sur le site (lib/, fonts/) : rien n'est demandé à un autre serveur
const here = p => new URL(p, document.baseURI).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = here('lib/pdfjs/pdf.worker.min.js');
const $ = id => document.getElementById(id), measure = document.createElement('canvas').getContext('2d');
measure.fontKerning = 'none'; // mesures sans crénage, comme le texte écrit dans le PDF
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Unités : les éléments sont stockés en points PDF, dans le repère de la page affichée (origine en haut à gauche).
const L = 1.2, BASE = 0.345; // interligne ; ligne de base = milieu de la ligne + 0,345 em
const NOTE_BG = '#fff3a8', NOTE_EDGE = '#e2c94a';
let sources = [], pages = [], items = [], past = [], future = [], selection = [], clip = [];
let tool = 'text', current = null, Z = 1, stampKind = 'check', penColor = '#000000', hlColor = '#ffd84d';
const DECO0 = { wm: '', wmColor: '#c62828', wmOpacity: .15, num: '', numPos: 'bc', header: '', footer: '' };
let deco = { ...DECO0 };

// ---------- Langue ----------
// Le texte français sert de clé ; EN (i18n.js) donne la traduction anglaise
let lang = 'fr';
const EN = {};
function tr(s, vars) {
  let t = lang === 'en' && EN[s] || s;
  if (vars) for (const k in vars) t = t.replaceAll(`{${k}}`, vars[k]);
  return t;
}
const plural = (n, one, many) => tr(n > 1 ? many : one, { n });
const today = () => new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');

// ---------- Petits outils ----------
function toast(msg, kind = '', action) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.append(tr(msg));
  if (action) {
    const b = document.createElement('button');
    b.textContent = tr(action.label);
    b.onclick = () => { action.fn(); t.remove(); };
    t.append(b);
  }
  $('toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, action ? 6000 : 3800);
}

// Fenêtre de question générique : résout avec la valeur du bouton (et le texte saisi), ou null si on ferme
function ask({ title, text = '', html = '', input, buttons }) {
  return new Promise(res => {
    const dlg = $('askdlg');
    $('asktitle').textContent = tr(title);
    $('asktext').textContent = tr(text);
    $('askbody').innerHTML = html;
    let inp;
    if (input) { inp = Object.assign(document.createElement('input'), input, { className: 'txt' }); if (input.placeholder) inp.placeholder = tr(input.placeholder); $('askbody').append(inp); }
    $('askfoot').replaceChildren(...buttons.map(b => {
      const x = document.createElement('button');
      x.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
      x.textContent = tr(b.label);
      x.onclick = () => { dlg.close(); res(inp ? { v: b.value, text: inp.value } : b.value); };
      return x;
    }));
    if (inp) inp.onkeydown = e => { if (e.key === 'Enter') $('askfoot').querySelector('.primary')?.click(); };
    dlg.oncancel = () => res(null);
    dlg.showModal();
    inp?.focus();
  });
}

const loadScript = src => new Promise((ok, ko) => {
  if ([...document.scripts].some(s => s.src === src)) return ok();
  document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: ko }));
});
let mupdfP;
const getMupdf = () => mupdfP ??= import(here('lib/mupdf/mupdf.js')).catch(e => { mupdfP = null; throw e; });
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return PDFLib.rgb((n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const baseName = n => n.replace(/\.[^.]+$/, '');
// Point tourné de `deg` degrés (sens horaire à l'écran) autour du centre c
function rotPt(x, y, c, deg) {
  if (!deg) return [x, y];
  const a = deg * Math.PI / 180, dx = x - c[0], dy = y - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}
function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function loadImg(file) {
  const url = URL.createObjectURL(file), img = new Image();
  img.src = url;
  try { await img.decode(); return img; } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
// Image redressée (orientation de l'appareil photo), réduite à `max` px, en PNG (transparence) ou JPEG
async function normImage(file, max) {
  const img = await loadImg(file);
  if (!img) return null;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const type = /png|gif|webp|svg/.test(file.type) ? 'image/png' : 'image/jpeg';
  const blob = await new Promise(r => c.toBlob(r, type, .9));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type, w: c.width, h: c.height, canvas: c };
}
// Photo d'un tracé sur papier (signature, tampon) : le papier devient transparent, l'encre reste
function transparentize(c) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data, N = c.width * c.height;
  const lum = new Uint8Array(N), hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) { lum[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114; hist[lum[i]]++; }
  const pct = p => { let acc = 0; for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= N * p) return v; return 255; };
  const paper = pct(.6), inkL = pct(.005), span = Math.max(30, paper - inkL);
  for (let i = 0; i < N; i++) d[i * 4 + 3] = clamp(((paper - lum[i]) / span * 1.4 - .2) * 255, 0, 255);
  g.putImageData(id, 0, 0);
  return c;
}
// Recadre une image transparente sur ses pixels visibles ; null si elle est vide
function trimCanvas(c) {
  const { width: W, height: H } = c, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const o = Object.assign(document.createElement('canvas'), { width: x1 - x0 + 1, height: y1 - y0 + 1 });
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

// Archive ZIP sans compression (les PDF sont déjà compressés) : [{ name, data: Uint8Array }] → Blob
function makeZip(files) {
  const crcTable = makeZip.t ??= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = d => { let c = ~0; for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); // nom en UTF-8
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
    parts.push(h, name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(c, name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// ---------- Historique (annuler / rétablir) ----------
let batch = null;
function record(undoFn, redoFn) {
  if (batch) return batch.push({ undo: undoFn, redo: redoFn });
  past.push({ undo: undoFn, redo: redoFn, t: Date.now() });
  if (past.length > 300) past.shift();
  future = [];
  changed();
}
// Plusieurs actions d'un coup (tout remplacer, toutes les pages…) = une seule étape d'annulation
function group(fn) {
  const outer = batch;
  batch = [];
  try { return fn(); } finally {
    const list = batch;
    batch = outer;
    if (list.length) record(() => [...list].reverse().forEach(x => x.undo()), () => list.forEach(x => x.redo()));
  }
}
function undo() { const a = past.pop(); if (!a) return toast('Rien à annuler.'); a.undo(); future.push(a); changed(); }
function redo() { const a = future.pop(); if (!a) return toast('Rien à rétablir.'); a.redo(); past.push(a); changed(); }
let saveT;
function changed() {
  $('undo').disabled = !past.length;
  $('redo').disabled = !future.length;
  clearTimeout(saveT);
  saveT = setTimeout(autosave, 900);
}
$('undo').onclick = undo;
$('redo').onclick = redo;
