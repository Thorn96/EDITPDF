// Rature · Clavier, téléchargement, fabrication du PDF, sauvegarde, application
// ---------- Clavier ----------
addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || !$('tour').hidden) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey, a = document.activeElement;
  if (k === 'escape' && closeMenu()) return;
  if (ctrl && k === 's') { e.preventDefault(); return openExport(); }
  if (ctrl && k === 'o') { e.preventDefault(); return $('file').click(); }
  if (ctrl && k === 'f') { e.preventDefault(); return openFind(); }
  if (ctrl && k === 'h') { e.preventDefault(); return openFind(true); }
  if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); return zoomBy(1.2); }
  if (ctrl && k === '-') { e.preventDefault(); return zoomBy(1 / 1.2); }
  if (ctrl && k === '0') { e.preventDefault(); return fitWidth(); }
  if (typing()) { if (k === 'escape') a.blur(); return; }
  if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && k === 'y') { e.preventDefault(); return redo(); }
  if (ctrl && k === 'd') { e.preventDefault(); return duplicate([...selection]); }
  if (ctrl && k === 'a' && pages.length) { e.preventDefault(); const pg = visiblePage(); select(null); items.filter(i => i.pg === pg && !i.lock).forEach(i => select(i, true)); return; }
  if (ctrl || e.altKey) return;
  if (k === 'escape') {
    if (!$('grid').hidden) return closeGrid();
    if (tool === 'crop') return setTool('move');
    if (!$('find').hidden) return closeFind();
    return select(null);
  }
  if ((k === 'delete' || k === 'backspace') && selection.length) { e.preventDefault(); return delMany(selection); }
  if (selection.length && k.startsWith('arrow')) {
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    return nudge([...selection], k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0);
  }
  if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) return showHelp();
  if (k === 'i' && pages.length) return $('imgfile').click();
  if (k === 'g' && pages.length) return openGrid();
  if (KEYS[k] && pages.length) setTool(KEYS[k]);
});
function showHelp() {
  const rows = [
    ['T · E · S · N', 'Texte · Corriger le texte · Cocher, mentions · Note'], ['H · D · F', 'Surligner · Dessiner · Champ de formulaire'],
    ['R · C · L · A · K', 'Rectangle · Cercle · Trait · Flèche · Lien'], ['X · I · V', 'Caviarder · Image · Sélectionner'],
    ['G', 'Vue en grille des pages'], ['Ctrl Z · Ctrl Y', 'Annuler · Rétablir'], ['Suppr · Ctrl D', 'Effacer · Dupliquer la sélection'],
    ['Maj+clic · Ctrl A', 'Sélection multiple · Tout sélectionner sur la page'], ['Ctrl C · Ctrl X · Ctrl V', 'Copier · Couper · Coller (aussi une image)'],
    ['Clic droit', 'Menu de l\'élément ou de la page'], ['Flèches', 'Ajuster la position (Maj : ×10)'], ['Alt', 'Déplacer sans aimantation'],
    ['Ctrl F · Ctrl H', 'Rechercher · Remplacer'], ['Ctrl molette · Ctrl + / −', 'Zoomer'], ['Ctrl 0', 'Ajuster à la largeur'],
    ['Ctrl S · Ctrl O', 'Télécharger · Ouvrir'], ['Ctrl K', 'Palette de commandes : toutes les actions'], ['Échap', 'Terminer la saisie · désélectionner'],
  ];
  ask({ title: 'Raccourcis clavier', html: `<dl class="keys">${rows.map(([k, v]) => `<dt>${k.split(' ').map(x => x === '·' ? ' ' : `<kbd>${esc(tr(x))}</kbd>`).join(' ')}</dt><dd>${esc(tr(v))}</dd>`).join('')}</dl>`,
        buttons: [{ label: 'Compris', value: 1, primary: true }] });
}
$('help').onclick = showHelp;

// ---------- Tiroirs (petits écrans) ----------
$('btnPages').onclick = () => document.body.classList.toggle('show-left');
$('btnSigs').onclick = () => document.body.classList.toggle('show-right');
desk.addEventListener('pointerdown', () => document.body.classList.remove('show-left', 'show-right'), true);

// ---------- Téléchargement et partage ----------
const probe = new File([''], 'a.pdf', { type: 'application/pdf' });
$('expshare').hidden = !navigator.canShare?.({ files: [probe] });
function openExport(only) {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  document.activeElement.blur?.(); // valide le texte en cours d'écriture
  document.querySelector(`input[name=exppages][value=${only ? 'some' : 'all'}]`).checked = true;
  $('exprange').value = only ? only.map(p => pages.indexOf(p) + 1).join(', ') : '';
  $('expmsg').textContent = '';
  $('expsigned').hidden = !sources.some(s => s.signed);
  $('expdlg').showModal();
}
$('save').onclick = () => openExport();
$('expcancel').onclick = () => $('expdlg').close();
$('exprange').onfocus = () => document.querySelector('input[name=exppages][value=some]').checked = true;
$('exppw').onchange = () => { $('exppwbox').hidden = !$('exppw').checked; if ($('exppw').checked) $('exppass').focus(); };
$('expdlg').onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') $('expgo').click(); };

function parseRange(s, n) {
  const out = [];
  for (const part of s.split(/[,;]/)) {
    const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!part.trim()) continue;
    if (!m) return null;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > n) return null;
    for (let i = a; i <= b; i++) if (!out.includes(i - 1)) out.push(i - 1);
  }
  return out;
}
// Polices de l'ordinateur (Chrome/Edge) : demandées pendant le clic, seul moment où le navigateur l'autorise
const askLocalFonts = () => window.queryLocalFonts && items.some(it => it.font?.local)
  ? Promise.race([queryLocalFonts(), new Promise(r => setTimeout(r, 30000, []))]).catch(() => []) : Promise.resolve([]);

