// Plume · Ouverture des fichiers, pages (rendu à la demande), zoom, formulaires
// ---------- Ouverture des fichiers ----------
const isPdf = f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
const isImg = f => f.type.startsWith('image/');
const isEncrypted = b => /\/Encrypt[\s/<]/.test(new TextDecoder('latin1').decode(b));
const isSigned = b => /\/ByteRange\s*\[/.test(new TextDecoder('latin1').decode(b)); // signature électronique : toute modification l'invalide

// PDF protégé : on demande le mot de passe puis on travaille sur une copie déchiffrée
async function decrypt(bytes, name) {
  const mupdf = await getMupdf(), doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  if (doc.needsPassword()) {
    let text = tr('« {name} » est protégé. Entre son mot de passe pour l\'ouvrir.', { name });
    for (;;) {
      const r = await ask({ title: 'PDF protégé', text, input: { type: 'password', placeholder: 'Mot de passe' },
                            buttons: [{ label: 'Annuler', value: 0 }, { label: 'Ouvrir', value: 1, primary: true }] });
      if (!r?.v) throw new Error('annulé');
      if (doc.authenticatePassword(r.text)) break;
      text = tr('Mot de passe incorrect, réessaie.');
    }
  }
  return doc.saveToBuffer('encrypt=none').asUint8Array().slice(); // copie : la vue MuPDF pointe sur une mémoire réutilisée ensuite
}

async function addSource(bytes, name) {
  if (isEncrypted(bytes)) bytes = await decrypt(bytes, name);
  const signed = isSigned(bytes);
  if (signed) toast(tr('« {name} » est signé électroniquement : le modifier annulera sa signature.', { name }), '', null, 7000);
  bytes = await repairText(bytes);
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise; // pdf.js détache le buffer qu'on lui donne
  const src = { name, bytes, doc, fields: {}, fields0: {}, signed }, list = [];
  for (let i = 0; i < doc.numPages; i++) list.push({ src, index: i, rot: 0, pdfPage: await doc.getPage(i + 1) });
  sources.push(src);
  if (bytes.length > BIG_PDF) setTimeout(() => repairLater(src), 1500);
  return list;
}
// Gros fichier : ligatures réparées après l'ouverture ; si besoin, le texte cliquable est relu depuis le PDF corrigé
async function repairLater(src) {
  const fixed = await repairText(src.bytes, true);
  if (fixed === src.bytes || !sources.includes(src)) return;
  src.bytes = fixed; // l'enregistrement et le copier-coller en profitent
  src.doc = await pdfjsLib.getDocument({ data: fixed.slice() }).promise;
  for (const pg of pages.filter(p => p.src === src)) { pg.pdfPage = await src.doc.getPage(pg.index + 1); await rebuildPage(pg); }
}

// Photos → PDF : une page A4 par image (dans le sens de l'image)
async function imagesToPdf(files) {
  const pdf = await PDFLib.PDFDocument.create();
  for (const f of files) {
    const im = await normImage(f, 3000);
    if (!im) continue;
    const e = im.type === 'image/png' ? await pdf.embedPng(im.bytes) : await pdf.embedJpg(im.bytes);
    const [W, H] = im.w > im.h ? [841.89, 595.28] : [595.28, 841.89], k = Math.min(W / im.w, H / im.h);
    pdf.addPage([W, H]).drawImage(e, { x: (W - im.w * k) / 2, y: (H - im.h * k) / 2, width: im.w * k, height: im.h * k });
  }
  if (!pdf.getPageCount()) throw new Error('images illisibles');
  return pdf.save();
}

async function openFiles(files, mode) {
  files = [...files];
  const pdfs = files.filter(f => isPdf(f) || isDocx(f)), imgs = files.filter(isImg);
  if (!pdfs.length && !imgs.length) return files.length && toast("Ce fichier n'est ni un PDF, ni un document Word, ni une image.", 'error');
  if (!mode && pages.length) {
    if (!pdfs.length) { // des images alors qu'un document est ouvert
      mode = await ask({ title: 'Ajouter des images', text: 'Où mettre ces images ?', buttons: [
        { label: 'Annuler', value: null }, { label: 'Sur la page affichée', value: 'place' }, { label: 'Comme nouvelles pages', value: 'append', primary: true }] });
      if (mode === 'place') return imgs.forEach(insertImageFile);
    } else mode = await ask({
      title: 'Un document est déjà ouvert', text: tr('Que faire de « {names} » ?', { names: files.map(f => f.name).join(', ') }),
      buttons: [{ label: 'Annuler', value: null }, { label: 'Remplacer', value: 'replace' }, { label: 'Ajouter à la suite', value: 'append', primary: true }] });
    if (!mode) return;
  }
  const list = [];
  try {
    for (const f of pdfs) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isDocx(f)) { list.push({ bytes, name: f.name }); continue; }
      try { list.push({ bytes: await docxToPdf(bytes), name: baseName(f.name) + '.pdf', made: true }); } // document Word converti en PDF
      catch (e) { console.error(e); toast(tr('« {name} » : document Word illisible.', { name: f.name }), 'error'); }
    }
    if (imgs.length) list.push({ bytes: await imagesToPdf(imgs), name: (imgs.length === 1 ? baseName(imgs[0].name) : 'Images') + '.pdf', made: true });
  } catch (e) { return toast('Impossible de lire ces images.', 'error'); }
  if (!list.length) return;
  return openSources(list, mode || 'replace');
}
// Ajoute des PDF (octets) au document : « replace » repart de zéro, « append » ajoute à la suite (annulable)
async function openSources(list, mode, quiet, at) {
  try {
    if (mode === 'replace') resetDoc();
    at ??= pages.length;
    const first = !pages.length, all = [];
    for (const s of list) all.push(...await addSource(s.bytes, s.name));
    if (first) $('expname').value = baseName(list[0].name) + (list[0].made ? '' : tr(' - rempli'));
    await showEntries(all, at);
    if (!first) {
      let stash = [];
      record(() => { stash = all.map(p => removePage(p).its); }, () => { pages.splice(at, 0, ...all); mount(); stash.flat().forEach(it => attach(it)); });
      if (!quiet) toast(plural(all.length, '{n} page ajoutée', '{n} pages ajoutées'));
    }
    changed();
    if (first) setTimeout(maybeTour, 600);
    return all;
  } catch (e) {
    console.error(e);
    if (e.message !== 'annulé') toast("Impossible d'ouvrir ce fichier : PDF invalide ou endommagé.", 'error');
    if (!pages.length) resetDoc();
  }
}
$('file').onchange = e => { openFiles(e.target.files); e.target.value = ''; };
$('addfile').onchange = e => { openFiles(e.target.files, 'append'); e.target.value = ''; };
const desk = $('desk');
desk.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); desk.classList.add('over'); } };
desk.ondragleave = e => { if (!desk.contains(e.relatedTarget)) desk.classList.remove('over'); };
desk.ondrop = e => { desk.classList.remove('over'); if (e.dataTransfer.files.length) { e.preventDefault(); openFiles(e.dataTransfer.files); } };
addEventListener('dragover', e => e.preventDefault()); // évite que le navigateur ouvre le fichier à la place de l'outil
addEventListener('drop', e => e.preventDefault());

