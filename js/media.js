// Plume · Images, signatures, numérisation
// ---------- Images et signatures ----------
function placeImage(img, pg, cx, cy, width) {
  pg ||= visiblePage();
  if (!pg) return toast("Ouvre d'abord un PDF.", 'error');
  if (cx == null) {
    const r = pg.wrap.getBoundingClientRect(), box = $('pages').getBoundingClientRect();
    cx = pg.vp.width / 2;
    cy = clamp((box.top + box.height / 2 - r.top) / Z, 60, pg.vp.height - 60);
  }
  width = Math.min(width, pg.vp.width * .8);
  recAdd(add({ type: 'img', pg, src: img.src, ratio: img.ratio, width, x: cx - width / 2, y: cy - width / img.ratio / 2 }));
}
async function insertImageFile(file) {
  if (!isImg(file)) return toast("Ce fichier n'est pas une image.", 'error');
  const im = await normImage(file, 2000); // ponytail: images réduites à 2000 px pour garder un PDF léger
  if (!im) return toast('Image illisible.', 'error');
  placeImage({ src: im.canvas.toDataURL(im.type, .9), ratio: im.w / im.h }, null, null, null, 180);
}
$('imgfile').onchange = e => { if (e.target.files[0]) insertImageFile(e.target.files[0]); e.target.value = ''; };
const typing = () => { const a = document.activeElement; return /^(TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || (a.tagName === 'INPUT' && !/^(color|checkbox|radio|file|range)$/.test(a.type)); };
// Copier / couper / coller : éléments de Plume, ou image venant d'ailleurs
addEventListener('copy', e => {
  if (typing() || !selection.length) return;
  clip = selection.map(i => cloneItem(i));
  e.clipboardData.setData('text/plain', `[Plume] ${clip.length} élément(s)`); // remplace une éventuelle image dans le presse-papiers
  e.preventDefault();
});
addEventListener('cut', e => {
  if (typing() || !selection.length) return;
  clip = selection.map(i => cloneItem(i));
  e.clipboardData.setData('text/plain', `[Plume] ${clip.length} élément(s)`);
  e.preventDefault();
  delMany(selection);
});
addEventListener('paste', e => {
  if (typing() || !pages.length) return;
  const f = [...e.clipboardData.files].find(isImg);
  if (f) { e.preventDefault(); return insertImageFile(f); }
  if (clip.length && e.clipboardData.getData('text/plain').startsWith('[Plume]')) { e.preventDefault(); pasteItems(); }
});

let sigs = [];
try { sigs = JSON.parse(localStorage.signatures || '[]'); } catch {}
const saveSigs = () => {
  try { localStorage.signatures = JSON.stringify(sigs); } catch { toast('Ce navigateur refuse de mémoriser les signatures.', 'error'); }
};
function renderSigs() {
  $('siglist').innerHTML = '';
  $('sigempty').hidden = sigs.length > 0;
  sigs.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.draggable = true;
    d.title = tr('Glisse-moi sur le document, ou clique pour me poser sur la page affichée');
    d.innerHTML = `<img src="${s.src}" alt="Signature ${i + 1}"><button class="del" title="${esc(tr('Supprimer'))}"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    d.ondragstart = e => e.dataTransfer.setData('text/plain', 'sig:' + i);
    d.onclick = e => {
      if (!e.target.closest('.del')) { document.body.classList.remove('show-right'); return placeImage(s, null, null, null, 100); }
      const [gone] = sigs.splice(i, 1);
      saveSigs(); renderSigs();
      toast('Signature supprimée', '', { label: 'Annuler', fn: () => { sigs.splice(i, 0, gone); saveSigs(); renderSigs(); } });
    };
    $('siglist').append(d);
  });
}
renderSigs();
function addSig(c) { // recadre sur le tracé (pixels non transparents) et mémorise
  const o = trimCanvas(c);
  if (!o) return false;
  sigs.push({ src: o.toDataURL('image/png'), ratio: o.width / o.height });
  saveSigs(); renderSigs();
  return true;
}

const pad = $('sigpad'), pctx = pad.getContext('2d');
let ink = '#000000';
$('signew').onclick = () => {
  $('sigmsg').textContent = '';
  $('sigdlg').showModal();
  const dpr = devicePixelRatio || 1;
  pad.width = pad.clientWidth * dpr; pad.height = pad.clientHeight * dpr; // réinitialise aussi le contexte
  pctx.scale(dpr, dpr);
  Object.assign(pctx, { lineWidth: 2.6, lineCap: 'round', lineJoin: 'round', strokeStyle: ink });
};
document.querySelector('.dlg-ink').onclick = e => {
  if (!e.target.dataset.ink) return;
  ink = pctx.strokeStyle = e.target.dataset.ink;
  document.querySelectorAll('.dlg-ink .sw').forEach(s => s.classList.toggle('on', s === e.target));
};
pad.onpointerdown = e => {
  pad.setPointerCapture(e.pointerId);
  $('sigmsg').textContent = '';
  let [lx, ly] = [e.offsetX, e.offsetY];
  pad.onpointermove = ev => {
    pctx.beginPath(); pctx.moveTo(lx, ly); pctx.lineTo(ev.offsetX, ev.offsetY); pctx.stroke();
    [lx, ly] = [ev.offsetX, ev.offsetY];
  };
};
pad.onpointerup = () => pad.onpointermove = null;
$('sigclear').onclick = () => pctx.clearRect(0, 0, pad.width, pad.height);
$('sigcancel').onclick = () => $('sigdlg').close();
$('sigok').onclick = () => {
  if (!addSig(pad)) return $('sigmsg').textContent = tr("Signe d'abord dans le cadre ✍");
  $('sigdlg').close();
  toast('Signature enregistrée : glisse-la sur le document');
};
// Signature photographiée : le papier devient transparent, l'encre reste
$('sigphoto').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const im = await normImage(f, 1600);
  if (!im) return toast('Image illisible.', 'error');
  if (!addSig(transparentize(im.canvas))) return toast("Aucune signature trouvée sur la photo.", 'error');
  toast('Signature importée : glisse-la sur le document');
};

// ---------- Numériser avec l'appareil photo ----------
let scan = null; // { photo: canvas, pts: 4 coins [x, y] dans la photo, mode }
$('scanfile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const im = await normImage(f, 2400);
  if (!im) return toast('Image illisible.', 'error');
  scan = { photo: im.canvas, pts: detectCorners(im.canvas), mode: scan?.mode || 'bw' };
  const v = $('scanimg');
  v.width = im.w; v.height = im.h;
  v.getContext('2d').drawImage(im.canvas, 0, 0);
  $('scanmsg').textContent = '';
  if (!$('scandlg').open) $('scandlg').showModal();
  document.querySelectorAll('#scanmode button').forEach(b => b.classList.toggle('on', b.dataset.m === scan.mode));
  requestAnimationFrame(layoutScan);
};
// Coins de la feuille : plus grande zone claire de la photo (seuil d'Otsu), ses 4 points extrêmes
function detectCorners(c) {
  const k = 300 / Math.max(c.width, c.height), w = Math.round(c.width * k), h = Math.round(c.height * k);
  const t = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = t.getContext('2d');
  g.drawImage(c, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { lum[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114; hist[lum[i]]++; }
  let sum = 0, sumB = 0, wB = 0, best = 0, thr = 128;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    const wF = w * h - wB;
    if (!wB || !wF) continue;
    sumB += i * hist[i];
    const v = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (v > best) { best = v; thr = i; }
  }
  const seen = new Uint8Array(w * h);
  let comp = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || lum[s] <= thr) continue;
    const stack = [s], cur = [];
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % w;
      cur.push(p);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < w * h && !seen[q] && lum[q] > thr) { seen[q] = 1; stack.push(q); }
    }
    if (cur.length > comp.length) comp = cur;
  }
  if (comp.length < w * h * .15) return [[.05, .05], [.95, .05], [.95, .95], [.05, .95]].map(([a, b]) => [a * c.width, b * c.height]);
  let tl, tr, br, bl, a1 = Infinity, a2 = -Infinity, a3 = -Infinity, a4 = Infinity;
  for (const p of comp) {
    const x = p % w, y = (p / w) | 0;
    if (x + y < a1) { a1 = x + y; tl = [x, y]; }
    if (x - y > a2) { a2 = x - y; tr = [x, y]; }
    if (x + y > a3) { a3 = x + y; br = [x, y]; }
    if (x - y < a4) { a4 = x - y; bl = [x, y]; }
  }
  return [tl, tr, br, bl].map(([x, y]) => [x / k, y / k]);
}
function layoutScan() {
  if (!scan) return;
  const st = $('scanstage').getBoundingClientRect(), r = $('scanimg').getBoundingClientRect(), s = r.width / scan.photo.width;
  const P = scan.pts.map(([x, y]) => [r.left - st.left + x * s, r.top - st.top + y * s]);
  document.querySelectorAll('.hdl').forEach((h, i) => Object.assign(h.style, { left: P[i][0] + 'px', top: P[i][1] + 'px' }));
  $('scansvg').innerHTML = `<polygon points="${P.map(p => p.join(',')).join(' ')}" fill="#d4472b22" stroke="#d4472b" stroke-width="2"/>`;
}
addEventListener('resize', () => { if ($('scandlg').open) layoutScan(); });
document.querySelectorAll('.hdl').forEach((h, i) => {
  h.onpointerdown = e => {
    h.setPointerCapture(e.pointerId);
    h.onpointermove = ev => {
      const r = $('scanimg').getBoundingClientRect(), s = r.width / scan.photo.width;
      scan.pts[i] = [clamp((ev.clientX - r.left) / s, 0, scan.photo.width), clamp((ev.clientY - r.top) / s, 0, scan.photo.height)];
      layoutScan();
    };
  };
  h.onpointerup = () => h.onpointermove = null;
});
$('scanmode').onclick = e => {
  const m = e.target.dataset.m;
  if (!m) return;
  scan.mode = m;
  document.querySelectorAll('#scanmode button').forEach(b => b.classList.toggle('on', b === e.target));
};
$('scancancel').onclick = () => $('scandlg').close();
function filterScan(o, w, h, mode) {
  const N = w * h, lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = o[i * 4] * .299 + o[i * 4 + 1] * .587 + o[i * 4 + 2] * .114;
  if (mode === 'bw') { // seuil adaptatif : chaque pixel comparé à la moyenne de son voisinage (image intégrale)
    const S = new Float64Array((w + 1) * (h + 1)), r = Math.round(w / 32);
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += lum[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; } }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const mean = (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const i = (y * w + x) * 4;
      o[i] = o[i + 1] = o[i + 2] = lum[y * w + x] < mean * .88 ? 0 : 255;
    }
    return;
  }
  // niveaux étirés : fond bien blanc, texte bien noir
  const hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) hist[lum[i] | 0]++;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 254 && (acc += hist[lo]) < N * .01) lo++;
  acc = 0;
  while (hi > lo + 1 && (acc += hist[hi]) < N * .05) hi--;
  const k = 255 / (hi - lo);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    if (mode === 'gray') o[j] = o[j + 1] = o[j + 2] = clamp((lum[i] - lo) * k, 0, 255);
    else for (let c = 0; c < 3; c++) o[j + c] = clamp((o[j + c] - lo) * k, 0, 255);
  }
}
$('scanok').onclick = async () => {
  const btn = $('scanok');
  btn.classList.add('busy');
  try {
    const mupdf = await getMupdf(), { photo, pts, mode } = scan;
    const jpg = new Uint8Array(await (await new Promise(r => photo.toBlob(r, 'image/jpeg', .95))).arrayBuffer());
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const W0 = Math.max(dist(pts[0], pts[1]), dist(pts[3], pts[2])), H0 = Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2]));
    let ratio = H0 / W0;
    if (Math.abs(ratio - Math.SQRT2) < .12) ratio = Math.SQRT2; // presque une feuille A4 : on cale sur l'A4
    const OW = 1654, OH = Math.min(5000, Math.round(OW * ratio)); // 1654 px = A4 à 200 ppp
    const out = new mupdf.Image(jpg).toPixmap().warp(pts, OW, OH), px = out.getPixels(), n = px.length / (OW * OH);
    const c = Object.assign(document.createElement('canvas'), { width: OW, height: OH }), g = c.getContext('2d'), id = g.createImageData(OW, OH), o = id.data;
    for (let i = 0, j = 0; i < OW * OH; i++, j += n) { o[i * 4] = px[j]; o[i * 4 + 1] = px[j + (n > 2 ? 1 : 0)]; o[i * 4 + 2] = px[j + (n > 2 ? 2 : 0)]; o[i * 4 + 3] = 255; }
    filterScan(o, OW, OH, mode);
    g.putImageData(id, 0, 0);
    const type = mode === 'bw' ? 'image/png' : 'image/jpeg', blob = await new Promise(r => c.toBlob(r, type, .85));
    const pdf = await PDFLib.PDFDocument.create(), bytes = new Uint8Array(await blob.arrayBuffer());
    const e = type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes), W = 595.28, H = W * OH / OW;
    pdf.addPage([W, H]).drawImage(e, { x: 0, y: 0, width: W, height: H });
    $('scandlg').close();
    if (await openSources([{ bytes: await pdf.save(), name: 'Numérisation.pdf', made: true }], pages.length ? 'append' : 'replace', true)) {
      $('pages').scrollTo({ top: $('pages').scrollHeight, behavior: 'smooth' });
      toast('Page numérisée ajoutée', '', { label: 'Photo suivante', fn: () => $('scanfile').click() });
    }
  } catch (e) {
    console.error(e);
    $('scanmsg').textContent = tr('Impossible de traiter la photo.');
  } finally {
    btn.classList.remove('busy');
  }
};