// Réglages de la fenêtre de téléchargement (null, avec un message, s'ils sont incomplets)
function exportOptions() {
  const msg = t => { $('expmsg').textContent = tr(t); return null; };
  let list = pages;
  if (document.querySelector('input[name=exppages]:checked').value === 'some') {
    const idx = parseRange($('exprange').value, pages.length);
    if (!idx?.length) { $('expmsg').textContent = tr('Indique des pages entre 1 et {n}, par exemple 1-3, 5.', { n: pages.length }); return null; }
    list = idx.map(i => pages[i]);
  }
  const pw = $('exppw').checked ? $('exppass').value : '';
  if ($('exppw').checked && !pw) return msg('Choisis un mot de passe.');
  if (pw.includes(',')) return msg('Le mot de passe ne peut pas contenir de virgule.');
  return { list, pw, compress: $('expcompress').checked, a4: $('expa4').checked, name: ($('expname').value.trim() || 'document').replace(/\.pdf$/i, '') + '.pdf' };
}
async function makePdf(o) {
  let out = await build(o.list, await askLocalFonts());
  if (o.a4) out = await toA4(out);
  if (o.pw || o.compress) out = await finish(out, o);
  return out;
}
async function exportDoc(share, ready) {
  const o = ready?.o || exportOptions();
  if (!o) return;
  const { name } = o;
  $('expdlg').close();
  $('prevdlg').close();
  const btn = $('save');
  btn.classList.add('busy');
  try {
    const out = ready?.out || await makePdf(o);
    if (!share) { download(new Blob([out], { type: 'application/pdf' }), name); return toast(tr('{name} téléchargé ✓', { name })); }
    const file = new File([out], name, { type: 'application/pdf' }), go = () => navigator.share({ files: [file], title: name }).catch(() => {});
    try { await navigator.share({ files: [file], title: name }); }
    catch (e) { // le partage doit suivre un clic : si la préparation a été longue, on redemande un clic
      if (e.name === 'NotAllowedError') toast('PDF prêt', '', { label: 'Partager', fn: go });
      else if (e.name !== 'AbortError') throw e;
    }
  } catch (err) {
    console.error(err);
    toast(/WinAnsi|cannot encode/i.test(err.message)
      ? 'Un texte contient un caractère que la police ne sait pas écrire (émoji, alphabet non latin…).'
      : tr("Erreur lors de l'enregistrement : {m}", { m: err.message }), 'error');
  } finally {
    btn.classList.remove('busy');
  }
}
$('expgo').onclick = () => exportDoc(false);
$('expshare').onclick = () => exportDoc(true);

// ---------- Avant / après : chaque page modifiée, originale à gauche, telle qu'elle sera téléchargée à droite ----------
let preview = null;
$('expprev').onclick = async () => {
  const o = exportOptions();
  if (!o) return;
  const btn = $('expprev');
  btn.classList.add('busy');
  try {
    const out = await makePdf(o), doc = await pdfjsLib.getDocument({ data: out.slice(), password: o.pw }).promise;
    preview = { o, out };
    const changed = o.list.map((pg, i) => ({ pg, i })).filter(({ pg }) => items.some(it => it.pg === pg) || pg.rot || pg.crop || deco.wm || deco.header || deco.footer || deco.num || o.a4);
    const draw = async (page, vp) => {
      const c = document.createElement('canvas'), k = Math.min(2, 900 / vp.width);
      const v = vp.clone({ scale: vp.scale * k });
      c.width = v.width; c.height = v.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
      return c;
    };
    const blocks = [];
    for (const { pg, i } of changed) {
      const p = await doc.getPage(i + 1), before = await draw(pg.pdfPage, viewportOf(pg)), after = await draw(p, p.getViewport({ scale: 1 }));
      const b = document.createElement('div');
      b.className = 'prevpage';
      b.innerHTML = `<h4>${esc(tr('Page {n}', { n: pages.indexOf(pg) + 1 }))}</h4><div class="prevpair"><figure><figcaption>${esc(tr('Avant'))}</figcaption></figure><figure><figcaption>${esc(tr('Après'))}</figcaption></figure></div>`;
      b.querySelectorAll('figure')[0].append(before);
      b.querySelectorAll('figure')[1].append(after);
      blocks.push(b);
    }
    $('prevpages').replaceChildren(...(blocks.length ? blocks : [Object.assign(document.createElement('p'), { textContent: tr('Aucune page modifiée.') })]));
    $('expdlg').close();
    $('prevdlg').showModal();
  } catch (e) {
    console.error(e);
    $('expmsg').textContent = tr("Erreur lors de l'enregistrement : {m}", { m: e.message });
  } finally { btn.classList.remove('busy'); }
};
$('prevback').onclick = () => { $('prevdlg').close(); $('expdlg').showModal(); };
$('prevgo').onclick = () => preview && exportDoc(false, preview);