function resetDoc() {
  select(null);
  closeFind();
  closeGrid?.();
  renderQueue.clear();
  items = []; pages = []; sources = []; past = []; future = []; bookmarks = [];
  mount();
  $('undo').disabled = $('redo').disabled = true;
}

// ---------- Pages ----------
// Repère d'affichage d'une page : rotation d'origine + la nôtre, et recadrage éventuel (zone en points PDF)
function viewportOf(pg, scale = 1) {
  const rotation = (pg.pdfPage.rotate + pg.rot) % 360;
  const vp = pg.pdfPage.getViewport({ scale, rotation });
  if (!pg.crop) return vp;
  const PageViewport = vp.constructor; // classe non exportée par pdf.js : on la prend sur un repère existant
  return new PageViewport({ viewBox: pg.crop, scale, rotation, offsetX: 0, offsetY: 0 });
}
async function showEntries(list, at = pages.length, onBuilt) {
  const first = !pages.length;
  list.forEach(makeDom);
  pages.splice(at, 0, ...list);
  mount();
  if (first) fitWidth(true);
  for (const pg of list) { await buildPage(pg); onBuilt?.(pg); }
}

function makeDom(pg) {
  pg.vp = viewportOf(pg);
  pg.vp0 = pg.pdfPage.getViewport({ scale: 1 });
  const wrap = pg.wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.pg = pg;
  wrap.style.setProperty('--w', pg.vp.width);
  wrap.style.setProperty('--h', pg.vp.height);
  wrap.innerHTML = `<div class="layer"><canvas class="pdf"></canvas><div class="deco"></div></div>
    <button class="btn ocr"><svg class="i" viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5"/></svg>${esc(tr('Page scannée · Reconnaître le texte'))}</button>`;
  pg.layer = wrap.firstChild;
  pg.canvas = pg.layer.firstChild;
  pg.deco = pg.layer.children[1];
  pg.renderedZ = null;
  pg.layer.onpointerdown = e => down(e, pg);
  pg.layer.oncontextmenu = e => { if (!e.target.closest('.box, .img, .fieldbox, svg.shape *')) { e.preventDefault(); openPageMenu(e, pg); } };
  pg.layer.ondragover = e => e.preventDefault();
  pg.layer.ondrop = e => { // signature ou tampon glissé depuis le panneau
    const d = e.dataTransfer.getData('text/plain');
    if (!/^(sig|stamp):/.test(d)) return;
    e.preventDefault(); e.stopPropagation();
    const [x, y] = toBase(pg, e);
    if (d.startsWith('sig:') && sigs[d.slice(4)]) placeImage(sigs[d.slice(4)], pg, x, y, 100);
    if (d.startsWith('stamp:')) placeStamp(d.slice(6), pg, x, y);
  };
  wrap.querySelector('.ocr').onclick = e => ocrPage(pg, e.currentTarget);
  makeThumb(pg);
  pageIO.observe(wrap);
  pg.built = false;
}
const toBase = (pg, e) => { const r = pg.layer.getBoundingClientRect(); return [(e.clientX - r.left) / Z, (e.clientY - r.top) / Z]; };

