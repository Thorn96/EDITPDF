// Rature · Images, signatures, numérisation
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
// Copier / couper / coller : éléments de Rature, ou image venant d'ailleurs
addEventListener('copy', e => {
  if (typing() || !selection.length) return;
  clip = selection.map(i => cloneItem(i));
  e.clipboardData.setData('text/plain', `[Rature] ${clip.length} élément(s)`); // remplace une éventuelle image dans le presse-papiers
  e.preventDefault();
});
addEventListener('cut', e => {
  if (typing() || !selection.length) return;
  clip = selection.map(i => cloneItem(i));
  e.clipboardData.setData('text/plain', `[Rature] ${clip.length} élément(s)`);
  e.preventDefault();
  delMany(selection);
});
addEventListener('paste', e => {
  if (typing() || !pages.length) return;
  const f = [...e.clipboardData.files].find(isImg);
  if (f) { e.preventDefault(); return insertImageFile(f); }
  if (clip.length && e.clipboardData.getData('text/plain').startsWith('[Rature]')) { e.preventDefault(); pasteItems(); }
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
  track('signature');
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
let scan = null; // { photo: canvas, pts: 4 coins [x, y] dans la photo, mode, purpose : 'page' (feuille) ou 'stamp' (tampon d'entreprise) }
// entrées photo : l'accueil et les panneaux, « Reprendre la photo » (même usage), l'écran téléphone → ordinateur, la création de tampon
const scanInput = (id, purpose) => { $(id).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startScan(f, purpose || scan?.purpose); }; };
scanInput('scanfile', 'page'); scanInput('relaycam', 'page'); scanInput('stampimg', 'stamp'); scanInput('scanretake');
const SCAN_TEXT = { page: ['Numériser', 'Place les 4 coins sur les bords de la feuille : elle sera redressée.', 'Ajouter la page'],
                    stamp: ['Recadrer le tampon', 'Place les 4 coins autour du tampon : le fond blanc sera retiré.', 'Créer le tampon'] };
async function startScan(f, purpose = 'page') {
  const im = await normImage(f, 4000); // pleine définition d'un téléphone : c'est elle qui fait la netteté du scan
  if (!im) return toast('Image illisible.', 'error');
  const stamp = purpose === 'stamp';
  // tampon : cadre de départ au centre (la détection cherche une feuille entière, pas un tampon)
  scan = { photo: im.canvas, pts: stamp ? [[.2, .3], [.8, .3], [.8, .7], [.2, .7]].map(([a, b]) => [a * im.w, b * im.h]) : detectCorners(im.canvas),
           mode: stamp ? 'color' : scan?.purpose === 'page' ? scan.mode : 'color', purpose }; // couleur par défaut : signatures bleues et tampons gardent leur couleur
  const v = $('scanimg');
  v.width = im.w; v.height = im.h;
  v.getContext('2d').drawImage(im.canvas, 0, 0);
  $('scanmsg').textContent = '';
  const [title, help, ok] = SCAN_TEXT[purpose];
  $('scandlg').querySelector('.dlg-head h3').textContent = tr(title);
  $('scandlg').querySelector('.dlg-head p').textContent = tr(help);
  $('scanok').lastChild.textContent = tr(ok);
  $('scandlg').querySelector('.scanbar').hidden = stamp; // un tampon garde ses couleurs
  if (!$('scandlg').open) $('scandlg').showModal();
  document.querySelectorAll('#scanmode button').forEach(b => b.classList.toggle('on', b.dataset.m === scan.mode));
  requestAnimationFrame(layoutScan);
}
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
  $('scansvg').innerHTML = `<polygon points="${P.map(p => p.join(',')).join(' ')}" fill="#e2494f22" stroke="#e2494f" stroke-width="2"/>`;
}
addEventListener('resize', () => { if ($('scandlg').open) layoutScan(); });
// Loupe : au doigt, le coin est caché sous le doigt ; on montre la zone agrandie au-dessus, avec une croix de visée et les bords de la feuille
const LOUPE = 132, LOUPE_ZOOM = 3;
function drawLoupe(i) {
  const L = $('scanloupe'), r = $('scanimg').getBoundingClientRect(), st = $('scanstage').getBoundingClientRect(), s = r.width / scan.photo.width;
  const [px, py] = scan.pts[i], hx = r.left - st.left + px * s, hy = r.top - st.top + py * s, dpr = devicePixelRatio || 1, W = Math.round(LOUPE * dpr);
  if (L.width !== W) L.width = L.height = W;
  const g = L.getContext('2d'), k = LOUPE_ZOOM * s * dpr, a = scan.pts[(i + 3) % 4], b = scan.pts[(i + 1) % 4];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#111'; g.fillRect(0, 0, W, W);
  g.setTransform(k, 0, 0, k, W / 2 - px * k, W / 2 - py * k); // la photo agrandie, centrée sur le coin
  g.drawImage(scan.photo, 0, 0);
  g.lineWidth = 2.5 / k * dpr; g.strokeStyle = '#e2494f';
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(px, py); g.lineTo(b[0], b[1]); g.stroke(); // bords vers les deux coins voisins
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [w, col] of [[4 * dpr, '#fff'], [1.5 * dpr, '#e2494f']]) { // croix de visée
    g.lineWidth = w; g.strokeStyle = col;
    g.beginPath(); g.moveTo(W / 2 - 14 * dpr, W / 2); g.lineTo(W / 2 + 14 * dpr, W / 2); g.moveTo(W / 2, W / 2 - 14 * dpr); g.lineTo(W / 2, W / 2 + 14 * dpr); g.stroke();
  }
  // au-dessus du doigt ; sans la place (coin du haut), sur le côté, vers le centre : jamais en dessous, là où est la main
  const above = hy - LOUPE - 40, side = hx < st.width / 2 ? hx + 44 : hx - 44 - LOUPE;
  const [lx, ly] = above >= 0 ? [hx - LOUPE / 2, above] : [side, hy - LOUPE / 2];
  Object.assign(L.style, { left: clamp(lx, 0, st.width - LOUPE) + 'px', top: clamp(ly, 0, st.height - LOUPE) + 'px' });
  L.hidden = false;
}
document.querySelectorAll('.hdl').forEach((h, i) => {
  h.onpointerdown = e => {
    h.setPointerCapture(e.pointerId);
    drawLoupe(i);
    h.onpointermove = ev => {
      const r = $('scanimg').getBoundingClientRect(), s = r.width / scan.photo.width;
      scan.pts[i] = [clamp((ev.clientX - r.left) / s, 0, scan.photo.width), clamp((ev.clientY - r.top) / s, 0, scan.photo.height)];
      layoutScan();
      drawLoupe(i);
    };
  };
  h.onpointerup = h.onpointercancel = () => { h.onpointermove = null; $('scanloupe').hidden = true; };
});
$('scanmode').onclick = e => {
  const m = e.target.dataset.m;
  if (!m) return;
  scan.mode = m;
  document.querySelectorAll('#scanmode button').forEach(b => b.classList.toggle('on', b === e.target));
};
$('scancancel').onclick = () => $('scandlg').close();
// Rendu « scanner », comme les applis de numérisation : l'éclairage du papier est estimé sur toute la photo puis retiré (ombres,
// zones plus sombres, teinte jaune d'une lampe disparaissent : papier blanc), puis le contraste est réglé en douceur. Le noir et blanc
// garde des bords de lettres lisses au lieu d'un seuil brutal (traits fins cassés, grain du papier en taches).
function filterScan(o, w, h, mode) {
  const N = w * h, B = 16, bw = Math.max(2, Math.ceil(w / B)), bh = Math.max(2, Math.ceil(h / B)), nb = bw * bh;
  // 1. couleur du papier, canal par canal : moyenne par bloc de 16 px, puis maximum sur ~50 px (l'encre disparaît), puis lissage
  let bg = [0, 1, 2].map(() => new Float32Array(nb));
  const cnt = new Float32Array(nb);
  for (let y = 0; y < h; y++) {
    const row = Math.min(bh - 1, y / B | 0) * bw;
    for (let x = 0, i = y * w * 4; x < w; x++, i += 4) { const b = row + Math.min(bw - 1, x / B | 0); bg[0][b] += o[i]; bg[1][b] += o[i + 1]; bg[2][b] += o[i + 2]; cnt[b]++; }
  }
  const pass = (m, r, f) => { // filtre séparable (maximum ou moyenne) de rayon r blocs
    const t = new Float32Array(nb), out = new Float32Array(nb);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let a = 0, n = 0; for (let k = Math.max(0, x - r); k <= Math.min(bw - 1, x + r); k++) { const v = m[y * bw + k]; a = f === 'max' ? Math.max(a, v) : a + v; n++; } t[y * bw + x] = f === 'max' ? a : a / n; }
    for (let x = 0; x < bw; x++) for (let y = 0; y < bh; y++) { let a = 0, n = 0; for (let k = Math.max(0, y - r); k <= Math.min(bh - 1, y + r); k++) { const v = t[k * bw + x]; a = f === 'max' ? Math.max(a, v) : a + v; n++; } out[y * bw + x] = f === 'max' ? a : a / n; }
    return out;
  };
  bg = bg.map(m => { for (let b = 0; b < nb; b++) m[b] = Math.max(1, m[b] / Math.max(1, cnt[b])); return pass(pass(pass(m, 3, 'max'), 2, 'avg'), 2, 'avg'); });
  // 2. chaque pixel divisé par la couleur du papier sous lui (interpolée) : papier ≈ 1, encre < 1
  const xs = new Int32Array(w), xw = new Float32Array(w);
  for (let x = 0; x < w; x++) { const f = clamp((x + .5) / B - .5, 0, bw - 1.001); xs[x] = f | 0; xw[x] = f - xs[x]; }
  const L = new Float32Array(N), hist = new Uint32Array(1024);
  for (let y = 0; y < h; y++) {
    const fy = clamp((y + .5) / B - .5, 0, bh - 1.001), y0 = fy | 0, wy = fy - y0, r0 = y0 * bw, r1 = r0 + bw;
    for (let x = 0, i = y * w * 4, p = y * w; x < w; x++, i += 4, p++) {
      const a = xs[x], wx = xw[x];
      let l = 0;
      for (let c = 0; c < 3; c++) {
        const m = bg[c], top = m[r0 + a] + (m[r0 + a + 1] - m[r0 + a]) * wx, bot = m[r1 + a] + (m[r1 + a + 1] - m[r1 + a]) * wx;
        const v = Math.min(1.2, o[i + c] / (top + (bot - top) * wy));
        o[i + c] = Math.min(255, v * 212.5); // gardé en réserve (1,2 → 255) pour la couleur
        l += v * (c === 0 ? .299 : c === 1 ? .587 : .114);
      }
      L[p] = l;
    }
  }
  // netteté (masque flou, comme un scanner) : le contour des lettres ressort ; le grain du papier, lui, est lissé
  { const T = new Float32Array(N), r = 2, n = 2 * r + 1;
    for (let y = 0; y < h; y++) { const o0 = y * w; let a = 0; for (let x = -r; x <= r; x++) a += L[o0 + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { T[o0 + x] = a / n; a += L[o0 + Math.min(w - 1, x + r + 1)] - L[o0 + Math.max(0, x - r)]; } }
    const col = new Float32Array(h);
    for (let x = 0; x < w; x++) {
      let a = 0; for (let y = -r; y <= r; y++) a += T[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { col[y] = a / n; a += T[Math.min(h - 1, y + r + 1) * w + x] - T[Math.max(0, y - r) * w + x]; }
      for (let y = 0; y < h; y++) { const p = y * w + x, dv = L[p] - col[y]; L[p] = Math.abs(dv) < .1 ? col[y] : Math.max(0, L[p] + .7 * dv); } // zone unie (papier) lissée, contour renforcé
    } }
  for (let p = 0; p < N; p++) hist[Math.min(1023, L[p] * 852 | 0)]++; // 1,2 → 1023
  // 3. niveaux : l'encre la plus foncée devient noire, tout ce qui ressemble au papier devient blanc
  const at = q => { let acc = 0; for (let k = 0; k < 1024; k++) if ((acc += hist[k]) >= N * q) return k / 852; return 1.2; };
  // point blanc : la teinte du papier (la majorité des pixels), moins une marge pour le grain → tout le papier devient blanc
  const paper = at(.5), hi = clamp(paper - .07, .7, .95), lo = Math.min(hi - .25, at(.004));
  const tone = v => Math.pow(clamp((v - lo) / (hi - lo), 0, 1), 1.25); // léger assombrissement des gris : texte plus lisible
  let lut;
  if (mode === 'bw') { // seuil d'Otsu sur l'image corrigée, avec une transition douce (anti-crénelage)
    let sum = 0, sumB = 0, wB = 0, best = 0, t = .7;
    for (let k = 0; k < 1024; k++) sum += k * hist[k];
    for (let k = 0; k < 1024; k++) {
      wB += hist[k]; const wF = N - wB; if (!wB || !wF) continue;
      sumB += k * hist[k]; const v = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
      if (v > best) { best = v; t = k / 852; }
    }
    t = clamp(lo + (t - lo) * .8, lo + .06, .8); // un peu sous le seuil d'Otsu : traits fins, lettres pas empâtées
    lut = Float32Array.from({ length: 1024 }, (_, k) => 255 / (1 + Math.exp(-(k / 852 - t) / .03)));
  } else lut = Float32Array.from({ length: 1024 }, (_, k) => 255 * tone(k / 852));
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const k = Math.min(1023, L[p] * 852 | 0), out = lut[k];
    if (mode === 'color') { // luminosité du rendu gris + couleur d'origine ; les écarts de couleur trop faibles (bruit du capteur) sont retirés
      const r = o[i] / 212.5, g = o[i + 1] / 212.5, b = o[i + 2] / 212.5, l0 = r * .299 + g * .587 + b * .114;
      const ch = Math.max(Math.abs(r - l0), Math.abs(g - l0), Math.abs(b - l0)), keep = clamp((ch - .04) / .05, 0, 1) * 255 * 1.15;
      o[i] = clamp(out + (r - l0) * keep, 0, 255); o[i + 1] = clamp(out + (g - l0) * keep, 0, 255); o[i + 2] = clamp(out + (b - l0) * keep, 0, 255);
    } else o[i] = o[i + 1] = o[i + 2] = out;
  }
}
$('scanok').onclick = async () => {
  await libsReady();
  const btn = $('scanok');
  btn.classList.add('busy');
  try {
    const mupdf = await getMupdf(), { photo, pts, mode } = scan;
    const jpg = new Uint8Array(await (await new Promise(r => photo.toBlob(r, 'image/jpeg', .95))).arrayBuffer());
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const W0 = Math.max(dist(pts[0], pts[1]), dist(pts[3], pts[2])), H0 = Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2]));
    const stamp = scan.purpose === 'stamp';
    let ratio = H0 / W0;
    if (!stamp && Math.abs(ratio - Math.SQRT2) < .12) ratio = Math.SQRT2; // presque une feuille A4 : on cale sur l'A4
    // feuille : 2480 px de large (A4 à 300 ppp, comme un scanner) ; tampon : sa taille réelle dans la photo, au plus 1200 px
    const OW = stamp ? Math.round(clamp(W0, 60, 1200)) : 2480, OH = Math.min(5000, Math.round(OW * ratio));
    const out = new mupdf.Image(jpg).toPixmap().warp(pts, OW, OH), px = out.getPixels(), n = px.length / (OW * OH);
    const c = Object.assign(document.createElement('canvas'), { width: OW, height: OH }), g = c.getContext('2d'), id = g.createImageData(OW, OH), o = id.data;
    for (let i = 0, j = 0; i < OW * OH; i++, j += n) { o[i * 4] = px[j]; o[i * 4 + 1] = px[j + (n > 2 ? 1 : 0)]; o[i * 4 + 2] = px[j + (n > 2 ? 2 : 0)]; o[i * 4 + 3] = 255; }
    if (!stamp) filterScan(o, OW, OH, mode);
    g.putImageData(id, 0, 0);
    if (stamp) { $('scandlg').close(); return saveImageStamp(c); } // tampon : couleurs gardées, fond blanc retiré
    const type = mode === 'bw' ? 'image/png' : 'image/jpeg', blob = await new Promise(r => c.toBlob(r, type, .9));
    const pdf = await PDFLib.PDFDocument.create(), bytes = new Uint8Array(await blob.arrayBuffer());
    const e = type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes), W = 595.28, H = W * OH / OW;
    pdf.addPage([W, H]).drawImage(e, { x: 0, y: 0, width: W, height: H });
    $('scandlg').close();
    const made = await pdf.save();
    if (sendToDesk(made)) return; // téléphone relié à un ordinateur : la page part sur son écran
    if (await openSources([{ bytes: made, name: 'Numérisation.pdf', made: true }], pages.length ? 'append' : 'replace', true)) {
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