// ---------- Fabrication du PDF final ----------
// Rectangle (repère de la page affichée) → repère MuPDF de la page d'origine (sans notre rotation ajoutée)
function fzRect(pg, [x0, y0, x1, y1]) {
  const a = pg.vp0.convertToViewportPoint(...pg.vp.convertToPdfPoint(x0, y0));
  const b = pg.vp0.convertToViewportPoint(...pg.vp.convertToPdfPoint(x1, y1));
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
// Ce qui change vraiment dans un texte d'origine corrigé : une ligne identique reste intacte dans le PDF, et dans une ligne
// modifiée on garde tel quel le début, jusqu'au mot où commence la modification. Seulement si l'élément n'a été ni déplacé,
// ni agrandi, ni recoloré, ni changé de police (sinon toute la ligne est réécrite).
function planEdit(it) {
  const o = it.orig, f = normFont(it.font), olines = o.lines || [{ x: o.x, top: o.top, w: o.w, str: o.str }];
  const laid = it.text.trim() ? layoutLines(it) : [], last = s => s.split(' ').at(-1);
  const same = olines.every(l => l.str != null) && o.y0 != null && Math.abs(it.x - o.x) < .01 && Math.abs(it.y - o.y0) < .01 && Math.abs(it.size - o.h) < .01
    && f.local && !f.touched && it.color === o.color && !it.rot && (it.op ?? 1) === 1 && !it.pg.rot && !it.pg.pdfPage.rotate;
  if (it.rich) return olines.map(line => ({ line, keep: same && JSON.stringify(it.segs) === o.segs, p: 0 })); // ligne mixte : intacte, ou réécrite entière
  return olines.map((l, i) => {
    const t = laid[i]?.t.trimEnd(), s = l.str.trimEnd();
    if (!same || t == null) return { line: l, p: 0 };
    if (t === s) return { line: l, keep: true };
    // ligne justifiée qui ne finit plus sur le même mot : la place libre change beaucoup, on la réécrit entière pour garder des espaces réguliers
    if (it.justify && laid[i].soft && last(t) !== last(s)) return { line: l, p: 0 };
    let p = 0;
    while (p < t.length && p < s.length && t[p] === s[p]) p++;
    return { line: l, p: s.lastIndexOf(' ', p - 1) + 1 }; // début du mot modifié
  });
}
// Position exacte, dans le PDF, du début de la partie à réécrire (MuPDF lit la place de chaque lettre) ; sinon, toute la ligne
function locateCut(pg, chars, pl, h) {
  const l = pl.line, [x0, y0, x1, y1] = fzRect(pg, [l.x - 1, l.top, l.x + l.w + 1, l.top + h * 1.1]);
  // ordre de lecture de MuPDF, sans retrier : une ligature (« tt ») donne deux lettres, la seconde placée au bout du glyphe
  const cs = chars.filter(c => c.cx > x0 && c.cx < x1 && c.cy > y0 && c.cy < y1), s = l.str;
  let i = 0, j = 0, at = -1;
  while (i < s.length && j < cs.length) { // correspondance lettre à lettre, les espaces pouvant manquer d'un côté ou de l'autre
    if (i === pl.p) at = j;
    if (s[i] === cs[j].c) { i++; j++; }
    else if (/\s/.test(cs[j].c)) j++;
    else if (/\s/.test(s[i])) i++;
    else return;
  }
  if (i === pl.p && at < 0 && j < cs.length) at = j;
  if (at < 0) return;
  const back = ([x, y]) => pg.vp.convertToViewportPoint(...pg.vp0.convertToPdfPoint(x, y))[0];
  pl.start = back([cs[at].ox, cs[at].cy]);
  pl.cut = at ? back([(cs[at - 1].x1 + cs[at].x0) / 2, cs[at].cy]) : pl.start - .5;
}
// Supprime vraiment du fichier : textes corrigés, lignes scannées corrigées, zones caviardées (MuPDF)
async function redactSource(src, its, plans) {
  const mupdf = await getMupdf(), R = mupdf.PDFPage, doc = mupdf.Document.openDocument(src.bytes, 'application/pdf');
  // place des lettres des lignes à réécrire en partie
  for (const pg of new Set(its.filter(i => plans.get(i)?.some(pl => pl.p > 0)).map(i => i.pg))) {
    const chars = [];
    doc.loadPage(pg.index).toStructuredText('preserve-whitespace').walk({
      onChar(c, origin, font, size, q) { const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
        chars.push({ c, ox: origin[0], x0: Math.min(...xs), x1: Math.max(...xs), cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 }); },
    });
    for (const it of its) if (it.pg === pg) for (const pl of plans.get(it) || []) if (pl.p > 0) locateCut(pg, chars, pl, it.orig.h);
  }
  const bands = it => { // bande intérieure à chaque ligne : MuPDF retire tout glyphe qui la touche, on évite ainsi les voisins
    const o = it.orig, pad = Math.min(2, o.h * .12);
    return (plans.get(it) || (o.lines || [o]).map(line => ({ line, p: 0 }))).filter(pl => !pl.keep)
      .map(({ line: l, cut }) => [cut ?? l.x + pad, l.top + o.h * .35, l.x + l.w - pad, l.top + o.h * .75]);
  };
  const passes = [
    [its.filter(i => i.orig && !i.orig.scan), bands,
     [false, R.REDACT_IMAGE_NONE, R.REDACT_LINE_ART_NONE, R.REDACT_TEXT_REMOVE]],
    [its.filter(i => i.orig?.scan), coverRects,
     [false, R.REDACT_IMAGE_PIXELS, R.REDACT_LINE_ART_NONE, R.REDACT_TEXT_REMOVE]],
    [its.filter(i => i.type === 'redact'), i => [[i.x, i.y, i.x2, i.y2]],
     [true, R.REDACT_IMAGE_PIXELS, R.REDACT_LINE_ART_REMOVE_IF_COVERED, R.REDACT_TEXT_REMOVE]],
  ];
  for (const [list, rectsOf, args] of passes) {
    const touched = new Map();
    for (const it of list) {
      if (!touched.has(it.pg)) touched.set(it.pg, doc.loadPage(it.pg.index));
      for (const r of rectsOf(it)) touched.get(it.pg).createAnnotation('Redact').setRect(fzRect(it.pg, r));
    }
    for (const page of touched.values()) page.applyRedactions(...args);
  }
  return doc.saveToBuffer('compress').asUint8Array().slice(); // copie : la vue MuPDF pointe sur une mémoire réutilisée ensuite
}

async function fillForm(doc, src) {
  const keys = Object.keys(src.fields).filter(k => String(src.fields[k]) !== String(src.fields0[k]));
  if (!keys.length) return;
  const { PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, StandardFonts, PDFName, PDFBool } = PDFLib;
  const form = doc.getForm();
  for (const k of keys) {
    const v = src.fields[k];
    try {
      const f = form.getField(k);
      if (f instanceof PDFTextField) f.setText(v || undefined);
      else if (f instanceof PDFCheckBox) v && v !== 'Off' ? f.check() : f.uncheck();
      else if (f instanceof PDFRadioGroup) { // l'état coché s'appelle parfois par son numéro d'option
        const o = f.getOptions();
        v && v !== 'Off' ? f.select(o.includes(v) ? v : o[+v]) : f.clear();
      }
      else if (f instanceof PDFDropdown || f instanceof PDFOptionList) f.select(v);
    } catch (e) { console.warn('Champ', k, e); }
  }
  try { form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica)); }
  catch { form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True); } // le lecteur dessinera les valeurs
}