async function buildPage(pg) {
  // zones cliquables sur chaque ligne de texte du PDF (outil « Corriger le texte ») : les morceaux voisins de même police,
  // que le PDF découpe souvent au milieu d'un mot (« fil » + « s Léonard »), sont réunis ; une tabulation sépare deux zones
  // Le style (gras, italique) n'est connu qu'une fois la page dessinée : refineRuns sépare alors les styles différents.
  const tc = await pg.pdfPage.getTextContent();
  let n = 0, cur = null, space = false;
  const flush = () => { if (cur) { addRun(pg, runOf(cur.parts, cur)); n++; } cur = null; };
  for (const t of tc.items) {
    if (!t.str) continue;
    const tx = pdfjsLib.Util.transform(pg.vp.transform, t.transform), px = Math.hypot(tx[2], tx[3]);
    if (Math.abs(tx[1]) > 0.01 * px || tx[0] <= 0) continue; // ponytail: texte penché, vertical ou à l'envers à l'écran ignoré
    const x = tx[4], base = tx[5], blank = !t.str.trim(), end = cur && cur.parts.at(-1), gap = cur ? x - (end.x + end.w) : 0;
    if (cur && Math.abs(base - cur.base) < .2 * px && (blank || Math.abs(px - cur.px) < .08 * px && gap > -.5 * px && gap < 1.2 * px)) {
      if (blank) { space = true; continue; } // espace seul : sa largeur (tabulation ?) ne compte pas
      const sep = (space || gap > .15 * px) && !/\s$/.test(end.str) && !/^\s/.test(t.str) ? ' ' : '';
      cur.parts.push({ str: sep + t.str, font: t.fontName, x, w: t.width });
    } else {
      flush();
      if (!blank) cur = { px, base, parts: [{ str: t.str, font: t.fontName, x, w: t.width }] };
    }
    space = false;
  }
  flush();
  pg.ocr?.forEach(r => addRun(pg, r));
  // page « scannée » = sans texte mais avec une image (une page blanche n'en est pas une)
  const O = pdfjsLib.OPS, imgOps = [O.paintImageXObject, O.paintJpegXObject, O.paintInlineImageXObject];
  pg.wrap.classList.toggle('scan', !n && (await pg.pdfPage.getOperatorList()).fnArray.some(f => imgOps.includes(f)));
  pg.wrap.classList.toggle('ocrdone', !!pg.ocr);
  await buildFields(pg);
  pg.built = true;
  refineRuns(pg);
}
// Ligne de texte faite de morceaux consécutifs
function runOf(parts, { px, base }) {
  const a = parts[0], z = parts.at(-1), raw = parts.map(p => p.str).join('').trimStart(); // raw : avec les espaces de fin comptés dans la largeur
  return { str: raw.trim(), raw, font: a.font, parts, px, base, x: a.x, top: base - 0.85 * px, w: z.x + z.w - a.x };
}
const styleOf = (pg, id) => { const f = fontOf(pg, id); return [f.family, f.bold, f.italic].join('|'); };
// Une fois les polices connues (page dessinée) : une ligne mêlant plusieurs styles devient une zone par style,
// pour qu'une correction garde le gras ou l'italique du reste de la ligne
function refineRuns(pg) {
  if (!pg.built) return false;
  let split = false;
  for (const d of [...pg.layer.querySelectorAll('.tl')]) {
    const r = d.run;
    if (!r.parts || r.fonts || !r.parts.every(p => pg.pdfPage.commonObjs.has(p.font))) continue;
    const groups = [];
    for (const p of r.parts) {
      const s = styleOf(pg, p.font);
      if (groups.at(-1)?.s === s) groups.at(-1).parts.push(p); else groups.push({ s, parts: [p] });
    }
    const runs = groups.map(g => Object.assign(runOf(g.parts, r), { fonts: [...new Set(g.parts.map(p => fontOf(pg, p.font).ps))] }));
    if (runs.length === 1) { r.fonts = runs[0].fonts; continue; }
    d.replaceWith(...runs.map(x => runDiv(x)));
    split = true;
  }
  if (split) claimSpans(pg);
  if (split && !$('find').hidden) runFind(true); // résultats de recherche posés sur les anciennes zones
  return split;
}
// Lignes d'origine déjà corrigées (reprise d'une sauvegarde, lignes re-séparées par style) : retirées de la page, rattachées à leur élément
const sameRun = (a, b) => a.str === b.str && Math.abs(a.x - b.x) < .5 && Math.abs(a.top - b.top) < .5;
function claimSpans(pg) {
  const free = [...pg.layer.querySelectorAll('.tl')];
  for (const it of items) if (it.pg === pg) runsOf(it).forEach((r, i) => {
    const d = free.find(d => sameRun(d.run, r));
    if (!d) return;
    d.remove();
    if (it.runs) { (it.spans ??= [])[i] = d; it.runs[i] = d.run; } else { it.span = d; it.run = d.run; }
  });
}
// Polices d'une page connues sans la dessiner (recherche sur des pages pas encore affichées)
async function ensureFonts(pg) {
  if (![...pg.layer.querySelectorAll('.tl')].some(d => d.run.parts && !d.run.fonts)) return;
  await pg.pdfPage.getOperatorList();
  refineRuns(pg);
}
function runDiv(r) {
  const d = document.createElement('div');
  d.className = 'tl';
  d.run = r;
  Object.assign(d.style, { left: r.x + 'px', top: r.top + 'px', width: r.w + 'px', height: r.px * 1.1 + 'px' });
  return d;
}
const addRun = (pg, r) => pg.layer.append(runDiv(r));
// Reconstruit l'affichage d'une page (après rotation ou recadrage)
async function rebuildPage(pg) {
  const w = pg.wrap, t = pg.thumb, its = items.filter(i => i.pg === pg);
  its.forEach(i => i.host.remove());
  pageIO.unobserve(w);
  makeDom(pg);
  w.replaceWith(pg.wrap);
  t.replaceWith(pg.thumb);
  mount();
  await buildPage(pg);
  its.forEach(i => { pg.layer.append(i.host); draw(i); }); // ponytail: recadrage refusé si des textes d'origine sont corrigés (voir cropPage)
  claimSpans(pg); // lignes déjà corrigées : pas de nouvelle zone cliquable par-dessus
}

