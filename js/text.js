// Plume · Rechercher / remplacer, mise en page, OCR
// ---------- Rechercher / remplacer ----------
let hits = [], hitI = -1;
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function openFind(replace) {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  $('find').hidden = false;
  if (replace) { $('frep').hidden = false; $('frepbtn').classList.add('on'); }
  $('fq').focus();
  $('fq').select();
  runFind();
}
function closeFind() { $('find').hidden = true; clearHits(); }
function clearHits() { hits.forEach(h => h.el.remove()); hits = []; hitI = -1; $('fcount').textContent = ''; }
function hitRect(h) {
  const measureW = (s, size, f) => { measure.font = `${f?.bold ? 'bold ' : ''}${size}px ${cssFamily(f)}`; return measure.measureText(s).width; };
  if (h.span) { // position approchée dans le morceau : largeur mesurée, recalée sur la largeur réelle
    const r = h.span.run, f = r.scan ? null : fontOf(h.pg, r.font), full = measureW(r.str, r.px, f) || 1, k = r.w / full;
    return [r.x + measureW(r.str.slice(0, h.start), r.px, f) * k, r.top, Math.max(2, measureW(r.str.substr(h.start, h.len), r.px, f) * k), r.px * 1.1];
  }
  const it = h.it, before = it.text.slice(0, h.start), line = before.split('\n').length - 1, col = before.slice(before.lastIndexOf('\n') + 1);
  return [it.x + measureW(col, it.size, it.font), it.y + line * L * it.size, Math.max(2, measureW(it.text.substr(h.start, h.len), it.size, it.font)), L * it.size];
}
function runFind(keep) {
  const q = $('fq').value, old = hitI;
  clearHits();
  if (!q) return;
  const re = new RegExp(escRe(q), 'gi');
  for (const pg of pages) {
    const found = [];
    for (const d of pg.layer.querySelectorAll('.tl')) for (const m of d.run.str.matchAll(re)) found.push({ pg, span: d, start: m.index, len: m[0].length, x: d.run.x, y: d.run.top });
    for (const it of items) if (it.pg === pg && it.type === 'text') for (const m of it.text.matchAll(re)) found.push({ pg, it, start: m.index, len: m[0].length, x: it.x, y: it.y });
    found.sort((a, b) => a.y - b.y || a.x - b.x);
    hits.push(...found);
  }
  for (const h of hits) {
    const [x, y, w, hh] = hitRect(h);
    h.el = Object.assign(document.createElement('div'), { className: 'hit' });
    Object.assign(h.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    h.pg.layer.append(h.el);
  }
  if (!hits.length) return $('fcount').textContent = '0';
  const vp = pages.indexOf(visiblePage());
  showHit(keep ? clamp(old, 0, hits.length - 1) : Math.max(0, hits.findIndex(h => pages.indexOf(h.pg) >= vp)));
}
function showHit(i) {
  if (!hits.length) return;
  hitI = (i + hits.length) % hits.length;
  hits.forEach((h, j) => h.el.classList.toggle('cur', j === hitI));
  $('fcount').textContent = `${hitI + 1} / ${hits.length}`;
  const h = hits[hitI], sc = $('pages');
  sc.scrollTo({ top: h.pg.wrap.offsetTop + h.y * Z - sc.clientHeight / 3, behavior: 'smooth' });
}
function replaceHits(list) {
  const q = $('fq').value, rep = $('fr').value, re = new RegExp(escRe(q), 'gi');
  const bySpan = new Map(), byItem = new Map();
  for (const h of list) (h.span ? bySpan : byItem).set(h.span || h.it, h);
  group(() => {
    for (const [span, h] of bySpan) { // morceau d'origine : réellement supprimé puis réécrit, comme « Corriger le texte »
      const r = span.run, text = list.length === 1 ? r.str.slice(0, h.start) + rep + r.str.slice(h.start + h.len) : r.str.replace(re, () => rep);
      editRun(span, h.pg, text, false);
    }
    for (const [it, h] of byItem) {
      const b = it.text, a = list.length === 1 ? b.slice(0, h.start) + rep + b.slice(h.start + h.len) : b.replace(re, () => rep);
      setText(it, a);
      record(() => setText(it, b), () => setText(it, a));
    }
  });
  return list.length;
}
$('findbtn').onclick = () => $('find').hidden ? openFind() : closeFind();
$('fclose').onclick = closeFind;
$('fq').oninput = () => runFind();
$('fq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); showHit(hitI + (e.shiftKey ? -1 : 1)); } if (e.key === 'Escape') closeFind(); };
$('fr').onkeydown = e => { if (e.key === 'Enter') $('fone').click(); if (e.key === 'Escape') closeFind(); };
$('fnext').onclick = () => showHit(hitI + 1);
$('fprev').onclick = () => showHit(hitI - 1);
$('frepbtn').onclick = () => { $('frep').hidden = !$('frep').hidden; $('frepbtn').classList.toggle('on', !$('frep').hidden); if (!$('frep').hidden) $('fr').focus(); };
$('fone').onclick = () => { if (hitI < 0) return; replaceHits([hits[hitI]]); runFind(true); };
$('fall').onclick = () => { if (!hits.length) return; const n = replaceHits(hits); runFind(); toast(plural(n, '{n} remplacement', '{n} remplacements')); };

// ---------- Filigrane, numéros de page, en-tête, pied de page ----------
const fillTokens = (s, n, N) => s.replaceAll('{date}', today()).replaceAll('{n}', n).replaceAll('{N}', N);
function decoItems(W, H, n, N, widthOf) { // positions communes à l'écran et au PDF (x à gauche, y = ligne de base)
  const out = [], sz = 9;
  if (deco.header) { const t = fillTokens(deco.header, n, N); out.push({ t, size: sz, x: (W - widthOf(t, sz)) / 2, y: 30 }); }
  if (deco.footer) out.push({ t: fillTokens(deco.footer, n, N), size: sz, x: 36, y: H - 22 });
  if (deco.num) {
    const t = fillTokens(deco.num, n, N), w = widthOf(t, sz);
    const [x, y] = { bc: [(W - w) / 2, H - 22], br: [W - 36 - w, H - 22], tr: [W - 36 - w, 30] }[deco.numPos];
    out.push({ t, size: sz, x, y });
  }
  return out;
}
const wmSize = (W, H, w1) => Math.min(110, .75 * Math.hypot(W, H) / w1); // w1 : largeur du filigrane à la taille 1
function renderDeco(pg, n, N) {
  const W = pg.vp.width, H = pg.vp.height;
  const w = (t, s, bold) => { measure.font = `${bold ? 'bold ' : ''}100px "Plume arial", Arial, sans-serif`; return measure.measureText(t).width * s / 100; };
  let html = '';
  if (deco.wm) html += `<span class="wm" style="font-size:${wmSize(W, H, w(deco.wm, 1, true))}px;color:${deco.wmColor};opacity:${deco.wmOpacity}">${esc(deco.wm)}</span>`;
  for (const d of decoItems(W, H, n, N, w)) html += `<span style="left:${d.x}px;top:${d.y - .85 * d.size}px;font-size:${d.size}px">${esc(d.t)}</span>`;
  pg.deco.innerHTML = html;
}
function setDeco(d) { deco = { ...d }; pages.forEach((p, i) => renderDeco(p, i + 1, pages.length)); changed(); }
function openDeco() {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  $('dwm').value = deco.wm; $('dwmop').value = Math.round(deco.wmOpacity * 100);
  document.querySelectorAll('#dwmcolors .sw').forEach(s => s.classList.toggle('on', s.dataset.c === deco.wmColor));
  $('dnum').value = deco.num; $('dnumpos').value = deco.numPos; $('dhead').value = deco.header; $('dfoot').value = deco.footer;
  $('decodlg').showModal();
}
$('decobtn').onclick = openDeco;
$('decocancel').onclick = () => $('decodlg').close();
$('dwmchips').onclick = e => { const b = e.target.closest('button'); if (b) $('dwm').value = b.dataset.wm; };
$('dwmcolors').onclick = e => { const c = e.target.dataset.c; if (c) document.querySelectorAll('#dwmcolors .sw').forEach(s => s.classList.toggle('on', s.dataset.c === c)); };
$('decook').onclick = () => {
  const a = { wm: $('dwm').value.trim(), wmColor: document.querySelector('#dwmcolors .sw.on')?.dataset.c || '#c62828', wmOpacity: $('dwmop').value / 100,
              num: $('dnum').value, numPos: $('dnumpos').value, header: $('dhead').value.trim(), footer: $('dfoot').value.trim() };
  const b = deco;
  setDeco(a);
  record(() => setDeco(b), () => setDeco(a));
  $('decodlg').close();
};

// ---------- Reconnaissance de texte (OCR) des pages scannées ----------
async function ocrPage(pg, btn = document.createElement('button'), quiet) {
  const label = btn.innerHTML;
  btn.disabled = true;
  try {
    btn.textContent = tr('Chargement de la reconnaissance…');
    await loadScript(here('lib/tesseract/tesseract.min.js'));
    const worker = await Tesseract.createWorker(lang === 'en' ? 'eng' : 'fra', 1, {
      workerPath: here('lib/tesseract/worker.min.js'), corePath: here('lib/tesseract/'), langPath: here('lib/tesseract/lang'),
      logger: m => { if (m.status === 'recognizing text') btn.textContent = tr('Lecture du texte… {p} %', { p: Math.round(m.progress * 100) }); },
    });
    const k = 2, vp = pg.pdfPage.getViewport({ scale: k, rotation: pg.vp.rotation }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await pg.pdfPage.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const { data } = await worker.recognize(c);
    await worker.terminate();
    pg.ocr = [];
    for (const l of data.lines) {
      const str = l.text.trim(), b = l.bbox;
      if (!str || l.confidence < 35) continue;
      const bl = l.baseline?.has_baseline ? (l.baseline.y0 + l.baseline.y1) / 2 : b.y1 - (b.y1 - b.y0) * .2;
      const px = clamp((bl - b.y0) / .72 / k, 4, 200);
      pg.ocr.push({ str, px, x: b.x0 / k, top: bl / k - .85 * px, w: (b.x1 - b.x0) / k, scan: true, box: [b.x0 / k, b.y0 / k, b.x1 / k, b.y1 / k] });
    }
    pg.ocr.forEach(r => addRun(pg, r));
    pg.wrap.classList.add('ocrdone');
    if (!quiet) toast(pg.ocr.length ? plural(pg.ocr.length, '{n} ligne reconnue : clique dessus pour la corriger.', '{n} lignes reconnues : clique sur une ligne pour la corriger.') : 'Aucun texte reconnu sur cette page.', pg.ocr.length ? '' : 'error');
    changed();
  } catch (e) {
    console.error(e);
    toast('La reconnaissance du texte a échoué.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}