function wrapText(text, maxW, font, size) {
  const out = [];
  for (const para of text.replace(/\t/g, '    ').split('\n')) {
    if (!maxW) { out.push(para); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (line.trim() && font.widthOfTextAtSize((line + word).trimEnd(), size) > maxW) { out.push(line.trimEnd()); line = word.trimStart(); }
      else line += word;
    }
    out.push(line);
  }
  return out;
}
// Caractères absents de la police choisie (✓, →, alphabets…) : écrits avec DejaVu Sans, qui en contient beaucoup plus
const hasGlyph = (font, ch) => { const f = font.embedder?.font; return typeof f?.hasGlyphForCodePoint !== 'function' || f.hasGlyphForCodePoint(ch.codePointAt(0)); };
function glyphRuns(str, font, fb) {
  const runs = [];
  for (const ch of str) {
    const f = fb && !hasGlyph(font, ch) && hasGlyph(fb, ch) ? fb : font;
    if (runs.at(-1)?.[1] === f) runs.at(-1)[0] += ch; else runs.push([ch, f]);
  }
  return runs;
}

async function build(list, localFonts = []) {
  const { PDFDocument, degrees, rgb, LineCapStyle, BlendMode, StandardFonts } = PDFLib;
  // 1. par fichier source : suppressions réelles (MuPDF) puis formulaire rempli
  const used = [...new Set(list.map(p => p.src))], docs = new Map(), plans = new Map();
  for (const it of items) if (list.includes(it.pg) && it.orig && !it.orig.scan) plans.set(it, planEdit(it));
  for (const s of used) {
    const its = items.filter(i => i.pg.src === s && list.includes(i.pg));
    const d = await PDFDocument.load(its.some(i => i.orig || i.type === 'redact') ? await redactSource(s, its, plans) : s.bytes);
    await fillForm(d, s);
    docs.set(s, d);
  }
  // 2. assemblage. Ordre d'origine d'un seul fichier : on le modifie sur place (formulaire toujours remplissable, signets…).
  //    Sinon (fusion, pages déplacées, dupliquées) : nouveau document où l'on copie les pages dans l'ordre.
  // ponytail: dans le second cas les champs de formulaire d'origine restent visibles mais ne sont plus modifiables
  const target = new Map(), inPlace = used.length === 1 && list.every((p, i) => !i || p.index > list[i - 1].index);
  let pdf;
  if (inPlace) {
    pdf = docs.get(used[0]);
    const own = pdf.getPages(), keep = new Set(list.map(p => p.index));
    list.forEach(p => target.set(p, own[p.index]));
    for (let i = own.length - 1; i >= 0; i--) if (!keep.has(i)) pdf.removePage(i);
  } else {
    pdf = await PDFDocument.create();
    for (const s of used) {
      const need = list.filter(p => p.src === s);
      (await pdf.copyPages(docs.get(s), need.map(p => p.index))).forEach((pp, i) => target.set(need[i], pp));
    }
    for (const p of list) pdf.addPage(target.get(p));
  }
  for (const p of list) {
    const pp = target.get(p);
    pp.setRotation(degrees((p.pdfPage.rotate + p.rot) % 360));
    if (p.crop) { const [x0, y0, x1, y1] = p.crop; pp.setCropBox(x0, y0, x1 - x0, y1 - y0); }
  }
  // 3. éléments ajoutés, dans leur ordre d'empilement, puis mise en page (filigrane, numéros, en-tête, pied)
  pdf.registerFontkit(fontkit);
  const imgs = {}, fonts = {}, newFields = [];
  const font = f => pdfFont(pdf, f, fonts, localFonts);
  let fams; // polices du PDF par famille, lues au premier texte d'origine corrigé
  for (const [n, p] of list.entries()) {
    const page = target.get(p), pageRot = p.vp.rotation, rotate = degrees(pageRot);
    const P = (x, y) => p.vp.convertToPdfPoint(x, y), pt = (x, y) => { const [X, Y] = P(x, y); return { x: X, y: Y }; };
    const box = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [c, d] = P(x1, y1); return { x: Math.min(a, c), y: Math.min(b, d), width: Math.abs(c - a), height: Math.abs(d - b) }; };
    const line = (a, b, thickness, color, opacity) => page.drawLine({ start: a, end: b, thickness, color, opacity, lineCap: LineCapStyle.Round });
    // contour quelconque (points à l'écran) : sert aux cadres tournés et arrondis
    const outline = (pts, o) => page.drawSvgPath(pts.map(([x, y], i) => { const [X, Y] = P(x, y); return (i ? 'L' : 'M') + X.toFixed(2) + ' ' + (-Y).toFixed(2); }).join('') + 'Z', { x: 0, y: 0, ...o });
    // ligne de texte avec repli DejaVu pour les caractères manquants, tournée autour du centre c
    const writeLine = async (str, x, y, size, f, color, opacity, c, deg) => {
      const main = await font(f), fb = [...str].some(ch => !hasGlyph(main, ch)) ? await font({ key: 'verdana', bold: normFont(f).bold, italic: normFont(f).italic }) : null;
      let off = 0;
      for (const [txt, ff] of glyphRuns(str, main, fb)) {
        const [X, Y] = P(...rotPt(x + off, y, c, deg));
        page.drawText(txt, { x: X, y: Y, size, font: ff, color, opacity, rotate: degrees(pageRot - deg) });
        off += ff.widthOfTextAtSize(txt, size);
      }
    };
    // Texte d'origine corrigé : écrit avec la police intégrée au PDF quand elle a les lettres voulues (rendu identique au reste,
    // ligatures comprises), sinon avec son équivalent, lettre par lettre ; même serrage et espacement des mots que la ligne d'origine
    const fontKeys = new Map();
    // (fo : police d'un morceau de ligne mixte ; renvoie la longueur écrite, pour enchaîner le morceau suivant)
    const writeOrig = async (str, x, y, it, color, opacity, c, deg, wsLine, fo) => {
      const L_ = PDFLib, size = it.size, ls = it.ls || 0, ws = wsLine ?? it.ws ?? 0, f0 = normFont(fo || it.font);
      const cands = f0.local && !f0.touched ? (fo ? [fo.ps] : it.orig.fonts || []).flatMap(n => (fams ??= fontsByFamily(pdf)).get(famKey(n)) || []) : [];
      const main = await font(fo || it.font), chars = [...str], glyphs = [];
      let fb;
      for (let i = 0; i < chars.length;) {
        let g = null;
        for (let n = Math.min(3, chars.length - i); n && !g; n--) { // ligatures (« ti », « ffi »…) d'abord, si la police d'origine en a
          const s = chars.slice(i, i + n).join('');
          for (const f of cands) { const code = f.rev.get(s); if (code != null) { g = { f, code, n }; break; } }
        }
        if (!g) {
          const s = chars[i];
          if (!hasGlyph(main, s)) fb ??= await font({ key: 'verdana', bold: f0.bold, italic: f0.italic });
          g = { pf: fb && !hasGlyph(main, s) && hasGlyph(fb, s) ? fb : main, s, n: 1 };
        }
        g.space = g.n === 1 && chars[i] === ' ';
        glyphs.push(g);
        i += g.n;
      }
      const keyOf = g => {
        const o = g.f || g.pf;
        if (!fontKeys.has(o)) fontKeys.set(o, g.f ? page.node.newFontDictionary('PlumeO', g.f.ref) : page.node.newFontDictionary(g.pf.name, g.pf.ref));
        return fontKeys.get(o);
      };
      const [X, Y] = P(...rotPt(x, y, c, deg)), gs = opacity < 1 && page.maybeEmbedGraphicsState({ opacity });
      const ops = [L_.pushGraphicsState(), ...(gs ? [L_.setGraphicsState(gs)] : []), L_.beginText(), L_.setFillingColor(color),
                   L_.rotateAndSkewTextRadiansAndTranslate((pageRot - deg) * Math.PI / 180, 0, 0, X, Y)];
      for (let i = 0; i < glyphs.length;) { // un TJ par police : chaque glyphe suivi de son espacement (en millièmes de corps, vers la gauche)
        const key = keyOf(glyphs[i]), arr = [];
        for (; i < glyphs.length && keyOf(glyphs[i]) === key; i++) {
          const g = glyphs[i];
          arr.push(g.f ? L_.PDFHexString.of(g.code.toString(16).padStart(2 * g.f.bytes, '0')) : g.pf.encodeText(g.s));
          const extra = ls * g.n + (g.space ? ws : 0);
          if (extra) arr.push(-extra / size * 1000);
        }
        ops.push(L_.setFontAndSize(key, size), L_.PDFOperator.of(L_.PDFOperatorNames.ShowTextAdjusted, [pdf.context.obj(arr)]));
      }
      page.pushOperators(...ops, L_.endText(), L_.popGraphicsState());
      return glyphs.reduce((t, g) => t + (g.f ? g.f.width(g.code) * size : g.pf.widthOfTextAtSize(g.s, size)) + ls * g.n + (g.space ? ws : 0), 0);
    };
    if (p.ocr) { // scan reconnu : texte invisible pour pouvoir sélectionner et chercher dans le PDF
      const f = await font(null);
      for (const r of p.ocr) {
        if (items.some(i => runsOf(i).includes(r))) continue;
        const [x, y] = P(r.x, r.top + .85 * r.px);
        try { page.drawText(r.str, { x, y, size: r.px, font: f, opacity: 0, rotate }); } catch {}
      }
    }
    for (const it of items.filter(i => i.pg === p)) {
      const color = it.color && hexRgb(it.color), opacity = it.op ?? 1, deg = it.rot || 0;
      if (it.type === 'img') {
        const img = imgs[it.src] ??= await (it.src.startsWith('data:image/jpeg') ? pdf.embedJpg(it.src) : pdf.embedPng(it.src));
        const h = it.width / it.ratio, c = [it.x + it.width / 2, it.y + h / 2], [x, y] = P(...rotPt(it.x, it.y + h, c, deg)); // coin bas-gauche à l'écran
        page.drawImage(img, { x, y, width: it.width, height: h, rotate: degrees(pageRot - deg), opacity });
      } else if (it.type === 'text') {
        if (it.orig?.scan) // lignes scannées : leurs pixels ont été retirés, on repeint le fond
          for (const [x0, y0, x1, y1] of coverRects(it)) page.drawRectangle({ ...box(x0, y0, x1, y1), color: hexRgb(it.bg) });
        if (!it.text.trim()) continue;
        // lignes coupées comme à l'écran (sinon, hors page affichée, par nos propres mesures)
        const main = await font(it.font), lh = it.lh || L;
        const lines = it.input?.isConnected ? layoutLines(it) : wrapText(it.text, it.wrapW, main, it.size).map(t => ({ t, soft: false }));
        const w = it.input?.offsetWidth || it.wrapW || Math.max(...lines.map(l => main.widthOfTextAtSize(l.t, it.size))), h = lines.length * lh * it.size;
        const c = [it.x + w / 2, it.y + h / 2], pad = textPad(it), r = (x, y) => rotPt(x, y, c, deg);
        const corners = [r(it.x - pad, it.y - pad), r(it.x + w + pad, it.y - pad), r(it.x + w + pad, it.y + h + pad), r(it.x - pad, it.y + h + pad)];
        if (it.note) outline(corners, { color: hexRgb(NOTE_BG), borderColor: hexRgb(NOTE_EDGE), borderWidth: .6, opacity, borderOpacity: opacity });
        if (it.frame) { // tampon : cadre simple, arrondi ou double
          const rounded = (x0, y0, x1, y1, rad) => { const pts = []; for (const [cx, cy, a0] of [[x1 - rad, y0 + rad, -90], [x1 - rad, y1 - rad, 0], [x0 + rad, y1 - rad, 90], [x0 + rad, y0 + rad, 180]]) for (let k = 0; k <= 6; k++) { const a = (a0 + k * 15) * Math.PI / 180; pts.push(r(cx + rad * Math.cos(a), cy + rad * Math.sin(a))); } return pts; };
          const [x0, y0, x1, y1] = [it.x - pad, it.y - pad, it.x + w + pad, it.y + h + pad];
          const o = { borderColor: color, borderWidth: it.frame === 'double' ? 1 : 2, borderOpacity: opacity };
          outline(it.frame === 'round' ? rounded(x0, y0, x1, y1, Math.min(10, (y1 - y0) / 2)) : corners, o);
          if (it.frame === 'double') outline([r(x0 + 3, y0 + 3), r(x1 - 3, y0 + 3), r(x1 - 3, y1 - 3), r(x0 + 3, y1 - 3)], o);
        }
        const plan = plans.get(it) || [];
        if (it.rich) { // ligne mixte : chaque morceau dans sa police, à la suite ; laissée intacte si rien n'a changé
          if (plan.every(pl => pl.keep)) continue;
          let x = it.x, row = 0;
          for (const s of it.segs) for (const [k, part] of s.t.split('\n').entries()) {
            if (k) { row++; x = it.x; }
            if (part) x += await writeOrig(part, x, it.y + (row * lh + lh / 2 + BASE) * it.size, it, color, opacity, c, deg, undefined, s.f);
          }
          continue;
        }
        for (const [i, { t, soft }] of lines.entries()) if (t.trim()) {
          const pl = plan[i];
          if (pl?.keep) continue; // ligne inchangée : laissée telle quelle dans le PDF
          const y = it.y + (i * lh + lh / 2 + BASE) * it.size, part = pl?.start != null; // part : seule la fin de la ligne est réécrite
          let ln = part ? t.slice(pl.p) : t;
          if (it.wrapW || part) ln = ln.trimEnd();
          if (!ln) continue;
          const x = part ? pl.start : it.x;
          // paragraphe justifié : la place libre de chaque ligne coupée automatiquement va aux espaces, comme à l'écran
          let ws;
          if (it.justify && soft && ln.includes(' ')) {
            const f = normFont(it.font);
            measure.font = `${f.italic ? 'italic ' : ''}${f.bold ? '700' : '400'} ${it.size}px ${cssFamily(f)}`;
            ws = Math.max(0, (it.x + it.wrapW - x - textW(ln) - (it.ls || 0) * [...ln].length) / (ln.split(' ').length - 1));
          }
          if (it.orig) await writeOrig(ln, x, y, it, color, opacity, c, deg, ws);
          else await writeLine(ln, x, y, it.size, it.font, color, opacity, c, deg);
        }
      } else if (it.type === 'mark') {
        const s = it.size, m = (dx, dy) => pt(it.x + dx * s, it.y + dy * s);
        if (it.kind === 'dot') page.drawCircle({ ...m(0, 0), size: s * .28, color, opacity });
        else if (it.kind === 'cross') { line(m(-.32, -.32), m(.32, .32), s * .14, color, opacity); line(m(.32, -.32), m(-.32, .32), s * .14, color, opacity); }
        else { line(m(-.38, .02), m(-.1, .3), s * .14, color, opacity); line(m(-.1, .3), m(.42, -.34), s * .14, color, opacity); }
      } else if (it.type === 'ink') {
        const d = it.pts.map((q, i) => { const [x, y] = P(it.x + q[0], it.y + q[1]); return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + (-y).toFixed(2); }).join('');
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: color, borderWidth: it.w, borderLineCap: LineCapStyle.Round, borderOpacity: opacity });
      } else if (it.type === 'arrow') {
        const [h1, h2] = arrowHead(it), tip = pt(it.x2, it.y2);
        line(pt(it.x, it.y), tip, it.w, color, opacity); line(pt(...h1), tip, it.w, color, opacity); line(pt(...h2), tip, it.w, color, opacity);
      } else if (it.type === 'line') {
        line(pt(it.x, it.y), pt(it.x2, it.y2), it.w, color, opacity);
      } else if (it.type === 'link') {
        writeLink(pdf, page, it, box(Math.min(it.x, it.x2), Math.min(it.y, it.y2), Math.max(it.x, it.x2), Math.max(it.y, it.y2)), target);
      } else if (it.type === 'field') {
        newFields.push({ it, page, rect: box(Math.min(it.x, it.x2), Math.min(it.y, it.y2), Math.max(it.x, it.x2), Math.max(it.y, it.y2)), rotate });
      } else if (it.type !== 'redact') { // caviardage : déjà appliqué par MuPDF
        const b = box(Math.min(it.x, it.x2), Math.min(it.y, it.y2), Math.max(it.x, it.x2), Math.max(it.y, it.y2));
        const fill = it.fill ? { color, opacity } : {};
        if (it.type === 'hl') page.drawRectangle({ ...b, color, opacity: .4 * opacity, blendMode: BlendMode.Multiply });
        if (it.type === 'rect') page.drawRectangle({ ...b, ...fill, borderColor: color, borderWidth: it.w, borderOpacity: opacity });
        if (it.type === 'ellipse') page.drawEllipse({ x: b.x + b.width / 2, y: b.y + b.height / 2, xScale: b.width / 2, yScale: b.height / 2, ...fill, borderColor: color, borderWidth: it.w, borderOpacity: opacity });
      }
    }
    if (deco.wm || deco.header || deco.footer || deco.num) {
      const W = p.vp.width, H = p.vp.height, fr = await font(null);
      if (deco.wm) { // en diagonale, centré : on part du centre, on recule de la moitié du texte le long de la diagonale
        const fb = await font({ key: 'arial', bold: true }), s = wmSize(W, H, fb.widthOfTextAtSize(deco.wm, 1));
        const w = fb.widthOfTextAtSize(deco.wm, s), c = Math.SQRT1_2, cap = .72 * s;
        const [x, y] = P(W / 2 - c * w / 2 + c * cap / 2, H / 2 + c * w / 2 + c * cap / 2);
        page.drawText(deco.wm, { x, y, size: s, font: fb, color: hexRgb(deco.wmColor), opacity: deco.wmOpacity, rotate: degrees(pageRot + 45) });
      }
      for (const d of decoItems(W, H, n + 1, list.length, (t, s) => fr.widthOfTextAtSize(t, s)))
        await writeLine(d.t, d.x, d.y, d.size, null, rgb(.27, .27, .27), 1, [0, 0], 0);
    }
  }
  writeBookmarks(pdf, target);
  // 4. champs de formulaire créés dans Rature : le PDF devient remplissable
  if (newFields.length) {
    const form = pdf.getForm(), helv = await pdf.embedFont(StandardFonts.Helvetica), taken = new Set(form.getFields().map(f => f.getName()));
    for (const { it, page, rect, rotate } of newFields) {
      let name = it.name || 'Champ', k = 2;
      while (taken.has(name)) name = `${it.name} (${k++})`;
      taken.add(name);
      const look = { ...rect, rotate, borderColor: rgb(.55, .6, .75), borderWidth: .6, backgroundColor: rgb(.95, .97, 1) };
      if (it.fkind === 'check') form.createCheckBox(name).addToPage(page, look);
      else if (it.fkind === 'list') { const f = form.createDropdown(name); f.addOptions(it.opts?.length ? it.opts : ['']); f.addToPage(page, { ...look, font: helv }); }
      else { const f = form.createTextField(name); if (it.fkind === 'multi') f.enableMultiline(); f.addToPage(page, { ...look, font: helv }); }
    }
    try { form.updateFieldAppearances(helv); } catch {}
  }
  return pdf.save();
}