// ---------- Rendu à la demande ----------
// Seules les pages proches de l'écran sont dessinées ; les pages éloignées libèrent leur mémoire (gros documents)
const renderQueue = new Set();
let pumping = false;
const pageIO = new IntersectionObserver(entries => {
  for (const e of entries) {
    const pg = e.target.pg;
    pg.near = e.isIntersecting;
    if (pg.near && pg.renderedZ !== Z) renderQueue.add(pg);
    if (!pg.near && pg.renderedZ && pages.length > 8) freeCanvas(pg);
  }
  pump();
}, { root: $('pages'), rootMargin: '150% 0px' });
function distToView(pg) {
  const box = $('pages').getBoundingClientRect(), r = pg.wrap.getBoundingClientRect();
  return Math.abs((r.top + r.bottom) / 2 - (box.top + box.height / 2));
}
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (renderQueue.size) {
      const pg = [...renderQueue].sort((a, b) => distToView(a) - distToView(b))[0]; // la plus proche d'abord
      renderQueue.delete(pg);
      if (pg.near && pages.includes(pg) && pg.renderedZ !== Z) await renderCanvas(pg);
    }
  } finally { pumping = false; }
}
function freeCanvas(pg) {
  pg.task?.cancel();
  const c = Object.assign(document.createElement('canvas'), { className: 'pdf', width: 1, height: 1 });
  pg.canvas.replaceWith(c);
  pg.canvas = c;
  pg.renderedZ = null;
}
async function renderCanvas(pg) {
  pg.task?.cancel();
  const z = Z, s = Math.min(z * (devicePixelRatio || 1), Math.sqrt(16e6 / (pg.vp.width * pg.vp.height)));
  const vp = viewportOf(pg, s), c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height; c.className = 'pdf';
  pg.task = pg.pdfPage.render({ canvasContext: c.getContext('2d', { willReadFrequently: true }), viewport: vp });
  try { await pg.task.promise; } catch { return; } // rendu annulé (zoom, page éloignée)
  pg.canvas.replaceWith(c); // remplacé une fois prêt : pas de clignotement
  pg.canvas = c;
  pg.renderedZ = z;
  refineRuns(pg);
  for (const it of items) if (it.pg === pg && it.needSample) { resample(it); draw(it); } // couleurs relevées sur une page pas encore dessinée
}
const ensureRendered = async pg => { if (pg.renderedZ == null) await renderCanvas(pg); };