// Toutes les pages au format A4 (contenu mis à l'échelle et centré) ; le formulaire est figé pour ne rien perdre
async function toA4(bytes) {
  const { PDFDocument, degrees } = PDFLib, src = await PDFDocument.load(bytes), out = await PDFDocument.create();
  try { src.getForm().flatten(); } catch {}
  for (const p of src.getPages()) {
    const r = ((p.getRotation().angle % 360) + 360) % 360, cb = p.getCropBox(), w = cb.width, h = cb.height;
    const e = p.node.Contents() ? await out.embedPage(p, { left: cb.x, bottom: cb.y, right: cb.x + w, top: cb.y + h }) : null; // page vide : rien à recopier
    const sw = r % 180 ? h : w, sh = r % 180 ? w : h, [W, H] = sw > sh ? [841.89, 595.28] : [595.28, 841.89], s = Math.min(W / sw, H / sh);
    const [ox, oy] = { 0: [0, 0], 90: [0, w * s], 180: [w * s, h * s], 270: [h * s, 0] }[r]; // la rotation de la page est appliquée au contenu
    const page = out.addPage([W, H]);
    if (e) page.drawPage(e, { x: (W - sw * s) / 2 + ox, y: (H - sh * s) / 2 + oy, xScale: s, yScale: s, rotate: degrees(-r) });
  }
  return out.save();
}