const ICON = {
  left: '<path d="M4 4v5h5"/><path d="M4.6 9A8 8 0 1 1 4 13"/>',
  right: '<path d="M20 4v5h-5"/><path d="M19.4 9A8 8 0 1 0 20 13"/>',
  extract: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  png: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
};
function makeThumb(pg) {
  const t = pg.thumb = document.createElement('div');
  t.className = 'pthumb';
  t.draggable = true;
  t.pg = pg;
  const btn = (a, title) => `<button data-a="${a}" title="${esc(tr(title))}" ${a === 'del' ? 'class="danger"' : ''}><svg class="i" viewBox="0 0 24 24">${ICON[a]}</svg></button>`;
  t.innerHTML = `<canvas></canvas><span class="pn"></span><div class="pact">${btn('left', 'Pivoter à gauche')}${btn('right', 'Pivoter à droite')}${btn('del', 'Supprimer la page')}${btn('extract', 'Télécharger cette page (PDF)')}${btn('png', 'Enregistrer cette page en image')}${btn('more', 'Autres actions')}</div>`;
  t.onclick = e => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'left') userRotate(pg, -90);
    else if (a === 'right') userRotate(pg, 90);
    else if (a === 'extract') openExport([pg]);
    else if (a === 'png') pageToImage(pg);
    else if (a === 'del') userDeletePage(pg);
    else if (a === 'more') openPageMenu(e, pg);
    else $('pages').scrollTo({ top: pg.wrap.offsetTop - 70, behavior: 'smooth' }); // vertical seulement : le bord gauche reste visible
  };
  t.oncontextmenu = e => { e.preventDefault(); openPageMenu(e, pg); };
  t.ondragstart = e => { e.dataTransfer.setData('text/plain', 'page:' + pages.indexOf(pg)); e.dataTransfer.effectAllowed = 'move'; };
  pg.thumbDone = false;
  thumbIO.observe(t);
}
// Miniatures dessinées quand elles deviennent visibles dans le panneau
const thumbIO = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting && !e.target.pg.thumbDone) renderThumb(e.target.pg);
}, { root: $('thumbs'), rootMargin: '300px 0px' });
async function renderThumb(pg, c = pg.thumb.querySelector('canvas'), width = 124) {
  if (c === pg.thumb.querySelector('canvas')) pg.thumbDone = true;
  const vp = viewportOf(pg, width * (devicePixelRatio || 1) / pg.vp.width);
  c.width = vp.width; c.height = vp.height;
  await pg.pdfPage.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.catch(() => {});
}
const clearMarks = () => document.querySelectorAll('.pthumb.before, .pthumb.after').forEach(t => t.classList.remove('before', 'after'));
$('thumbs').ondragover = e => {
  const t = e.target.closest('.pthumb');
  e.preventDefault();
  clearMarks();
  if (t) { const r = t.getBoundingClientRect(); t.classList.add(e.clientY < r.top + r.height / 2 ? 'before' : 'after'); }
};
$('thumbs').ondragleave = e => { if (!$('thumbs').contains(e.relatedTarget)) clearMarks(); };
$('thumbs').ondrop = e => {
  const d = e.dataTransfer.getData('text/plain'), t = e.target.closest('.pthumb'), after = t?.classList.contains('after');
  clearMarks();
  if (!d.startsWith('page:') || !t) return;
  e.preventDefault(); e.stopPropagation();
  const from = +d.slice(5);
  let to = pages.findIndex(p => p.thumb === t) + (after ? 1 : 0);
  if (from < to) to--;
  if (to !== from) { movePage(from, to); record(() => movePage(to, from), () => movePage(from, to)); }
};

function mount() {
  $('pages').replaceChildren(...pages.map(p => p.wrap));
  $('thumbs').replaceChildren(...pages.map(p => p.thumb));
  pages.forEach((p, i) => { p.wrap.dataset.n = tr('PAGE {n} / {N}', { n: i + 1, N: pages.length }); p.thumb.querySelector('.pn').textContent = i + 1; renderDeco(p, i + 1, pages.length); });
  $('pcount').textContent = pages.length ? plural(pages.length, '{n} page', '{n} pages') : '';
  document.body.classList.toggle('loaded', pages.length > 0);
  $('fname').textContent = [...new Set(pages.map(p => p.src.name))].join(' + ') || tr('Aucun fichier');
  curPage();
  if (!$('grid').hidden) renderGrid();
}
function removePage(pg) {
  const i = pages.indexOf(pg), its = items.filter(it => it.pg === pg);
  its.forEach(detach);
  pages.splice(i, 1);
  mount();
  return { i, its };
}
function userDeletePage(pg) {
  if (pages.length === 1) return toast('Un document doit garder au moins une page.', 'error');
  const { i, its } = removePage(pg);
  record(() => { pages.splice(i, 0, pg); mount(); its.forEach(it => attach(it)); }, () => removePage(pg));
  toast(tr('Page {n} supprimée', { n: i + 1 }), '', { label: 'Annuler', fn: undo });
}
function movePage(from, to) { const [pg] = pages.splice(from, 1); pages.splice(to, 0, pg); mount(); }
async function rotatePage(pg, d) {
  pg.rot = ((pg.rot + d) % 360 + 360) % 360;
  pg.ocr = null; // positions reconnues valables seulement dans l'ancienne orientation
  await rebuildPage(pg);
}
function userRotate(pg, d) {
  // ponytail: pivoter une page qui porte des éléments demanderait de les faire tourner aussi
  if (items.some(it => it.pg === pg)) return toast("Pivote la page avant d'y ajouter des éléments (ou retire-les).", 'error');
  rotatePage(pg, d);
  record(() => rotatePage(pg, -d), () => rotatePage(pg, d));
}
function visiblePage() {
  const box = $('pages').getBoundingClientRect(), mid = box.top + box.height / 2;
  return pages.find(p => p.wrap.getBoundingClientRect().bottom > mid) || pages.at(-1);
}
function curPage() {
  const pg = visiblePage();
  pages.forEach(p => p.thumb.classList.toggle('cur', p === pg));
  pg?.thumb.scrollIntoView({ block: 'nearest' });
}
let scrollRaf;
$('pages').addEventListener('scroll', () => { cancelAnimationFrame(scrollRaf); scrollRaf = requestAnimationFrame(curPage); });