// Photos trop lourdes du PDF : réduites à 1600 px et recompressées en JPEG (seulement si c'est plus léger)
function shrinkImages(doc, mupdf) {
  let n = 0;
  for (let i = 1, N = doc.countObjects(); i < N; i++) {
    try {
      const o = doc.newIndirect(i); // les flux se lisent / s'écrivent via la référence, pas via l'objet résolu
      if (!o.isStream() || o.get('Subtype').asName?.() !== 'Image') continue;
      if (o.get('ImageMask').valueOf() === true || !o.get('SMask').isNull() || !o.get('Mask').isNull()) continue; // transparences : on n'y touche pas
      if (o.get('BitsPerComponent').valueOf() === 1) continue; // noir et blanc 1 bit : déjà très léger
      const img = doc.loadImage(o), w = img.getWidth(), h = img.getHeight(), k = 1600 / Math.max(w, h);
      if (k >= 1) continue;
      let pix = img.toPixmap();
      if (pix.getAlpha()) continue;
      if (pix.getNumberOfComponents() === 4) pix = pix.convertToColorSpace(mupdf.ColorSpace.DeviceRGB); // CMJN → RVB
      const nw = Math.round(w * k), nh = Math.round(h * k), small = pix.warp([[0, 0], [w, 0], [w, h], [0, h]], nw, nh), jpg = small.asJPEG(80);
      if (jpg.length >= o.readRawStream().getLength()) continue;
      o.writeRawStream(jpg);
      o.delete('DecodeParms'); o.delete('Decode');
      o.put('Filter', doc.newName('DCTDecode'));
      o.put('Width', doc.newInteger(nw)); o.put('Height', doc.newInteger(nh)); o.put('BitsPerComponent', doc.newInteger(8));
      o.put('ColorSpace', doc.newName(small.getNumberOfComponents() === 1 ? 'DeviceGray' : 'DeviceRGB'));
      n++;
    } catch (e) { console.warn('Image', i, e); }
  }
  return n;
}
// Options de téléchargement : compression et mot de passe (MuPDF)
async function finish(bytes, { pw, compress }) {
  const mupdf = await getMupdf(), doc = mupdf.Document.openDocument(bytes, 'application/pdf'), o = ['compress', 'garbage=4', 'objstms'];
  if (compress) { shrinkImages(doc, mupdf); doc.subsetFonts?.(); o.push('compress-images', 'compress-fonts', 'clean'); }
  if (pw) o.push('encrypt=aes-256', 'user-password=' + pw, 'owner-password=' + pw);
  return doc.saveToBuffer(o.join(',')).asUint8Array().slice(); // copie : la vue MuPDF pointe sur une mémoire réutilisée ensuite
}