// Page → image PNG (avec toutes les modifications)
async function pageToImage(pg) {
  try {
    toast("Préparation de l'image…");
    const mupdf = await getMupdf(), doc = mupdf.Document.openDocument(await build([pg]), 'application/pdf');
    const png = doc.loadPage(0).toPixmap(mupdf.Matrix.scale(2.5, 2.5), mupdf.ColorSpace.DeviceRGB, false, true).asPNG().slice();
    download(new Blob([png], { type: 'image/png' }), `${baseName($('expname').value || 'page')} - page ${pages.indexOf(pg) + 1}.png`);
  } catch (e) { console.error(e); toast("Impossible de créer l'image.", 'error'); }
}

// ---------- Zoom ----------
let zoomT;
function setZoom(z) {
  z = clamp(z, 0.3, 4);
  const sc = $('pages'), cy = (sc.scrollTop + sc.clientHeight / 2) / Math.max(1, sc.scrollHeight);
  Z = z;
  sc.style.setProperty('--z', Z);
  sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2;
  $('zoomval').textContent = Math.round(Z * 75) + ' %'; // 100 % = taille réelle (1 pt = 1/72 po, écran à 96 ppp)
  clearTimeout(zoomT);
  zoomT = setTimeout(() => { pages.forEach(p => { if (p.near) renderQueue.add(p); }); pump(); }, 160);
}
let autoFit = true; // tant qu'on n'a pas zoomé à la main, la page suit la largeur de la fenêtre (rotation du téléphone…)
function fitWidth(first) {
  autoFit = true;
  const sc = $('pages'), cs = getComputedStyle(sc), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 12;
  const maxW = Math.max(1, ...pages.map(p => p.vp.width)), avail = sc.clientWidth - pad;
  setZoom(first ? Math.min(avail / maxW, 2) : avail / maxW);
}
const zoomBy = k => { autoFit = false; setZoom(Z * k); };
$('zin').onclick = () => zoomBy(1.2);
$('zout').onclick = () => zoomBy(1 / 1.2);
$('zoomval').onclick = () => fitWidth();
desk.addEventListener('wheel', e => { if (!e.ctrlKey || !pages.length) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
let fitT;
addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => { if (autoFit && pages.length) fitWidth(); }, 200); });

// ---------- Formulaires PDF (champs interactifs) ----------
async function buildFields(pg) {
  const src = pg.src;
  for (const a of await pg.pdfPage.getAnnotations()) {
    if (a.subtype !== 'Widget' || !a.fieldName || a.hidden || a.pushButton || a.fieldType === 'Sig') continue;
    const k = a.fieldName, [x1, y1, x2, y2] = pg.vp.convertToViewportRectangle(a.rect);
    const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (!(k in src.fields0)) src.fields0[k] = a.fieldValue ?? '';
    if (!(k in src.fields)) src.fields[k] = src.fields0[k];
    let el;
    if (a.fieldType === 'Tx') {
      el = document.createElement(a.multiLine ? 'textarea' : 'input');
      if (a.maxLen) el.maxLength = a.maxLen;
      el.value = src.fields[k] || '';
      el.oninput = () => setField(src, k, el.value, el);
    } else if (a.fieldType === 'Btn' && (a.checkBox || a.radioButton)) {
      const on = a.checkBox ? a.exportValue : a.buttonValue;
      el = Object.assign(document.createElement('input'), { type: a.checkBox ? 'checkbox' : 'radio', value: on });
      if (a.radioButton) el.name = 'f' + sources.indexOf(src) + ':' + k;
      el.checked = String(src.fields[k]) === String(on);
      el.onchange = () => setField(src, k, el.checked ? on : 'Off', el);
    } else if (a.fieldType === 'Ch') {
      el = document.createElement('select');
      for (const o of a.options || []) el.add(new Option(o.displayValue, o.exportValue));
      el.value = [].concat(src.fields[k])[0] ?? '';
      el.onchange = () => setField(src, k, el.value, el);
    } else continue;
    const fs = a.defaultAppearanceData?.fontSize || clamp(h * (a.multiLine ? .45 : .7), 6, 12);
    Object.assign(el, { className: 'field', disabled: !!a.readOnly, title: a.alternativeText || '' });
    el.dataset.k = k;
    el.source = src;
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', fontSize: fs + 'px' });
    pg.layer.append(el);
  }
}
function setField(src, k, v, from) {
  src.fields[k] = v;
  for (const el of document.querySelectorAll('.field')) { // même champ présent plusieurs fois
    if (el === from || el.source !== src || el.dataset.k !== k) continue;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.value === v; else el.value = v;
  }
  changed();
}