// ---------- Sauvegarde automatique du travail en cours (IndexedDB) ----------
function idb(mode, fn) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('plume', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', mode), q = fn(tx.objectStore('kv'));
      tx.oncomplete = () => { ok(q.result); r.result.close(); };
      tx.onerror = () => ko(tx.error);
    };
  });
}
let restoring = false;
// Le document entier, sérialisable : sauvegarde automatique et modèles
function snapshot() {
  const used = [...new Set(pages.map(p => p.src))];
  return {
    t: Date.now(), name: $('fname').textContent, expname: $('expname').value, deco,
    sources: used.map(s => ({ name: s.name, bytes: s.bytes, fields: s.fields, fields0: s.fields0, signed: s.signed })),
    pages: pages.map(p => ({ src: used.indexOf(p.src), index: p.index, rot: p.rot, crop: p.crop || null, ocr: p.ocr || null })),
    items: items.filter(it => !(it.fresh && !it.text.trim())).map(it => {
      const { el, host, input, span, spans, pg, before, fresh, _op0, ...x } = it;
      return { ...x, pg: pages.indexOf(pg) };
    }),
    bookmarks: bookmarks.map(b => ({ title: b.title, page: pages.indexOf(b.pg) })).filter(b => b.page >= 0),
  };
}
async function autosave() {
  if (!pages.length || restoring) return; // pas de sauvegarde partielle pendant une reprise
  try {
    await idb('readwrite', s => s.put(snapshot(), 'session'));
    $('saved').classList.add('on');
    clearTimeout(autosave.t);
    autosave.t = setTimeout(() => $('saved').classList.remove('on'), 1600);
  } catch (e) { console.warn('Sauvegarde automatique impossible', e); }
}
async function restore(s) {
  restoring = true;
  try { await restoreInner(s); } finally { restoring = false; changed(); }
}
async function restoreInner(s) {
  resetDoc();
  deco = { ...DECO0, ...s.deco };
  const srcs = [];
  for (const x of s.sources) {
    const doc = await pdfjsLib.getDocument({ data: x.bytes.slice() }).promise;
    srcs.push({ name: x.name, bytes: x.bytes, doc, fields: structuredClone(x.fields), fields0: x.fields0, signed: x.signed });
  }
  sources = srcs;
  const list = [];
  for (const p of s.pages) list.push({ src: srcs[p.src], index: p.index, rot: p.rot, crop: p.crop || null, ocr: p.ocr, pdfPage: await srcs[p.src].doc.getPage(p.index + 1) });
  $('expname').value = s.expname || '';
  await showEntries(list, 0, pg => { // chaque page retrouve ses éléments dès qu'elle est prête
    for (const x of s.items) {
      if (list[x.pg] !== pg) continue;
      attach({ ...x, pg });
    }
    claimSpans(pg);
  });
  bookmarks = (s.bookmarks || []).map(b => ({ title: b.title, pg: list[b.page] })).filter(b => b.pg);
  select(null);
  past = []; future = [];
  changed();
}
async function checkResume() {
  try {
    const s = await idb('readonly', st => st.get('session'));
    if (!s?.sources?.length) return;
    const when = new Date(s.t).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    $('resumeinfo').textContent = `${s.name} · ${when}`;
    $('resume').hidden = false;
    $('resumego').onclick = async () => {
      $('resume').hidden = true;
      try { await restore(s); toast('Travail repris là où tu l\'avais laissé'); }
      catch (e) { console.error(e); toast('Impossible de reprendre ce travail.', 'error'); resetDoc(); }
    };
    $('resumedel').onclick = () => { $('resume').hidden = true; idb('readwrite', st => st.delete('session')).catch(() => {}); };
  } catch {}
}

// ---------- Application installable / hors ligne ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').hidden = false; });
$('install').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('install').hidden = true; };
addEventListener('appinstalled', () => { $('install').hidden = true; toast('Rature est installée ✓'); });
// « Ouvrir avec Rature » depuis l'explorateur de fichiers (application installée)
if ('launchQueue' in window) launchQueue.setConsumer(async p => { if (p.files?.length) openFiles(await Promise.all(p.files.map(h => h.getFile()))); });
