// Rature · Conversion : PDF → Word (.docx), Excel (.xlsx), images (JPG, PNG) ; Word (.docx) et Excel (.xlsx) → PDF
// Tout se passe dans le navigateur. MuPDF lit le PDF lettre par lettre (police, taille, couleur), ses images et ses traits ;
// les fichiers Word et Excel sont écrits ici, à la main.
// ponytail: les dessins vectoriels (graphiques, logos tracés) ne passent pas dans Word ni Excel, seulement les vraies images ;
//           un tableau est reconnu à ses bordures : sans bordure, il devient des tabulations dans Word, des colonnes dans Excel

const xmlEsc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const hexOf = c => c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const isWhite = c => c.every(v => v > .97);
// valeurs proches regroupées (bordures doublées, décalées d'un point) : liste triée des moyennes
function clusterVals(vals, tol = 3) {
  const out = [];
  for (const v of [...vals].sort((a, b) => a - b)) { const g = out.at(-1); if (g && v - g.at(-1) <= tol) g.push(v); else out.push([v]); }
  return out.map(g => g.reduce((a, b) => a + b) / g.length);
}

// ---------- Lecture d'un PDF ----------
// Chaque page → lignes (lettres avec leur style), images, traits fins (bordures, soulignés), aplats, tableaux, liens.
// « flow » : ce qui n'est pas dans un tableau, dans l'ordre du document ; un tableau y prend la place de son premier contenu.
async function readPdf(bytes) {
  const mu = await getMupdf(), doc = mu.Document.openDocument(bytes, 'application/pdf'), fonts = new Map(), out = [];
  const fontOf = f => {
    let r = fonts.get(f.pointer);
    if (!r) {
      const name = f.getName().replace(/^[A-Z]{6}\+/, '');
      fonts.set(f.pointer, r = { name, bold: f.isBold() || /bold|black|heavy|semibold|demi/i.test(name), italic: f.isItalic() || /italic|oblique/i.test(name),
                                 symbol: /symbol|dingbat|wingding/i.test(name) });
    }
    return r;
  };
  for (let i = 0; i < doc.countPages(); i++) { const page = doc.loadPage(i); out.push(readPage(mu, page, fontOf)); page.destroy(); }
  doc.destroy();
  return out;
}
const lineOf = (chars, seq, block) => {
  const ink = chars.filter(c => c.c.trim()), size = Math.max(...ink.map(c => c.size)), base = ink[0].base;
  return { seq, block, chars, size, base, x0: Math.min(...ink.map(c => c.x0)), x1: Math.max(...ink.map(c => c.x1)), y0: base - size * .8, y1: base + size * .25 };
};
function readPage(mu, page, fontOf) {
  const [X0, Y0, X1, Y1] = page.getBounds(), W = X1 - X0, H = Y1 - Y0, lines = [], images = [], rules = [], shades = [];
  let seq = 0, block = 0, cur;
  const stext = page.toStructuredText('preserve-images,vectors');
  stext.walk({
    beginTextBlock() { block++; },
    beginLine() { cur = []; },
    onChar(c, o, font, size, q, color) { cur.push({ c, x0: Math.min(q[0], q[4]) - X0, x1: Math.max(q[2], q[6]) - X0, base: o[1] - Y0, size, font: fontOf(font), color }); },
    endLine() { if (cur.some(ch => ch.c.trim())) lines.push(lineOf(cur, seq++, block)); },
    onImageBlock(b, m, img) {
      const x0 = b[0] - X0, y0 = b[1] - Y0, x1 = b[2] - X0, y1 = b[3] - Y0;
      if (x1 - x0 < 4 || y1 - y0 < 4) return;
      try {
        const raw = img.toPixmap(), pix = raw.convertToColorSpace(mu.ColorSpace.DeviceRGB, true), png = pix.getAlpha();
        images.push({ seq: seq++, x0, y0, x1, y1, type: png ? 'png' : 'jpeg', data: (png ? pix.asPNG() : pix.asJPEG(88)).slice() });
        raw.destroy(); pix.destroy();
      } catch (e) { console.warn('image ignorée', e); }
    },
    onVector(b, f, color) {
      if (isWhite(color)) return;
      const x0 = b[0] - X0, y0 = b[1] - Y0, x1 = b[2] - X0, y1 = b[3] - Y0, w = x1 - x0, h = y1 - y0;
      if ((h <= 3 && w > 4) || (w <= 3 && h > 4)) rules.push({ x0, y0, x1, y1, color });
      else if (f.isRectangle && f.isStroked) rules.push({ x0, y0, x1, y1: y0 }, { x0, y0: y1, x1, y1 }, { x0, y0, x1: x0, y1 }, { x0: x1, y0, x1, y1 });
      else if (f.isRectangle && w > 4 && h > 4) shades.push({ x0, y0, x1, y1, color });
    },
  });
  stext.destroy();
  // scan reconnu (texte invisible sur une image pleine page) : on garde le texte, pas la photo
  const inside = (a, b) => (a.x0 + a.x1) / 2 > b.x0 && (a.x0 + a.x1) / 2 < b.x1 && (a.y0 + a.y1) / 2 > b.y0 && (a.y0 + a.y1) / 2 < b.y1;
  const imgs = images.filter(im => (im.x1 - im.x0) * (im.y1 - im.y0) < W * H * .5 || !lines.some(l => inside(l, im)));
  const links = page.getLinks().filter(l => l.isExternal()).map(l => { const [a, b, c, d] = l.getBounds(); return { x0: a - X0, y0: b - Y0, x1: c - X0, y1: d - Y0, uri: l.getURI() }; });
  const tables = findTables(rules, shades), flow = [];
  // chaque lettre va dans la case du tableau qui la contient, sinon dans le texte courant
  const idx = (a, v) => Math.max(0, Math.min(a.length - 2, a.findLastIndex(u => u <= v)));
  const cellAt = (x, y) => {
    const t = tables.find(t => x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1);
    if (!t) return null;
    const j = idx(t.xs, x);
    return t.rows[idx(t.ys, y)].find(rc => rc.j <= j && j < rc.j + rc.span).cell;
  };
  for (const l of lines) {
    let piece = [], at = null;
    const flush = () => { if (piece.some(c => c.c.trim())) (at ? at.items : flow).push(lineOf(piece, l.seq, l.block)); piece = []; };
    for (const ch of l.chars) {
      const c = ch.c.trim() ? cellAt((ch.x0 + ch.x1) / 2, ch.base - ch.size * .3) : at;
      if (c !== at) flush();
      at = c;
      piece.push(ch);
    }
    flush();
  }
  // trait horizontal seul (sous un titre, entre deux parties), qui ne souligne aucun texte : gardé comme un filet
  const bars = rules.filter(r => !r.table && r.y1 - r.y0 <= 3 && r.x1 - r.x0 > 30 && !lines.some(l => r.y0 > l.base - 1 && r.y0 < l.base + l.size * .35 && r.x0 < l.x1 && r.x1 > l.x0))
    .map(r => ({ ...r, bar: true }));
  for (const im of [...imgs, ...bars]) (cellAt((im.x0 + im.x1) / 2, (im.y0 + im.y1) / 2)?.items || flow).push(im);
  for (const t of tables) for (const r of t.rows) for (const rc of r) if (!rc.cont) rc.cell.items = readingOrder(rc.cell.items);
  const ordered = readingOrder([...flow, ...tables], true);
  return { W, H, lines, images: imgs, rules: rules.filter(r => !r.table), links, tables, shades, flow: ordered };
}
// Ordre de lecture : la zone est coupée à son plus grand blanc, horizontal (bandes l'une sous l'autre) ou vertical (colonnes
// côte à côte), puis chaque morceau de même. Deux colonnes de vrai texte (plusieurs longues lignes chacune) restent des colonnes ;
// des colonnes de tableau sans bordure (lignes courtes, alignées) sont lues rangée par rangée.
function readingOrder(items, cols) {
  if (items.length < 2) return items;
  const widest = (lo, hi) => {
    const s = [...items].sort((a, b) => lo(a) - lo(b)), best = { g: 0 };
    let end = hi(s[0]);
    for (const x of s.slice(1)) { if (lo(x) - end > best.g) Object.assign(best, { g: lo(x) - end, at: lo(x) }); end = Math.max(end, hi(x)); }
    return best;
  };
  const h = widest(x => x.y0, x => x.y1), v = widest(x => x.x0, x => x.x1);
  // un vrai blanc entre deux bandes (plus qu'un interligne) passe avant tout : on ne coupe en colonnes qu'une zone sans bande
  if (v.g >= 6 && v.g > h.g && h.g < 4) {
    const parts = [items.filter(x => x.x0 < v.at), items.filter(x => x.x0 >= v.at)];
    const prose = p => { const ls = p.filter(x => x.chars); return ls.length >= 3 && ls.filter(l => l.chars.length >= 20).length >= ls.length * .6; };
    if (cols && parts.every(prose)) {
      const box = p => ({ x0: Math.min(...p.map(x => x.x0)), x1: Math.max(...p.map(x => x.x1)), y0: Math.min(...p.map(x => x.y0)), y1: Math.max(...p.map(x => x.y1)) });
      const cs = parts.map(p => ({ ...box(p), items: readingOrder(p) }));
      return [{ columns: cs, x0: cs[0].x0, x1: cs[1].x1, y0: Math.min(cs[0].y0, cs[1].y0), y1: Math.max(cs[0].y1, cs[1].y1) }];
    }
  }
  // sinon on lit par bandes, de haut en bas (les colonnes d'un tableau sans bordure restent rangée par rangée) ; côte à côte : de gauche à droite
  if (h.g > .5) return [...readingOrder(items.filter(x => x.y0 < h.at), cols), ...readingOrder(items.filter(x => x.y0 >= h.at), cols)];
  if (v.g > 0) return [...readingOrder(items.filter(x => x.x0 < v.at), cols), ...readingOrder(items.filter(x => x.x0 >= v.at), cols)];
  return [...items].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}
const flatItems = flow => flow.flatMap(x => x.columns ? x.columns.flatMap(c => c.items) : [x]);
// Tableaux : traits horizontaux et verticaux qui se croisent ; sans trait entre deux cases voisines, elles sont fusionnées
function findTables(rules, shades) {
  const hs = [], vs = [];
  for (const r of rules) (r.x1 - r.x0 >= r.y1 - r.y0 ? hs.push({ r, a: r.x0, b: r.x1, c: (r.y0 + r.y1) / 2 }) : vs.push({ r, a: r.y0, b: r.y1, c: (r.x0 + r.x1) / 2 }));
  const all = [...hs, ...vs], par = all.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  // ponytail: chaque trait horizontal comparé à chaque vertical, O(n²) ; une grille par balayage si des pages en ont des milliers
  hs.forEach((h, i) => vs.forEach((v, k) => { if (v.c > h.a - 3 && v.c < h.b + 3 && h.c > v.a - 3 && h.c < v.b + 3) par[find(i)] = find(hs.length + k); }));
  const groups = new Map();
  all.forEach((s, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, { hs: [], vs: [] }); (i < hs.length ? groups.get(k).hs : groups.get(k).vs).push(s); });
  const out = [];
  for (const g of groups.values()) {
    const ys = clusterVals(g.hs.map(h => h.c)), xs = clusterVals(g.vs.map(v => v.c));
    if (ys.length < 2 || xs.length < 2) continue;
    for (const s of [...g.hs, ...g.vs]) s.r.table = true;
    const near = (a, b) => Math.abs(a - b) < 3;
    const hasV = (x, y) => g.vs.some(v => near(v.c, x) && v.a - 2 <= y && y <= v.b + 2), hasH = (y, x) => g.hs.some(h => near(h.c, y) && h.a - 2 <= x && x <= h.b + 2);
    const rows = ys.slice(0, -1).map((y, i) => {
      const ym = (y + ys[i + 1]) / 2, row = [];
      for (let j = 0; j < xs.length - 1; j++) { if (j && !hasV(xs[j], ym)) row.at(-1).span++; else row.push({ j, span: 1 }); }
      return row;
    });
    rows.forEach((row, i) => row.forEach(rc => {
      const x0 = xs[rc.j], x1 = xs[rc.j + rc.span], xm = (x0 + x1) / 2, ym = (ys[i] + ys[i + 1]) / 2, up = i && rows[i - 1].find(a => a.j === rc.j && a.span === rc.span);
      rc.b = { top: hasH(ys[i], xm), bottom: hasH(ys[i + 1], xm), left: hasV(x0, ym), right: hasV(x1, ym) };
      if (up && !rc.b.top) { rc.cell = up.cell; rc.cont = true; rc.cell.rows++; rc.cell.y1 = ys[i + 1]; return; }
      const fill = shades.find(s => s.x0 <= xm && xm <= s.x1 && s.y0 <= ym && ym <= s.y1 && (s.x1 - s.x0) * (s.y1 - s.y0) > (x1 - x0) * (ys[i + 1] - ys[i]) * .4);
      rc.cell = { x0, x1, y0: ys[i], y1: ys[i + 1], rows: 1, items: [], fill: fill ? fill.color : null };
    }));
    out.push({ table: true, xs, ys, rows, x0: xs[0], x1: xs.at(-1), y0: ys[0], y1: ys.at(-1) });
  }
  return out;
}
// lettres → morceaux de même police, taille, couleur et hauteur (les espaces suivent le morceau en cours)
function charSpans(chars) {
  const out = [];
  for (const ch of chars) {
    const s = out.at(-1);
    if (s && (!ch.c.trim() || (s.font === ch.font && Math.abs(s.size - ch.size) < .6 && s.color.join() === ch.color.join() && Math.abs(s.base - ch.base) < 1))) { s.t += ch.c; if (ch.c.trim()) s.x1 = ch.x1; }
    else out.push({ t: ch.c, font: ch.font, size: ch.size, color: ch.color, base: ch.base, x0: ch.x0, x1: ch.x1 });
  }
  return out;
}
// Texte (OCR) des pages scannées pas encore lu : sans lui, Word et Excel recevraient des pages vides
async function ensureText() {
  if (pages.some(p => p.wrap.classList.contains('scan') && !p.ocr)) await scanDocument();
}
// nom du fichier converti : celui du téléchargement, sans le « - rempli » ajouté d'office
const exportName = ext => ($('expname').value.trim() || baseName($('fname').textContent) || 'document').replace(/\.pdf$/i, '').replace(tr(' - rempli'), '') + ext;
// Convertir sans PDF ouvert : on choisit le fichier, la conversion part dès qu'il est ouvert
function convertAfterOpen(fn) { afterOpen.then = fn; $('file').click(); }
$('file').addEventListener('cancel', () => { afterOpen.then = null; });

// ---------- PDF → Word ----------
// Nom de police Word d'après celui du PDF : « TimesNewRomanPS-BoldMT » → « Times New Roman »
const WORD_FONTS = { TimesNewRoman: 'Times New Roman', Times: 'Times New Roman', CourierNew: 'Courier New', Courier: 'Courier New', Helvetica: 'Arial', ArialNarrow: 'Arial Narrow',
  SegoeUI: 'Segoe UI', TrebuchetMS: 'Trebuchet MS', ComicSansMS: 'Comic Sans MS', CenturyGothic: 'Century Gothic', BookAntiqua: 'Book Antiqua', LucidaConsole: 'Lucida Console' };
const LIST_MARK = /^\s*(\d{1,3}[.)]|[a-zA-Z][.)]|[•▪◦●○■□➢►–—*-])\s/; // début d'un élément de liste
const wordFont = n => { const k = n.replace(/[-,].*$/, '').replace(/(PS)?MT$/, '').replace(/PS$/, ''); return WORD_FONTS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2'); };
async function exportDocx() {
  if (!pages.length) return convertAfterOpen(exportDocx);
  await ensureText();
  toast('Préparation du fichier Word…');
  try {
    const pdf = await readPdf(await build(pages)), name = exportName('.docx');
    track('word');
    download(new Blob([makeZip(docxFiles(pdf))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), name);
    toast(tr('{name} téléchargé ✓', { name }));
  } catch (e) { console.error(e); toast(tr('Conversion impossible : {m}', { m: e.message }), 'error'); }
}
function docxFiles(pdf) {
  const tw = v => Math.max(0, Math.round(v * 20)), enc = new TextEncoder(), media = [], rels = [];
  const rel = (type, target, ext) => { const id = 'rId' + (rels.length + 10); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${xmlEsc(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; };
  // marges, police et taille du texte courant, d'après tout le document
  const most = m => [...m].sort((a, b) => b[1] - a[1])[0]?.[0], count = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  // en-têtes et pieds de page : lignes du haut ou du bas qui reviennent sur la plupart des pages (chiffres à part : numéro de page)
  const hf = { head: null, foot: null }, zone = (p, l) => l.y1 < p.H * .12 ? 'head' : l.y0 > p.H * .88 ? 'foot' : null;
  if (pdf.length > 1) {
    const key = l => l.chars.map(c => c.c).join('').trim().replace(/\d+/g, '#') + '@' + Math.round(l.y0 / 6), seen = new Map();
    for (const p of pdf) for (const k of new Set(p.flow.filter(x => x.chars && zone(p, x)).map(key))) count(seen, k);
    pdf.forEach((p, i) => {
      const out = p.flow.filter(x => x.chars && zone(p, x) && seen.get(key(x)) >= pdf.length * .6);
      for (const z of ['head', 'foot']) if (!hf[z] && out.some(x => zone(p, x) === z)) hf[z] = { page: p, no: i + 1, items: out.filter(x => zone(p, x) === z) };
      p.flow = p.flow.filter(x => !out.includes(x));
    });
  }
  const all = pdf.flatMap(p => p.lines), body0 = pdf.flatMap(p => flatItems(p.flow)), pct = (a, k) => a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * k)] : null;
  const { W, H } = pdf[0], flowLines = body0.filter(x => x.chars), L = Math.max(18, pct(all.map(l => l.x0), .05) ?? 72);
  const R = Math.min(W - 18, Math.max(L + 100, flowLines.length ? Math.max(...flowLines.map(l => l.x1)) : W - 72));
  const T = Math.max(18, Math.min(100, (body0.length ? Math.min(...body0.map(x => x.y0)) : 72) - 4));
  const B = Math.max(14, Math.min(56, H - (body0.length ? Math.max(...body0.map(x => x.y1)) : H - 56) - 10));
  const sizes = new Map(), fontCount = new Map();
  for (const l of all) for (const c of l.chars) if (c.c.trim()) { count(sizes, Math.round(c.size * 2) / 2); if (!c.font.symbol) count(fontCount, wordFont(c.font.name)); }
  const body = most(sizes) || 11, font0 = most(fontCount) || 'Calibri';
  let pic = 0;

  let pageNo = null, inHF = false; // en-tête ou pied en cours : pageNo devient le champ « numéro de page » de Word
  const runXml = (s, page) => {
    const m = pageNo && new RegExp(`(^|\\D)(${pageNo})(?!\\d)`).exec(s.t);
    if (m) {
      const at = m.index + m[1].length, no = pageNo;
      pageNo = null;
      const xml = runXml({ ...s, t: s.t.slice(0, at) }, page) + `<w:fldSimple w:instr=" PAGE ">${runXml({ ...s, t: String(no) }, page)}</w:fldSimple>` + runXml({ ...s, t: s.t.slice(at + String(no).length) }, page);
      pageNo = no;
      return xml;
    }
    if (!s.t) return '';
    // texte blanc dont le fond (dessin, bouton) ne passe pas dans Word : en noir, sinon il serait invisible
    const cx0 = (s.x0 + s.x1) / 2, under = [...page.images, ...page.shades.filter(o => o.y1 - o.y0 < s.size * 3)].some(o => o.x0 <= cx0 && cx0 <= o.x1 && o.y0 <= s.base && s.base <= o.y1 + 2);
    const f = s.font, fn = f.symbol ? '' : wordFont(f.name), hex = isWhite(s.color) && !under && !inHF ? '000000' : hexOf(s.color);
    const rPr = (fn && fn !== font0 ? `<w:rFonts w:ascii="${xmlEsc(fn)}" w:hAnsi="${xmlEsc(fn)}" w:cs="${xmlEsc(fn)}"/>` : '') + (f.bold ? '<w:b/>' : '') + (f.italic ? '<w:i/>' : '')
      + (hex !== '000000' ? `<w:color w:val="${hex}"/>` : '') + `<w:sz w:val="${Math.round(s.size * 2)}"/>` + (s.u ? '<w:u w:val="single"/>' : '') + (s.sup ? '<w:vertAlign w:val="superscript"/>' : '');
    const run = `<w:r><w:rPr>${rPr}</w:rPr>${s.t.split('\t').map(x => x && `<w:t xml:space="preserve">${xmlEsc(x)}</w:t>`).join('<w:tab/>')}</w:r>`;
    const cx = (s.x0 + s.x1) / 2, link = !inHF && page.links.find(k => k.x0 <= cx && cx <= k.x1 && k.y0 <= s.base && s.base <= k.y1 + 2);
    return link ? `<w:hyperlink r:id="${rel('hyperlink', link.uri, true)}">${run}</w:hyperlink>` : run;
  };
  // lignes sur la même ligne de base (puce et texte, « Nom : » et sa valeur…) : une seule ligne, morceaux séparés par une tabulation
  const joinRow = ls => {
    const out = [];
    for (const l of ls) {
      const sp = charSpans(l.chars), a = out.find(o => Math.abs(o.base - l.base) < 1.5 && l.x0 >= o.x1 - 1 && l.x0 - o.x1 < 30 * l.size);
      if (!a) { out.push({ ...l, spans: sp, tabs: [] }); continue; }
      sp[0].t = '\t' + sp[0].t.trimStart();
      a.spans.push(...sp); a.tabs.push(l.x0); a.x1 = l.x1; a.size = Math.max(a.size, l.size); a.y0 = Math.min(a.y0, l.y0); a.y1 = Math.max(a.y1, l.y1);
    }
    return out;
  };
  const tiny = '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>';
  // contenu d'une page ou d'une case → paragraphes Word ; box : bords gauche et droit du texte (R0 : bord droit de la page ou de la case)
  const flowXml = (items, box, page, pageBreak) => {
    const out = [];
    let prevBottom = null, para = null, lastTable = false, brk = pageBreak;
    const pPr = extra => { const b = brk; brk = false; return `<w:pPr>${b ? '<w:pageBreakBefore/>' : ''}${extra}</w:pPr>`; };
    const endPara = () => {
      if (!para) return;
      const ls = para.lines, first = ls[0], rest = ls[1] || first, size = Math.max(...ls.map(l => l.size)), txt = ls.map(l => l.spans.map(s => s.t).join('')).join(' ');
      const right = Math.max(...ls.map(l => l.x1)), mid = (box.L + box.R) / 2;
      const align = ls.every(l => Math.abs((l.x0 + l.x1) / 2 - mid) < 6) && first.x0 > box.L + 15 ? 'center'
        : ls.every(l => Math.abs(l.x1 - box.R) < 4) && first.x0 > box.L + 40 ? 'right'
        : ls.length > 1 && ls.slice(0, -1).every(l => right - l.x1 < 2) && right - rest.x0 > (box.R - box.L) * .6 ? 'both' : '';
      const left = align === 'center' || align === 'right' ? 0 : rest.x0 - box.L, fl = align === 'center' || align === 'right' ? 0 : first.x0 - rest.x0;
      const before = prevBottom == null ? 0 : first.y0 - prevBottom - 1.5, pitch = ls.length > 1 ? (ls.at(-1).base - first.base) / (ls.length - 1) : 0;
      const head = size >= body * 1.25 && txt.length < 150 ? (size >= body * 1.8 ? 1 : size >= body * 1.4 ? 2 : 3) : 0;
      const tabs = [...new Set(ls.flatMap(l => l.tabs))].map(x => `<w:tab w:val="left" w:pos="${tw(x - box.L)}"/>`).join('');
      const rInd = align === 'both' && box.R - right > 2 ? box.R - right : 0, cy = (first.y0 + first.y1) / 2;
      const shade = !box.cell && page.shades.find(s => s.x0 <= first.x0 && first.x0 < s.x1 && s.y0 <= cy && cy <= s.y1 && s.y1 - s.y0 < size * 3 && !isWhite(s.color));
      out.push(`<w:p>${pPr((head ? `<w:pStyle w:val="Heading${head}"/>` : '') + '<w:widowControl w:val="0"/>' + (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${hexOf(shade.color)}"/>` : '') + (tabs ? `<w:tabs>${tabs}</w:tabs>` : '')
        + `<w:spacing w:before="${tw(before)}" w:after="0"${pitch > 0 ? ` w:line="${tw(pitch)}" w:lineRule="exact"` : ''}/>`
        + (left > 2 || Math.abs(fl) > 2 || rInd ? `<w:ind w:left="${tw(left)}"${rInd ? ` w:right="${tw(rInd)}"` : ''}${fl > 2 ? ` w:firstLine="${tw(fl)}"` : fl < -2 ? ` w:hanging="${tw(-fl)}"` : ''}/>` : '')
        + (align ? `<w:jc w:val="${align}"/>` : ''))}`
        + ls.map((l, k) => (k && !/[-\s]$/.test(ls[k - 1].spans.at(-1).t) ? runXml({ ...l.spans[0], t: ' ', u: false }, page) : '') + l.spans.map(s => runXml(s, page)).join('')).join('') + '</w:p>');
      prevBottom = ls.at(-1).y1;
      para = null;
      lastTable = false;
    };
    const lines = joinRow(items.filter(x => x.chars)), byKey = new Map(lines.map(l => [l.seq + ':' + l.x0, l]));
    const queue = items.map(x => x.chars ? byKey.get(x.seq + ':' + x.x0) : x).filter(Boolean);
    for (const x of queue) {
      if (x.chars) {
        // soulignés : trait fin juste sous le morceau ; exposants : petit et surélevé
        for (const s of x.spans) {
          s.u = page.rules.some(r => r.y1 - r.y0 < 2 && r.y0 > s.base && r.y0 < s.base + s.size * .35 && Math.min(r.x1, s.x1) - Math.max(r.x0, s.x0) > (s.x1 - s.x0) * .7);
          s.sup = s.size < x.size * .75 && x.base - s.base > x.size * .25;
        }
        const prev = para?.lines.at(-1), styleOf = l => [Math.round(l.size), l.spans[0].font.bold].join();
        // ligne pleine (le premier mot de la suivante n'y tenait pas) : même paragraphe ; ligne courte : retour à la ligne voulu
        const cs = x.chars, i0 = cs.findIndex(c => c.c.trim()), i1 = cs.findIndex((c, k) => k > i0 && !c.c.trim());
        const firstWord = (i1 > 0 ? cs[i1 - 1].x1 : x.x1) - cs[i0].x0 + x.size * .25;
        const blockRight = Math.max(...lines.filter(o => o.block === x.block).map(o => o.x1));
        const soft = prev && x.y0 - prev.y1 < prev.size * .6 && x.y0 > prev.y0 && styleOf(x) === styleOf(prev) && !x.tabs.length && !prev.tabs.length
          && Math.abs(x.x0 - (para.lines[1] || x).x0) < 3 && Math.abs(x.x0 - para.lines[0].x0) < 40 && prev.x1 + firstWord > Math.min(box.R, blockRight) - 1
          && !LIST_MARK.test(x.spans.map(s => s.t).join(''));
        if (soft) { para.lines.push(x); continue; }
        endPara();
        para = { lines: [x] };
        continue;
      }
      endPara();
      if (x.columns) {
        // texte en colonnes : section à part, entre deux sauts de section continus ; saut de colonne entre les colonnes
        const [a, b] = x.columns;
        out.push(`<w:p>${pPr(`<w:spacing w:before="${tw(prevBottom == null ? 0 : x.y0 - prevBottom - 1)}" w:after="0" w:line="20" w:lineRule="exact"/><w:sectPr>${sect()}</w:sectPr>`)}</w:p>`);
        out.push(flowXml(a.items, { L: box.L, R: a.x1, R0: a.x1 }, page), `<w:p><w:pPr>${tiny}</w:pPr><w:r><w:br w:type="column"/></w:r></w:p>`, flowXml(b.items, { L: b.x0, R: box.R, R0: box.R0 }, page));
        out.push(`<w:p><w:pPr>${tiny}<w:sectPr>${sect([a.x1 - box.L, b.x0 - a.x1, box.R - b.x0])}</w:sectPr></w:pPr></w:p>`);
        prevBottom = x.y1;
        continue;
      }
      if (x.table) {
        // espace au-dessus (un tableau n'en a pas dans Word) ; aussi entre deux tableaux collés, qui n'en feraient qu'un
        const gap = prevBottom == null ? 0 : x.y0 - prevBottom;
        if (gap > 1.5 || lastTable || brk) out.push(`<w:p>${pPr(`<w:spacing w:before="0" w:after="0" w:line="${Math.max(20, tw(gap))}" w:lineRule="exact"/>`)}</w:p>`);
        out.push(tableXml(x, box, page));
        prevBottom = x.y1;
        lastTable = true;
        continue;
      }
      if (x.bar) {
        out.push(`<w:p>${pPr(`<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(2, Math.round((x.y1 - x.y0) * 8))}" w:space="0" w:color="${hexOf(x.color)}"/></w:pBdr>`
          + `<w:spacing w:before="${tw(prevBottom == null ? 0 : x.y0 - prevBottom - 1)}" w:after="0" w:line="20" w:lineRule="exact"/><w:ind w:left="${tw(x.x0 - box.L)}" w:right="${tw(box.R0 - x.x1)}"/>`)}</w:p>`);
        prevBottom = x.y1;
        continue;
      }
      // image
      const k = Math.min(1, (box.R0 - box.L) / (x.x1 - x.x0)), cx = Math.round((x.x1 - x.x0) * k * 12700), cy = Math.round((x.y1 - x.y0) * k * 12700), id = ++pic, file = `media/image${id}.${x.type}`;
      media.push({ name: 'word/' + file, data: x.data });
      const rid = rel('image', file), center = Math.abs((x.x0 + x.x1) / 2 - (box.L + box.R) / 2) < 8 && x.x0 > box.L + 15;
      const pic_ = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
        + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
        + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
      // image à côté d'un texte (logo près d'un titre…) : flottante, à sa place exacte sur la page, sans prendre de place dans le texte
      const beside = !box.cell && items.some(o => o.chars && o.y0 < x.y1 && o.y1 > x.y0 && (o.x1 < x.x0 || o.x0 > x.x1));
      if (beside) {
        const emu = v => Math.round(v * 12700);
        out.push(`<w:p>${pPr(tiny)}<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id + 1}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">`
          + `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(x.x0)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(x.y0)}</wp:posOffset></wp:positionV>`
          + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Image ${id}"/><wp:cNvGraphicFramePr/>${pic_}</wp:anchor></w:drawing></w:r></w:p>`);
        continue;
      }
      // sinon : dans son propre paragraphe, à sa taille (réduite si elle dépasse la largeur)
      out.push(`<w:p>${pPr(`<w:spacing w:before="${tw(prevBottom == null ? 0 : x.y0 - prevBottom)}" w:after="0"/>` + (!center && x.x0 - box.L > 2 ? `<w:ind w:left="${tw(x.x0 - box.L)}"/>` : '') + (center ? '<w:jc w:val="center"/>' : ''))}<w:r><w:drawing>`
        + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Image ${id}"/>${pic_}</wp:inline></w:drawing></w:r></w:p>`);
      prevBottom = x.y1;
      lastTable = false;
    }
    endPara();
    if (brk) out.push(`<w:p>${pPr(tiny)}</w:p>`); // page vide
    return out.join('');
  };
  const tableXml = (t, box, page) => {
    const cols = t.xs.slice(1).map((x, k) => tw(x - t.xs[k])), bd = (side, on) => `<w:${side} w:val="${on ? 'single' : 'nil'}"${on ? ' w:sz="4" w:space="0" w:color="000000"' : ''}/>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${cols.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblInd w:w="${tw(t.x0 - box.L)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
      + `<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map(c => `<w:gridCol w:w="${c}"/>`).join('')}</w:tblGrid>`
      + t.rows.map((row, i) => `<w:tr><w:trPr><w:trHeight w:val="${tw(t.ys[i + 1] - t.ys[i])}" w:hRule="atLeast"/></w:trPr>` + row.map(rc => {
        const c = rc.cell, w = cols.slice(rc.j, rc.j + rc.span).reduce((a, b) => a + b, 0);
        const tcPr = `<w:tcW w:w="${w}" w:type="dxa"/>` + (rc.span > 1 ? `<w:gridSpan w:val="${rc.span}"/>` : '') + (c.rows > 1 ? `<w:vMerge${rc.cont ? '' : ' w:val="restart"'}/>` : '')
          + `<w:tcBorders>${bd('top', rc.b.top)}${bd('left', rc.b.left)}${bd('bottom', rc.b.bottom)}${bd('right', rc.b.right)}</w:tcBorders>` + (c.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${hexOf(c.fill)}"/>` : '');
        const xml = rc.cont ? '' : flowXml(c.items, { L: c.x0 + 2.85, R: c.x1 - 2.85, R0: c.x1 - 2.85, cell: true }, page);
        return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${xml.endsWith('</w:p>') ? xml : xml + '<w:p/>'}</w:tc>`;
      }).join('') + '</w:tr>').join('') + '</w:tbl>';
  };
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const parts = [];
  for (const [z, tag] of [['head', 'hdr'], ['foot', 'ftr']]) if (hf[z]) {
    pageNo = hf[z].no; inHF = true;
    const xml = flowXml(hf[z].items, { L, R, R0: R }, hf[z].page);
    pageNo = null; inHF = false;
    hf[z].file = `${z === 'head' ? 'header' : 'footer'}1.xml`;
    hf[z].rid = rel(z === 'head' ? 'header' : 'footer', hf[z].file);
    parts.push([`word/${hf[z].file}`, `${XMLH}<w:${tag} ${NS}>${xml}</w:${tag}>`]);
  }
  const hDist = hf.head ? Math.min(...hf.head.items.map(x => x.y0)) : Math.min(T, 36), fDist = hf.foot ? H - Math.max(...hf.foot.items.map(x => x.y1)) : Math.min(B, 28);
  // réglages de page ; c (colonnes) : largeurs [colonne 1, espace, colonne 2]
  function sect(c) {
    return (hf.head ? `<w:headerReference w:type="default" r:id="${hf.head.rid}"/>` : '') + (hf.foot ? `<w:footerReference w:type="default" r:id="${hf.foot.rid}"/>` : '')
      + `<w:type w:val="continuous"/><w:pgSz w:w="${tw(W)}" w:h="${tw(H)}"${W > H ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(T)}" w:right="${tw(W - R)}" w:bottom="${tw(B)}" w:left="${tw(L)}" w:header="${tw(hDist)}" w:footer="${tw(fDist)}" w:gutter="0"/>`
      + (c ? `<w:cols w:num="2" w:space="${tw(c[1])}" w:equalWidth="0"><w:col w:w="${tw(c[0])}" w:space="${tw(c[1])}"/><w:col w:w="${tw(c[2])}"/></w:cols>` : '');
  }
  const bodyXml = pdf.map((p, i) => flowXml(p.flow, { L, R, R0: R }, p, i > 0)).join('');
  const lang = document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR', f0 = xmlEsc(font0);
  const heading = n => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="${n - 1}"/></w:pPr></w:style>`;
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', types = ['png', 'jpeg'].filter(t => media.some(m => m.name.endsWith(t)));
  return [
    ['[Content_Types].xml', `${XMLH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.map(t => `<Default Extension="${t}" ContentType="image/${t}"/>`).join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${parts.map(([n]) => `<Override PartName="/${n}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${n.includes('header') ? 'header' : 'footer'}+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${XMLH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/document.xml', `${XMLH}<w:document ${NS}><w:body>${bodyXml}<w:sectPr>${sect()}</w:sectPr></w:body></w:document>`],
    ['word/styles.xml', `${XMLH}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f0}" w:hAnsi="${f0}" w:eastAsia="${f0}" w:cs="${f0}"/><w:sz w:val="${Math.round(body * 2)}"/><w:szCs w:val="${Math.round(body * 2)}"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${heading(1)}${heading(2)}${heading(3)}<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="57" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`],
    ['word/settings.xml', `${XMLH}<w:settings ${W_NS}><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`],
    ['word/_rels/document.xml.rels', `${XMLH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join('')}</Relationships>`],
    ...parts,
  ].map(([name, s]) => ({ name, data: enc.encode(s) })).concat(media);
}

// ---------- PDF (ou photo) → Excel ----------
// Une feuille par page. Rangées : celles des tableaux, ou les lignes de texte ; colonnes : les blancs verticaux communs aux rangées
// qui ont plusieurs cases (texte aligné à gauche, à droite ou centré, tout tombe dans la bonne colonne).
async function exportXlsx() {
  if (!pages.length) return convertAfterOpen(exportXlsx);
  await ensureText();
  toast('Préparation du fichier Excel…');
  try {
    const pdf = await readPdf(await build(pages)), name = exportName('.xlsx');
    track('excel');
    download(new Blob([makeZip(xlsxFiles(pdf.map(sheetRows)))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    toast(tr('{name} téléchargé ✓', { name }));
  } catch (e) { console.error(e); toast(tr('Conversion impossible : {m}', { m: e.message }), 'error'); }
}
// page lue → rangées de cases { col, t, bold } et largeurs des colonnes (pt)
function sheetRows(page) {
  const cells = [], ink = cs => cs.filter(c => c.c.trim()), bold = cs => ink(cs).filter(c => c.font.bold).length * 2 > ink(cs).length;
  for (const x of flatItems(page.flow)) {
    if (x.table) {
      x.rows.forEach((row, i) => row.forEach(rc => {
        if (rc.cont) return;
        const ls = rc.cell.items.filter(it => it.chars);
        cells.push({ row: x.ys[i], x0: rc.cell.x0 + 1, x1: rc.cell.x1 - 1, t: ls.map(l => l.chars.map(c => c.c).join('').trim()).join(' '), bold: bold(ls.flatMap(l => l.chars)) });
      }));
      continue;
    }
    if (!x.chars) continue;
    // morceaux séparés par un grand blanc : cases différentes
    let piece = [], last;
    const flush = () => { const k = ink(piece); if (k.length) cells.push({ row: x.base, x0: Math.min(...k.map(c => c.x0)), x1: Math.max(...k.map(c => c.x1)), t: piece.map(c => c.c).join('').trim(), bold: bold(piece) }); piece = []; };
    for (const ch of x.chars) { if (ch.c.trim() && last && ch.x0 - last.x1 > ch.size * 1.2) flush(); piece.push(ch); if (ch.c.trim()) last = ch; }
    flush();
  }
  // rangées : même ligne de base, ou même rangée de tableau
  const rows = [];
  for (const c of cells.sort((a, b) => a.row - b.row || a.x0 - b.x0)) { const r = rows.at(-1); if (r && Math.abs(r.y - c.row) < 3) r.cells.push(c); else rows.push({ y: c.row, cells: [c] }); }
  // colonnes, bloc par bloc (rangées à plusieurs cases qui se suivent : un tableau, deux colonnes de texte…) : réunion des étendues
  // des cases ; les blancs entre elles séparent les colonnes. Une rangée d'une seule case (titre, paragraphe) va en colonne A.
  const out = [], widths = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].cells.length < 2) { const c = rows[i++].cells[0]; out.push([{ col: 0, t: c.t, bold: c.bold }]); continue; }
    let j = i;
    while (j < rows.length && rows[j].cells.length > 1) j++;
    const block = rows.slice(i, j), cols = [];
    for (const [a, b] of block.flatMap(r => r.cells.map(c => [c.x0, c.x1])).sort((a, b) => a[0] - b[0])) { const c = cols.at(-1); if (c && a <= c[1]) c[1] = Math.max(c[1], b); else cols.push([a, b]); }
    // colonne que la case recouvre (la première si elle en recouvre plusieurs) ; sinon celle qui commence avant elle
    const colOf = c => { const k = cols.findIndex(([a, b]) => Math.min(b, c.x1) - Math.max(a, c.x0) > 0); return k >= 0 ? k : Math.max(0, cols.findLastIndex(([a]) => a <= c.x0 + 2)); };
    for (const r of block) { const used = new Map(); for (const c of r.cells) { let k = colOf(c); while (used.has(k)) k++; used.set(k, c); } out.push([...used].sort((a, b) => a[0] - b[0]).map(([col, c]) => ({ col, t: c.t, bold: c.bold }))); }
    cols.forEach(([a, b], k) => { widths[k] = Math.max(widths[k] || 0, b - a + 12); });
    i = j;
  }
  return { rows: out, widths: widths.length ? Array.from(widths, w => w || 60) : [60] };
}
// Nombre écrit à la française (« 1 200,50 », « 3,50 € », « 12 % ») ou à l'anglaise selon la langue de Rature ; sinon du texte.
// Un zéro en tête (téléphone, code postal) ou plus de 15 chiffres (IBAN…) : texte, Excel les abîmerait.
function cellValue(t) {
  const s = t.replace(/[  ]/g, ' ').trim(), m = /^(€|\$)?\s*(-?[\d., ]+?)\s*(€|\$|%)?$/.exec(s);
  if (!m || (m[1] && m[3])) return null;
  const n = m[2].trim(), fr = document.documentElement.lang !== 'en';
  if (/^-?0\d/.test(n) || n.replace(/\D/g, '').length > 15) return null;
  // sans ambiguïté quelle que soit la langue : « 1 250,50 », « 45,00 » (virgule décimale), « 1,250.50 », « 45.5 » ; seuls « 1.250 » et
  // « 1,250 » (trois chiffres après le séparateur) dépendent de la langue de Rature
  let v;
  if (/^-?\d+$/.test(n)) v = +n;
  else if (/^-?\d{1,3}( \d{3})+(,\d+)?$|^-?\d{1,3}(\.\d{3})+,\d+$|^-?\d+,(\d{1,2}|\d{4,})$/.test(n) || (fr && /^-?\d{1,3}(\.\d{3})+$|^-?\d+,\d{3}$/.test(n))) v = +n.replace(/[ .]/g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$|^-?\d+\.(\d{1,2}|\d{4,})$/.test(n) || (!fr && /^-?\d{1,3}(,\d{3})+$|^-?\d+\.\d{3}$/.test(n))) v = +n.replace(/,/g, '');
  else return null;
  const unit = m[1] || m[3];
  return unit === '%' ? { v: v / 100, s: 3 } : unit === '€' ? { v, s: 2 } : unit ? { v, s: 4 } : { v, s: 0 };
}
function xlsxFiles(sheets) {
  const enc = new TextEncoder(), col = k => { let s = ''; for (k++; k; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + (k - 1) % 26) + s; return s; };
  const sheetXml = sh => `${XMLH}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${sh.widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${Math.max(6, Math.min(80, w / 5.25)).toFixed(1)}" customWidth="1"/>`).join('')}</cols><sheetData>`
    + sh.rows.map((r, i) => `<row r="${i + 1}">` + r.map(c => {
      const ref = col(c.col) + (i + 1), n = cellValue(c.t);
      return n ? `<c r="${ref}" s="${c.bold && !n.s ? 1 : n.s}"><v>${n.v}</v></c>` : c.t ? `<c r="${ref}" t="inlineStr"${c.bold ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEsc(c.t)}</t></is></c>` : '';
    }).join('') + '</row>').join('') + '</sheetData></worksheet>';
  const names = sheets.map((_, i) => sheets.length > 1 ? tr('Page {n}', { n: i + 1 }) : tr('Feuille 1'));
  return [
    ['[Content_Types].xml', `${XMLH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${XMLH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XMLH}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${XMLH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    // styles des cases : 0 normal, 1 gras, 2 euros, 3 pourcentage, 4 nombre à 2 décimales
    ['xl/styles.xml', `${XMLH}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`],
    ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)]),
  ].map(([name, s]) => ({ name, data: enc.encode(s) }));
}

// ---------- PDF → images (JPG, PNG) ----------
// Une page : un fichier ; plusieurs : une archive ZIP. JPG sur fond blanc, PNG sans perte ; 180 ppp, assez pour imprimer
async function exportImages(fmt, list = pages) {
  if (!pages.length) return convertAfterOpen(() => exportImages(fmt));
  fmt ??= await ask({ title: 'PDF en image', text: 'Format des images :', buttons: [{ label: 'Annuler', value: null }, { label: 'PNG', value: 'png' }, { label: 'JPG', value: 'jpg', primary: true }] });
  if (!fmt) return;
  toast(list.length > 1 ? 'Préparation des images…' : "Préparation de l'image…");
  try {
    const mu = await getMupdf(), doc = mu.Document.openDocument(await build(list), 'application/pdf'), base = exportName(''), files = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i), pix = page.toPixmap(mu.Matrix.scale(2.5, 2.5), mu.ColorSpace.DeviceRGB, false, true);
      files.push({ name: `${base} - page ${pages.indexOf(list[i]) + 1}.${fmt}`, data: (fmt === 'png' ? pix.asPNG() : pix.asJPEG(90)).slice() });
      pix.destroy(); page.destroy();
    }
    doc.destroy();
    track('image', { fmt, pages: files.length });
    if (files.length === 1) download(new Blob([files[0].data], { type: fmt === 'png' ? 'image/png' : 'image/jpeg' }), files[0].name);
    else download(makeZip(files), `${base} - images.zip`);
  } catch (e) { console.error(e); toast("Impossible de créer l'image.", 'error'); }
}

// ---------- Word et Excel → PDF ----------
const isDocx = f => /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const isXlsx = f => /\.xlsx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Archive ZIP (fichier .docx, .xlsx) : nom → contenu, décompressé par le navigateur
async function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Map(), dec = new TextDecoder();
  let e = bytes.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('archive illisible');
  let p = v.getUint32(e + 16, true);
  for (let k = v.getUint16(e + 10, true); k--;) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true), name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), raw = bytes.subarray(start, start + size);
    out.set(name, method === 8 ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : raw);
    p += 46 + nl + xl + cl;
  }
  return out;
}
// Lecture XML sans se soucier des préfixes : enfants et attributs par nom local
const xKids = (el, tag) => el ? [...el.childNodes].filter(n => n.nodeType === 1 && (!tag || n.localName === tag)) : [];
const xKid = (el, tag) => xKids(el, tag)[0];
const xAt = (el, a) => { if (!el) return null; for (const x of el.attributes) if (x.localName === a) return x.value; return null; };
const xDeep = (el, tag) => el ? [...el.getElementsByTagName('*')].filter(n => n.localName === tag) : [];
async function officeParts(bytes) {
  const files = await unzip(bytes), dec = new TextDecoder();
  const xml = n => files.has(n) ? new DOMParser().parseFromString(dec.decode(files.get(n)), 'application/xml').documentElement : null;
  // relations d'une partie : identifiant → cible (chemin dans l'archive, ou adresse web)
  const rels = part => {
    const dir = part.replace(/[^/]*$/, ''), r = xml(dir + '_rels/' + part.slice(dir.length) + '.rels'), out = {};
    for (const x of xKids(r, 'Relationship')) {
      const t = xAt(x, 'Target');
      out[xAt(x, 'Id')] = xAt(x, 'TargetMode') === 'External' ? t : (t.startsWith('/') ? t.slice(1) : (dir + t).split('/').reduce((a, s) => (s === '..' ? a.pop() : a.push(s), a), []).join('/'));
    }
    return out;
  };
  return { files, xml, rels };
}
// Images d'un document : PNG et JPEG directement, les autres (GIF, BMP, WebP) redessinées par le navigateur ; EMF/WMF ignorées
async function embedPicture(pdf, bytes) {
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return await pdf.embedJpg(bytes);
    const bmp = await createImageBitmap(new Blob([bytes])), c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
    c.getContext('2d').drawImage(bmp, 0, 0);
    return await pdf.embedPng(new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()));
  } catch { return null; }
}
// Hauteurs de ligne comme Word : celles de la police (table hhea), sinon 1,15 fois la taille.
// Caladea est un peu moins haute que Cambria, qu'elle remplace : ramenée à la hauteur de Cambria.
const LINE_HEIGHT = { cambria: 1.172 };
const fontMetric = f => {
  const k = f.embedder?.font, h = k?.hhea, u = k?.unitsPerEm;
  if (!h || !u) return { asc: .9, desc: .25 };
  const asc = h.ascent / u, desc = (h.lineGap - h.descent) / u, s = LINE_HEIGHT[f.rKey] ? LINE_HEIGHT[f.rKey] / (asc + desc) : 1;
  return { asc: asc * s, desc: desc * s };
};
const pdfColor = hex => { const n = parseInt(hex, 16); return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const HIGHLIGHT = { yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000',
  darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000' };
const cleanText = t => t.replace(/[\t\n\r­]/g, '').replace(/[^\u0000-￿]/g, '?');
function addLink(pdf, page, [x0, y0, x1, y1], uri) {
  const L = PDFLib, a = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x0, y0, x1, y1], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: L.PDFString.of(uri) } }));
  page.node.addAnnot(a);
}

// ---------- Word (.docx) → PDF ----------
// Mis en page comme Word : styles, listes numérotées, tabulations, tableaux (bordures, fusions, fonds), images, en-têtes et pieds
// de page (numéro de page), colonnes, liens. Le texte est écrit en vrai texte avec les polices libres de mêmes largeurs
// (Carlito pour Calibri…) : il reste modifiable dans Rature.
// ponytail: les images flottantes sont posées dans le fil du texte (sauf celles placées par rapport à la page) ; pas de zones de
//           texte, formes, graphiques ni notes de bas de page ; une rangée de tableau ne se coupe pas entre deux pages
async function docxToPdf(bytes) {
  const { files, xml, rels } = await officeParts(bytes), doc = xml('word/document.xml');
  if (!doc) throw new Error('document Word illisible');
  const compat = +xAt(xDeep(xml('word/settings.xml'), 'compatSetting').find(e => xAt(e, 'name') === 'compatibilityMode'), 'val') || 12;
  const docRels = rels('word/document.xml'), styles = xml('word/styles.xml'), numbering = xml('word/numbering.xml'), theme = xml('word/theme/theme1.xml');
  const val = el => xAt(el, 'val'), on = el => !!el && !/^(0|false|none|off)$/.test(val(el) || ''), tw = v => (+v || 0) / 20;
  // polices du thème (« minorHAnsi » → Calibri, Aptos…)
  const themeFont = k => xAt(xKid(xDeep(theme, /major/i.test(k) ? 'majorFont' : 'minorFont')[0], 'latin'), 'typeface');
  const border = el => el && !/^(nil|none)$/.test(val(el)) ? { w: Math.max(.25, (+xAt(el, 'sz') || 4) / 8), color: /^[0-9A-F]{6}$/i.test(xAt(el, 'color')) ? xAt(el, 'color') : '000000', space: +xAt(el, 'space') || 0 } : el ? false : undefined;
  const borders = el => el && Object.fromEntries(xKids(el).map(b => [b.localName.replace('start', 'left').replace('end', 'right'), border(b)]));
  const rProps = (rPr, o = {}) => {
    for (const c of xKids(rPr)) switch (c.localName) {
      case 'b': o.b = on(c); break;
      case 'i': o.i = on(c); break;
      case 'u': o.u = !!val(c) && val(c) !== 'none'; break;
      case 'strike': case 'dstrike': o.strike = on(c); break;
      case 'caps': o.caps = on(c); break;
      case 'vanish': o.hidden = on(c); break;
      case 'color': if (/^[0-9A-F]{6}$/i.test(val(c))) o.color = val(c); break;
      case 'sz': o.sz = +val(c) / 2; break;
      case 'rFonts': o.font = xAt(c, 'ascii') || xAt(c, 'hAnsi') || (xAt(c, 'asciiTheme') && themeFont(xAt(c, 'asciiTheme'))) || o.font; break;
      case 'vertAlign': o.va = val(c); break;
      case 'highlight': o.bg = HIGHLIGHT[val(c)]; break;
      case 'shd': if (/^[0-9A-F]{6}$/i.test(xAt(c, 'fill'))) o.bg = xAt(c, 'fill'); break;
      case 'rStyle': o.rStyle = val(c); break;
    }
    return o;
  };
  const pProps = (pPr, o = {}) => {
    for (const c of xKids(pPr)) switch (c.localName) {
      case 'jc': o.jc = { start: 'left', end: 'right', distribute: 'both' }[val(c)] || val(c); break;
      case 'ind': for (const [a, k] of [['left', 'left'], ['start', 'left'], ['right', 'right'], ['end', 'right'], ['firstLine', 'first'], ['hanging', 'hang']]) if (xAt(c, a) != null) o[k] = tw(xAt(c, a));
        if (xAt(c, 'hanging') != null) o.first = 0; if (xAt(c, 'firstLine') != null) o.hang = 0; break;
      case 'spacing': for (const a of ['before', 'after', 'line']) if (xAt(c, a) != null) o[a] = +xAt(c, a);
        if (xAt(c, 'lineRule')) o.rule = xAt(c, 'lineRule');
        if (on({ attributes: [{ localName: 'val', value: xAt(c, 'beforeAutospacing') ?? '0' }] })) o.before = 280;
        if (on({ attributes: [{ localName: 'val', value: xAt(c, 'afterAutospacing') ?? '0' }] })) o.after = 280; break;
      case 'numPr': o.numId = val(xKid(c, 'numId')) ?? o.numId; o.ilvl = +(val(xKid(c, 'ilvl')) ?? o.ilvl ?? 0); break;
      case 'pStyle': o.style = val(c); break;
      case 'pageBreakBefore': o.pbb = on(c); break;
      case 'keepNext': o.keepNext = on(c); break;
      case 'contextualSpacing': o.ctx = on(c); break;
      case 'shd': o.fill = /^[0-9A-F]{6}$/i.test(xAt(c, 'fill')) ? xAt(c, 'fill') : null; break;
      case 'pBdr': o.bdr = { ...o.bdr, ...borders(c) }; break;
      case 'tabs': o.tabs = [...(o.tabs || [])];
        for (const t of xKids(c, 'tab')) { const pos = tw(xAt(t, 'pos')); o.tabs = o.tabs.filter(x => Math.abs(x.pos - pos) > .5); if (val(t) !== 'clear') o.tabs.push({ pos, val: { num: 'left', start: 'left', end: 'right', decimal: 'right' }[val(t)] || val(t), leader: xAt(t, 'leader') }); }
        break;
    }
    return o;
  };
  // styles : chaîne « basedOn » résolue une fois
  const styleEls = new Map(xKids(styles, 'style').map(s => [xAt(s, 'styleId'), s])), styleCache = new Map();
  const style = id => {
    if (!id || !styleEls.has(id)) return { p: {}, r: {}, tbl: null };
    if (styleCache.has(id)) return styleCache.get(id);
    styleCache.set(id, { p: {}, r: {} }); // garde-fou contre les boucles
    const el = styleEls.get(id), base = style(val(xKid(el, 'basedOn')));
    const s = { p: pProps(xKid(el, 'pPr'), { ...base.p, tabs: base.p.tabs }), r: rProps(xKid(el, 'rPr'), { ...base.r }), tbl: xKid(el, 'tblPr') || base.tbl, type: xAt(el, 'type'), cond: { ...base.cond } };
    // style de tableau : mises en forme de la ligne d'en-tête, de la première colonne, des bandes…
    for (const c of xKids(el, 'tblStylePr')) { const tc = xKid(c, 'tcPr'), f = xAt(xKid(tc, 'shd'), 'fill'); s.cond[xAt(c, 'type')] = { p: pProps(xKid(c, 'pPr')), r: rProps(xKid(c, 'rPr')), fill: /^[0-9A-F]{6}$/i.test(f) ? f : null, bd: borders(xKid(tc, 'tcBorders')) || {} }; }
    delete s.p.style;
    styleCache.set(id, s);
    return s;
  };
  const defaultStyle = type => xAt(xKids(styles, 'style').find(s => xAt(s, 'type') === type && on({ attributes: [{ localName: 'val', value: xAt(s, 'default') ?? '0' }] })), 'styleId');
  const defs = xKid(styles, 'docDefaults'), rDef = rProps(xKid(xKid(defs, 'rPrDefault'), 'rPr'), { font: themeFont('minor') || 'Calibri', sz: 10 }), pDef = pProps(xKid(xKid(defs, 'pPrDefault'), 'pPr'));
  const pStyle0 = defaultStyle('paragraph'), tStyle0 = defaultStyle('table');
  // listes : définition par niveau, compteurs par liste
  const abstracts = new Map(xKids(numbering, 'abstractNum').map(a => [xAt(a, 'abstractNumId'), new Map(xKids(a, 'lvl').map(l => [+xAt(l, 'ilvl'), {
    start: +(val(xKid(l, 'start')) ?? 1), fmt: val(xKid(l, 'numFmt')) || 'decimal', text: val(xKid(l, 'lvlText')) ?? '', suff: val(xKid(l, 'suff')) || 'tab',
    p: pProps(xKid(l, 'pPr')), r: rProps(xKid(l, 'rPr')) }]))]));
  const nums = new Map(xKids(numbering, 'num').map(n => [xAt(n, 'numId'), { abs: val(xKid(n, 'abstractNumId')),
    starts: new Map(xKids(n, 'lvlOverride').filter(o => xKid(o, 'startOverride')).map(o => [+xAt(o, 'ilvl'), +val(xKid(o, 'startOverride'))])) }]));
  const counters = new Map(), dryRun = async fn => { const snap = [...counters].map(([k, v]) => [k, [...v]]); await fn(); counters.clear(); for (const [k, v] of snap) counters.set(k, v); };
  const roman = n => [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
  const letter = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(97 + (n - 1) % 26) + s; return s; };
  const numFmt = (n, f) => ({ lowerLetter: letter(n), upperLetter: letter(n).toUpperCase(), lowerRoman: roman(n), upperRoman: roman(n).toUpperCase(), decimalZero: String(n).padStart(2, '0'), none: '' })[f] ?? String(n);
  const bulletChar = t => [...t].map(c => c.charCodeAt(0) >= 0xF000 ? ({ 0xF0A7: '▪', 0xF0D8: '➢', 0xF076: '❖', 0xF0FC: '✓' })[c.charCodeAt(0)] || '•' : c).join('');
  const listLabel = (numId, ilvl) => {
    const n = nums.get(numId), lv = n && abstracts.get(n.abs);
    if (!lv?.get(ilvl)) return null;
    const c = counters.get(numId) || counters.set(numId, []).get(numId), def = lv.get(ilvl);
    c[ilvl] = c[ilvl] == null ? (n.starts.get(ilvl) ?? def.start) : c[ilvl] + 1;
    c.length = ilvl + 1; // les niveaux plus profonds repartent de leur début
    const text = def.fmt === 'bullet' ? bulletChar(def.text) : def.text.replace(/%(\d)/g, (_, k) => numFmt(c[k - 1] ?? lv.get(k - 1)?.start ?? 1, lv.get(k - 1)?.fmt));
    return { text, def };
  };

  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontCache = {}, fonts = new Map();
  const fontFor = async r => {
    const k = [r.font, r.b, r.i].join('|');
    if (!fonts.has(k)) { const key = fontKeyFor(r.font || ''), f = await pdfFont(pdf, { key, bold: r.b, italic: r.i }, fontCache); f.rKey = key; fonts.set(k, f); }
    return fonts.get(k);
  };
  const pics = new Map(), picture = async (part, id) => { const path = rels(part)[id]; if (!path || !files.has(path)) return null; if (!pics.has(path)) pics.set(path, await embedPicture(pdf, files.get(path))); return pics.get(path); };
  const fld = { page: 1, pages: 1 };

  // contenu d'un paragraphe → morceaux : texte (avec style), tabulation, retour à la ligne, saut de page/colonne, image, numéro de page
  const inlines = async (p, part, pp, ts) => {
    const out = [], partRels = rels(part), field = { depth: 0 };
    const baseR = { ...rDef, ...style(pStyle0).r, ...ts?.r, ...(pp.styleId !== pStyle0 ? style(pp.styleId).r : {}) };
    const walk = async (el, link) => {
      for (const c of xKids(el)) {
        const n = c.localName;
        if (n === 'r') await run(c, link);
        else if (n === 'hyperlink') await walk(c, partRels[xAt(c, 'id')] || link);
        else if (n === 'fldSimple') { const ins = xAt(c, 'instr') || ''; if (/\b(PAGE|NUMPAGES)\b/.test(ins)) { const r = rProps(xKid(xKid(c, 'r'), 'rPr'), { ...baseR }); out.push({ field: /NUMPAGES/.test(ins) ? 'pages' : 'page', r }); } else await walk(c, link); }
        else if (['ins', 'smartTag', 'customXml', 'sdt', 'sdtContent', 'moveTo', 'dir', 'bdo'].includes(n)) await walk(c, link);
      }
    };
    const run = async (r, link) => {
      const rp = xKid(r, 'rPr'), props = rProps(rp, { ...baseR, ...style(rProps(rp).rStyle).r });
      if (props.hidden) return;
      for (const c of xKids(r)) {
        const n = c.localName;
        if (n === 'fldChar') { const t = xAt(c, 'fldCharType'); if (t === 'begin') field.depth++, field.instr = ''; else if (t === 'separate') field.result = true; else if (t === 'end') { field.depth--; field.result = false; field.dyn = false; } continue; }
        if (n === 'instrText') { field.instr += c.textContent; if (!field.result && /\b(PAGE|NUMPAGES)\b/.test(field.instr) && !field.dyn) { field.dyn = true; out.push({ field: /NUMPAGES/.test(field.instr) ? 'pages' : 'page', r: props }); } continue; }
        if (field.depth && !field.result) continue; // code du champ
        if (field.dyn) continue; // ancien résultat d'un numéro de page : remplacé par le vrai
        if (n === 't') out.push({ t: props.caps ? c.textContent.toUpperCase() : c.textContent, r: props, link });
        else if (n === 'tab' || n === 'ptab') out.push({ tab: true, r: props });
        else if (n === 'br' || n === 'cr') out.push({ br: xAt(c, 'type') === 'page' ? 'page' : xAt(c, 'type') === 'column' ? 'column' : 'line', r: props });
        else if (n === 'noBreakHyphen') out.push({ t: '-', r: props, link });
        else if (n === 'sym') out.push({ t: bulletChar(String.fromCharCode(parseInt(xAt(c, 'char'), 16) || 63)), r: props });
        else if (n === 'drawing' || n === 'pict') {
          const blip = xDeep(c, 'blip')[0] || xDeep(c, 'imagedata')[0], id = blip && (xAt(blip, 'embed') || xAt(blip, 'id'));
          const img = id && await picture(part, id);
          if (!img) continue;
          const ext = xDeep(c, 'extent')[0], shape = xDeep(c, 'shape')[0];
          let w = ext ? +xAt(ext, 'cx') / 12700 : 0, h = ext ? +xAt(ext, 'cy') / 12700 : 0;
          if (!w && shape) { const st = xAt(shape, 'style') || ''; w = parseFloat(/width:([\d.]+)pt/.exec(st)?.[1]) || img.width * .75; h = parseFloat(/height:([\d.]+)pt/.exec(st)?.[1]) || img.height * .75; }
          const anchor = xKid(c, 'anchor'), pos = (tag, dir) => { const e = xKid(anchor, tag); return e && { from: xAt(e, 'relativeFrom'), off: +(xKid(e, 'posOffset')?.textContent || 0) / 12700, align: xKid(e, 'align')?.textContent }; };
          const free = anchor && (xKid(anchor, 'wrapNone') || on({ attributes: [{ localName: 'val', value: xAt(anchor, 'behindDoc') ?? '0' }] }));
          out.push({ img, w, h, abs: free ? { h: pos('positionH'), v: pos('positionV'), behind: xAt(anchor, 'behindDoc') === '1' } : null });
        }
      }
    };
    await walk(p);
    return out;
  };

  // propriétés d'un paragraphe : défauts, style, liste, puis réglages directs
  const paraProps = (pPr, ts) => {
    const direct = pProps(pPr), id = direct.style || pStyle0, st = style(id);
    let pp = { ...pDef, ...style(pStyle0).p, ...ts?.p, ...(id !== pStyle0 ? st.p : {}), tabs: [...(st.p.tabs || [])], styleId: id };
    const numId = direct.numId ?? st.p.numId, ilvl = direct.ilvl ?? st.p.ilvl ?? 0;
    if (numId && numId !== '0') { const n = nums.get(numId), d = n && abstracts.get(n.abs)?.get(ilvl); if (d) pp = { ...pp, ...d.p, tabs: [...pp.tabs, ...(d.p.tabs || [])] }; pp.numId = numId; pp.ilvl = ilvl; }
    pp = pProps(pPr, pp);
    if (numId === '0') pp.numId = null;
    return pp;
  };

  // coupe un paragraphe en lignes ; width : largeur de la zone de texte
  const layoutPara = async (pp, items, width, label) => {
    const left = pp.left || 0, right = pp.right || 0, first = (pp.first || 0) - (pp.hang || 0), dts = 36, segs = [];
    for (const it of items) {
      if (it.t != null) {
        const f = await fontFor(it.r), size = (it.r.sz || 11) * (it.r.va && it.r.va !== 'baseline' ? .65 : 1);
        for (const w of it.t.split(/(\s+)/)) if (w) segs.push({ t: w, f, size, r: it.r, link: it.link, w: f.widthOfTextAtSize(cleanText(w), size), space: /^\s+$/.test(w) });
      } else if (it.field) { const f = await fontFor(it.r), t = String(fld[it.field]), size = it.r.sz || 11; segs.push({ t, f, size, r: it.r, w: f.widthOfTextAtSize(t, size) }); }
      else if (it.img) segs.push(it.abs ? { float: it, w: 0 } : { img: it.img, w: it.w, h: it.h });
      else segs.push({ ...it, f: await fontFor(it.r), size: it.r.sz || 11 });
    }
    if (label) { const r = { ...rDef, ...style(pp.styleId).r, ...label.def.r }, f = await fontFor(r), size = r.sz || 11; segs.unshift({ t: label.text, f, size, r, w: f.widthOfTextAtSize(cleanText(label.text), size), label: true }, { tab: true, num: label.def.suff, f, size, r }); }
    const lines = [], lineStart = () => left + (lines.length ? 0 : first), lineEnd = () => width - right, newLine = () => ({ segs: [], x: lineStart(), start: lineStart() });
    let line = newLine(), group = null;
    const endGroup = () => { // tabulation à droite ou centrée : le texte qui suit se cale sur le taquet
      if (!group) return;
      const gw = line.x - group.x, shift = Math.max(0, (group.stop.val === 'center' ? group.stop.pos - gw / 2 : group.stop.pos - gw) - group.x);
      for (const s of line.segs.slice(group.i)) s.x += shift;
      if (group.tab) group.tab.w += shift;
      line.x += shift;
      group = null;
    };
    const finish = brk => { endGroup(); while (line.segs.length && line.segs.at(-1).space) line.x -= line.segs.pop().w; line.brk = brk; lines.push(line); line = newLine(); };
    for (const s of segs) {
      if (s.br) { finish(s.br); continue; }
      if (s.tab) {
        endGroup();
        const at = line.x, stops = [...pp.tabs, ...(s.num === 'tab' && left > at + .5 ? [{ pos: left, val: 'left' }] : [])].filter(t => t.pos > at + .5 && t.val !== 'bar').sort((a, b) => a.pos - b.pos);
        const stop = s.num === 'space' ? { pos: at + s.f.widthOfTextAtSize(' ', s.size), val: 'left' } : s.num === 'nothing' ? { pos: at, val: 'left' } : stops[0] || { pos: (Math.floor(at / dts) + 1) * dts, val: 'left' };
        const tab = { tab: true, x: at, w: stop.val === 'left' ? stop.pos - at : 0, leader: stop.leader, f: s.f, size: s.size, r: s.r };
        line.segs.push(tab);
        if (stop.val === 'left') line.x = stop.pos; else group = { stop, i: line.segs.length, x: at, tab };
        continue;
      }
      if (line.x + s.w > lineEnd() + .01 && line.segs.some(x => !x.space && !x.tab && !x.label) && !s.space) finish(null);
      if (s.space && !line.segs.length) continue;
      line.segs.push({ ...s, x: line.x });
      line.x += s.w;
    }
    if (line.segs.length || !lines.length) finish('end');
    lines.at(-1).last = true;
    // hauteur de chaque ligne, d'après ses polices et l'interligne du paragraphe
    const sz0 = (rDef.sz || 11), f0 = await fontFor({ ...rDef, ...style(pp.styleId).r });
    for (const l of lines) {
      let asc = 0, desc = 0;
      for (const s of l.segs) { if (s.img) asc = Math.max(asc, s.h); else if (s.f) { const m = fontMetric(s.f); asc = Math.max(asc, m.asc * s.size); desc = Math.max(desc, m.desc * s.size); } }
      if (!asc) { const m = fontMetric(f0), size = style(pp.styleId).r.sz || sz0; asc = m.asc * size; desc = m.desc * size; }
      const nat = asc + desc, rule = pp.rule || 'auto', line = pp.line ?? 240;
      l.h = rule === 'exact' ? tw(line) : rule === 'atLeast' ? Math.max(nat, tw(line)) : nat * line / 240;
      l.base = rule === 'exact' ? l.h - desc - Math.max(0, (l.h - nat) / 2) : asc;
      l.w = l.x;
    }
    return { lines, left, right, first };
  };

  // dessin d'un paragraphe mis en lignes, ligne par ligne (cur.y descend ; saut de page ou de colonne si besoin)
  const drawLine = (cur, l, x0, width, pp, last) => {
    if (!cur.draw) return;
    const page = cur.page, H = page.getHeight(), segs = l.segs, end = Math.max(...segs.map(s => s.x + s.w), 0);
    let shift = 0, extra = 0;
    const avail = width - (pp.right || 0);
    if (pp.jc === 'center') shift = (avail - end) / 2;
    if (pp.jc === 'right') shift = avail - end;
    if (pp.jc === 'both' && !last && !l.brk) { const gaps = segs.filter((s, i) => s.space && i > segs.findLastIndex(x => x.tab)).length; extra = gaps ? Math.max(0, avail - end) / gaps : 0; }
    let add = 0;
    const lastTab = segs.findLastIndex(x => x.tab);
    for (const [i, s] of segs.entries()) {
      const x = x0 + s.x + shift + add, yb = H - (cur.y + l.base);
      if (s.space && i > lastTab) add += extra;
      if (s.img) { page.drawImage(s.img, { x, y: yb, width: s.w, height: s.h }); continue; }
      if (s.float) { cur.floats.push(s.float); continue; }
      if (s.tab) { if (s.leader && s.leader !== 'none' && s.w > 6) { const dot = s.leader === 'hyphen' ? '-' : s.leader === 'underscore' ? '_' : '.', dw = s.f.widthOfTextAtSize(dot, s.size), n = Math.floor((s.w - 4) / dw); try { page.drawText(dot.repeat(n), { x: x + s.w - n * dw - 2, y: yb, size: s.size, font: s.f }); } catch {} } continue; }
      if (!s.f) continue;
      const color = pdfColor(s.r.color || '000000'), w = s.w + (s.space && i > lastTab ? extra : 0), m = fontMetric(s.f), rise = s.r.va === 'superscript' ? s.size * .55 : s.r.va === 'subscript' ? -s.size * .15 : 0;
      if (s.r.bg) page.drawRectangle({ x, y: yb - m.desc * s.size, width: w, height: (m.asc + m.desc) * s.size, color: pdfColor(s.r.bg) });
      if (!s.space) try { page.drawText(cleanText(s.t), { x, y: yb + rise, size: s.size, font: s.f, color }); } catch {}
      const th = Math.max(.5, s.size / 18);
      if (s.r.u && !(s.space && i === segs.length - 1)) page.drawLine({ start: { x, y: yb - s.size * .12 }, end: { x: x + w, y: yb - s.size * .12 }, thickness: th, color });
      if (s.r.strike) page.drawLine({ start: { x, y: yb + s.size * .3 }, end: { x: x + w, y: yb + s.size * .3 }, thickness: th, color });
      if (s.link && !s.link.startsWith('word/')) addLink(pdf, page, [x, yb - m.desc * s.size, x + w, yb + m.asc * s.size], s.link);
    }
  };
  const drawBorder = (cur, b, x0, x1, y) => { if (cur.draw && b) cur.page.drawLine({ start: { x: x0, y: cur.page.getHeight() - y }, end: { x: x1, y: cur.page.getHeight() - y }, thickness: b.w, color: pdfColor(b.color) }); };
  const floats = (cur, x0) => { // images posées par rapport à la page ou à la marge, hors du fil du texte
    if (!cur.draw) return (cur.floats = []);
    for (const s of cur.floats) {
      const H = cur.page.getHeight(), W = cur.page.getWidth(), sp = cur.sect;
      const X = !s.abs.h ? x0 : s.abs.h.align ? ({ left: sp.left, center: (W - s.w) / 2, right: W - sp.right - s.w })[s.abs.h.align] ?? x0 : (s.abs.h.from === 'page' ? 0 : s.abs.h.from === 'margin' ? sp.left : x0) + s.abs.h.off;
      const Y = !s.abs.v ? cur.paraTop : (s.abs.v.from === 'page' ? 0 : s.abs.v.from === 'margin' || s.abs.v.from === 'topMargin' ? sp.top : cur.paraTop) + s.abs.v.off;
      cur.page.drawImage(s.img, { x: X, y: H - Y - s.h, width: s.w, height: s.h });
    }
    cur.floats = [];
  };
  const fits = (cur, h) => cur.noBreak || cur.y + h <= cur.bottom + .5 || cur.y <= cur.top + .5;
  const paragraph = async (p, cur, fixed, part) => {
    const pPr = xKid(p, 'pPr'), pp = paraProps(pPr, cur.tstyle), items = await inlines(p, part, pp, cur.tstyle);
    if (!items.length && xKid(pPr, 'sectPr')) return; // paragraphe vide qui ne porte qu'un saut de section : Word ne lui donne pas de ligne
    const label = pp.numId ? listLabel(pp.numId, pp.ilvl) : null, at = () => fixed || cur.box(), box = at(), lay = await layoutPara(pp, items, box.w, label);
    const prev = cur.pend?.pp, same = prev && prev.styleId === pp.styleId;
    const after = prev && !(prev.ctx && same) ? tw(prev.after) : 0, before = pp.ctx && same ? 0 : tw(pp.before);
    cur.pend = null;
    if (pp.pbb && !cur.noBreak && cur.y > cur.top + .5) cur.newPage();
    cur.y += Math.max(after, before);
    // titre (« garder avec le suivant ») tout en bas : il passe à la page suivante avec ce qui suit
    const total = lay.lines.reduce((s, l) => s + l.h, 0);
    if (pp.keepNext && !fits(cur, total + 24)) cur.next();
    cur.paraTop = cur.y;
    const bd = pp.bdr || {};
    let x0 = box.x, x1 = box.x + box.w - (pp.right || 0);
    if (bd.top) { cur.y += bd.top.space; drawBorder(cur, bd.top, x0 + (pp.left || 0), x1, cur.y); cur.y += bd.top.w + 1; }
    for (const [i, l] of lay.lines.entries()) {
      if (!fits(cur, l.h)) { cur.next(); x0 = at().x; x1 = x0 + box.w - (pp.right || 0); }
      if (pp.fill && cur.draw) cur.page.drawRectangle({ x: x0 + (pp.left || 0), y: cur.page.getHeight() - cur.y - l.h, width: x1 - x0 - (pp.left || 0), height: l.h, color: pdfColor(pp.fill) });
      drawLine(cur, l, x0, box.w, pp, i === lay.lines.length - 1);
      cur.y += l.h;
      floats(cur, x0);
      if (l.brk === 'page' && !cur.noBreak) cur.newPage();
      if (l.brk === 'column' && !cur.noBreak) cur.next();
    }
    if (bd.bottom) { cur.y += bd.bottom.space + 1; drawBorder(cur, bd.bottom, x0 + (pp.left || 0), x1, cur.y); cur.y += bd.bottom.w; }
    cur.pend = { pp }; // son espace « après » attend le paragraphe suivant
  };
  const flushPend = cur => { if (cur.pend) cur.y += tw(cur.pend.pp.after); cur.pend = null; };

  // tableaux
  const table = async (tbl, cur, fixed, part) => {
    const at = () => fixed || cur.box(), box = at();
    const tp = xKid(tbl, 'tblPr'), st = style(val(xKid(tp, 'tblStyle')) || tStyle0), stp = st.tbl;
    const tb = { ...borders(xKid(stp, 'tblBorders')), ...borders(xKid(tp, 'tblBorders')) };
    const mar = { left: 5.4, right: 5.4, top: 0, bottom: 0 };
    for (const m of [xKid(stp, 'tblCellMar'), xKid(tp, 'tblCellMar')]) for (const c of xKids(m)) mar[c.localName.replace('start', 'left').replace('end', 'right')] = tw(xAt(c, 'w'));
    let grid = xKids(xKid(tbl, 'tblGrid'), 'gridCol').map(g => tw(xAt(g, 'w')));
    const rows = xKids(tbl, 'tr');
    if (!grid.length) { const n = Math.max(1, ...rows.map(r => xKids(r, 'tc').length)); grid = Array(n).fill(box.w / n); }
    const total = grid.reduce((a, b) => a + b, 0), k = total > box.w ? box.w / total : 1;
    grid = grid.map(g => g * k);
    const tw0 = grid.reduce((a, b) => a + b, 0), jc = val(xKid(tp, 'jc')), ind = tw(xAt(xKid(tp, 'tblInd'), 'w'));
    const dx = jc === 'center' ? (box.w - tw0) / 2 : jc === 'right' || jc === 'end' ? box.w - tw0 : ind - (compat < 15 ? mar.left : 0);
    let x0 = box.x + dx;
    // grille des cases : rangée → [{ col, span, tc, cont }]
    const cells = rows.map(tr => {
      let col = xAt(xKid(xKid(tr, 'trPr'), 'gridBefore'), 'val') | 0;
      return xKids(tr, 'tc').map(tc => {
        const pr = xKid(tc, 'tcPr'), span = +(val(xKid(pr, 'gridSpan')) || 1), vm = xKid(pr, 'vMerge'), c = { col, span, tc, pr, cont: vm && val(vm) !== 'restart' };
        col += span;
        return c;
      });
    });
    const xOf = c => x0 + grid.slice(0, c).reduce((a, b) => a + b, 0), wOf = c => grid.slice(c.col, c.col + c.span).reduce((a, b) => a + b, 0);
    // mises en forme conditionnelles du style, selon les cases cochées du tableau (en-tête, première colonne, lignes à bandes…)
    const lk = xKid(tp, 'tblLook'), lv = parseInt(xAt(lk, 'val') || '0', 16), flag = (a, bit) => xAt(lk, a) != null ? /^(1|true|on)$/.test(xAt(lk, a)) : !!(lv & bit);
    const look = { fr: flag('firstRow', 0x20), lr: flag('lastRow', 0x40), fc: flag('firstColumn', 0x80), lc: flag('lastColumn', 0x100), nh: flag('noHBand', 0x200), nv: flag('noVBand', 0x400) };
    for (const [i, row] of cells.entries()) for (const c of row) {
      const ks = ['wholeTable'], kv = c.col - (look.fc ? 1 : 0), kh = i - (look.fr ? 1 : 0);
      if (!look.nv && kv >= 0) ks.push(kv % 2 ? 'band2Vert' : 'band1Vert');
      if (!look.nh && kh >= 0) ks.push(kh % 2 ? 'band2Horz' : 'band1Horz');
      if (look.fc && c.col === 0) ks.push('firstCol');
      if (look.lc && c.col + c.span >= grid.length) ks.push('lastCol');
      if (look.fr && i === 0) ks.push('firstRow');
      if (look.lr && i === cells.length - 1) ks.push('lastRow');
      const list = ks.map(k => st.cond?.[k]).filter(Boolean);
      c.cs = { p: Object.assign({}, st.p, ...list.map(x => x.p)), r: Object.assign({}, st.r, ...list.map(x => x.r)), fill: list.reduce((f, x) => x.fill ?? f, null), bd: Object.assign({}, ...list.map(x => x.bd)) };
    }
    const measure = async (c, w) => { const sub = { ...cur, draw: false, noBreak: true, y: 0, floats: [], pend: null, tstyle: c.cs }; await dryRun(() => blocks(xKids(c.tc), sub, { x: 0, w: w - mar.left - mar.right }, part)); return sub.y; };
    const hs = [];
    for (const [i, row] of cells.entries()) {
      const trh = xKid(xKid(rows[i], 'trPr'), 'trHeight'), min = tw(xAt(trh, 'val'));
      let h = min;
      for (const c of row) if (!c.cont) { c.h = await measure(c, wOf(c)) + mar.top + mar.bottom; c.rows = 1; for (let j = i + 1; j < cells.length; j++) { const d = cells[j].find(x => x.col === c.col); if (d?.cont) c.rows++; else break; } if (c.rows === 1) h = Math.max(h, c.h); }
      hs.push(xAt(trh, 'hRule') === 'exact' ? min : h);
    }
    for (const [i, row] of cells.entries()) for (const c of row) if (!c.cont && c.rows > 1) { const have = hs.slice(i, i + c.rows).reduce((a, b) => a + b, 0); if (c.h > have) hs[i + c.rows - 1] += c.h - have; }
    for (const [i, row] of cells.entries()) {
      if (!fits(cur, hs[i])) { cur.next(); x0 = at().x + dx; }
      const y0 = cur.y, H = cur.draw && cur.page.getHeight();
      for (const c of row) {
        const x = xOf(c.col), w = wOf(c), h = c.cont ? hs[i] : hs.slice(i, i + c.rows).reduce((a, b) => a + b, 0), cb = borders(xKid(c.pr, 'tcBorders')) || {};
        const own = xAt(xKid(c.pr, 'shd'), 'fill'), fill = /^[0-9A-F]{6}$/i.test(own) ? own : c.cs.fill;
        if (!c.cont && cur.draw && fill) cur.page.drawRectangle({ x, y: H - y0 - h, width: w, height: h, color: pdfColor(fill) });
        if (!c.cont) {
          const va = val(xKid(c.pr, 'vAlign')), sub = { ...cur, noBreak: true, pend: null, tstyle: c.cs, y: y0 + mar.top + (va === 'center' ? (h - c.h) / 2 : va === 'bottom' ? h - c.h : 0), floats: [] };
          await blocks(xKids(c.tc), sub, { x: x + mar.left, w: w - mar.left - mar.right }, part);
        }
        if (!cur.draw) continue;
        const edge = (b, ax, ay, bx, by) => b && cur.page.drawLine({ start: { x: ax, y: H - ay }, end: { x: bx, y: H - by }, thickness: b.w, color: pdfColor(b.color) });
        const bd = c.cs.bd, pick = (side, outer, inner) => cb[side] !== undefined ? cb[side] : bd[side] !== undefined ? bd[side] : outer ? tb[side] : bd[inner] !== undefined ? bd[inner] : tb[inner];
        const lastRow = i + (c.cont ? 1 : c.rows) >= cells.length;
        if (!c.cont) edge(pick('top', i === 0, 'insideH'), x, y0, x + w, y0);
        if (!c.cont) edge(pick('bottom', lastRow, 'insideH'), x, y0 + h, x + w, y0 + h);
        edge(pick('left', c.col === 0, 'insideV'), x, y0, x, y0 + hs[i]);
        edge(pick('right', c.col + c.span >= grid.length, 'insideV'), x + w, y0, x + w, y0 + hs[i]);
      }
      cur.y = y0 + hs[i];
    }
  };
  // suite de paragraphes et de tableaux (corps, case de tableau, en-tête) ; dans le corps, l'espace « après » du dernier
  // paragraphe passe à la section suivante
  const blocks = async (els, cur, box, part) => {
    for (const el of els) {
      const n = el.localName;
      if (n === 'p') await paragraph(el, cur, box, part);
      else if (n === 'tbl') { flushPend(cur); await table(el, cur, box, part); }
      else if (n === 'sdt') await blocks(xKids(xKid(el, 'sdtContent')), cur, box, part);
      else if (n === 'customXml') await blocks(xKids(el), cur, box, part);
    }
    if (cur.noBreak) flushPend(cur);
  };
  // sections : taille de page, marges, colonnes, en-têtes et pieds
  const sectProps = (sp, prev = {}) => {
    const sz = xKid(sp, 'pgSz'), m = xKid(sp, 'pgMar'), cols = xKid(sp, 'cols'), refs = { ...prev.refs };
    for (const r of [...xKids(sp, 'headerReference'), ...xKids(sp, 'footerReference')]) refs[r.localName[0] + ':' + xAt(r, 'type')] = docRels[xAt(r, 'id')];
    const W = tw(xAt(sz, 'w')) || prev.W || 595, H = tw(xAt(sz, 'h')) || prev.H || 842, n = +(xAt(cols, 'num') || 1);
    const s = { W, H, top: Math.abs(tw(xAt(m, 'top') ?? 1417)), bottom: Math.abs(tw(xAt(m, 'bottom') ?? 1417)), left: tw(xAt(m, 'left') ?? 1417), right: tw(xAt(m, 'right') ?? 1417),
      header: tw(xAt(m, 'header') ?? 709), footer: tw(xAt(m, 'footer') ?? 709), type: val(xKid(sp, 'type')) || 'nextPage', titlePg: on(xKid(sp, 'titlePg')), refs };
    const space = tw(xAt(cols, 'space') ?? 720), text = W - s.left - s.right, list = xKids(cols, 'col');
    s.cols = list.length > 1 ? list.map(c => ({ w: tw(xAt(c, 'w')), sp: tw(xAt(c, 'space')) })) : Array.from({ length: n }, () => ({ w: (text - space * (n - 1)) / n, sp: space }));
    return s;
  };
  const bodyEl = xKid(doc, 'body'), sections = [];
  {
    let cur = [];
    const walk = els => { for (const el of els) { if (el.localName === 'sdt') { walk(xKids(xKid(el, 'sdtContent'))); continue; } cur.push(el); const sp = el.localName === 'p' && xKid(xKid(el, 'pPr'), 'sectPr'); if (sp) { sections.push({ els: cur, sp }); cur = []; } } };
    walk(xKids(bodyEl).filter(e => e.localName !== 'sectPr'));
    sections.push({ els: cur, sp: xKid(bodyEl, 'sectPr') });
  }
  const pageList = [], cur = { draw: true, floats: [], col: 0 };
  let sp = {};
  cur.box = () => { const s = cur.sect; return { x: s.left + s.cols.slice(0, cur.col).reduce((a, c) => a + c.w + c.sp, 0), w: s.cols[cur.col].w }; };
  cur.newPage = () => {
    const s = cur.sect;
    cur.page = pdf.addPage([s.W, s.H]);
    pageList.push({ page: cur.page, sect: s, first: !pageList.some(p => p.sect === s) });
    cur.top = cur.y = cur.colTop = s.top; cur.bottom = s.H - s.bottom; cur.col = 0; cur.maxY = 0;
  };
  cur.next = () => { // colonne suivante, sinon page suivante
    if (cur.col < cur.sect.cols.length - 1) { cur.maxY = Math.max(cur.maxY, cur.y); cur.col++; cur.y = cur.colTop; }
    else cur.newPage();
    cur.pend = null; // en haut de colonne ou de page, l'espace « après » du paragraphe précédent tombe
  };
  for (const [i, sec] of sections.entries()) {
    const prev = cur.sect;
    cur.sect = sp = sectProps(sec.sp, sp);
    if (!cur.page || (i && sp.type !== 'continuous') || prev.W !== sp.W || prev.H !== sp.H) cur.newPage();
    cur.col = 0; cur.colTop = cur.y + (cur.pend ? tw(cur.pend.pp.after) : 0); cur.maxY = 0; cur.bottom = sp.H - sp.bottom;
    if (sp.cols.length > 1) { // colonnes équilibrées, comme Word : chacune reçoit sa part de la section
      const dry = { ...cur, draw: false, noBreak: true, y: 0, floats: [], pend: null, box: () => ({ x: 0, w: sp.cols[0].w }) };
      await dryRun(() => blocks(sec.els, dry, null, 'word/document.xml'));
      cur.bottom = Math.min(cur.bottom, cur.y + dry.y / sp.cols.length + 14);
    }
    await blocks(sec.els, cur, null, 'word/document.xml');
    cur.y = Math.max(cur.y, cur.maxY); cur.col = 0; cur.bottom = sp.H - sp.bottom;
  }
  // en-têtes et pieds de page, une fois le nombre de pages connu
  fld.pages = pageList.length;
  for (const [i, pg] of pageList.entries()) {
    fld.page = i + 1;
    const s = pg.sect, kind = pg.first && s.titlePg ? 'first' : (i % 2 && s.refs['h:even'] && 0) ? 'even' : 'default';
    for (const z of ['h', 'f']) {
      const path = s.refs[`${z}:${kind}`] ?? (kind === 'first' ? null : s.refs[`${z}:default`]), root = path && xml(path);
      if (!root) continue;
      const box = { x: s.left, w: s.W - s.left - s.right }, base = { draw: false, noBreak: true, floats: [], y: 0, sect: s, page: pg.page };
      if (z === 'f') await blocks(xKids(root), base, box, path);
      const at = { ...base, draw: true, pend: null, y: z === 'h' ? s.header : s.H - s.footer - base.y, top: 0 };
      await blocks(xKids(root), at, box, path);
    }
  }
  return pdf.save();
}

// ---------- Excel (.xlsx) → PDF ----------
// Chaque feuille visible, à la largeur de la page (réduite s'il le faut, en paysage si elle est large) : valeurs telles qu'Excel
// les affiche (nombres, dates, monnaies, pourcentages), gras, couleurs, fonds, bordures, alignements, cases fusionnées.
// ponytail: valeurs déjà calculées par Excel (une formule jamais recalculée reste vide) ; pas de graphiques ni d'images
async function xlsxToPdf(bytes) {
  const { files, xml, rels } = await officeParts(bytes), wb = xml('xl/workbook.xml');
  if (!wb) throw new Error('classeur Excel illisible');
  const wbRels = rels('xl/workbook.xml'), sst = xml('xl/sharedStrings.xml'), st = xml('xl/styles.xml'), fr = document.documentElement.lang !== 'en';
  const strings = xKids(sst, 'si').map(si => xDeep(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
  const date1904 = xAt(xKid(wb, 'workbookPr'), 'date1904') === '1' || xAt(xKid(wb, 'workbookPr'), 'date1904') === 'true';
  // couleur : directe, du thème (avec sa teinte, plus claire ou plus foncée) ou de la palette d'origine
  const scheme = xKids(xDeep(xml('xl/theme/theme1.xml'), 'clrScheme')[0]).map(c => xAt(xKid(c, 'srgbClr'), 'val') || xAt(xKid(c, 'sysClr'), 'lastClr') || '000000');
  const themeHex = k => scheme[[1, 0, 3, 2][k] ?? k];
  const tint = (hex, t) => hex.match(/../g).map(h => { const v = parseInt(h, 16); return Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  const INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF'];
  const color = el => {
    if (!el) return null;
    const rgb = xAt(el, 'rgb'), th = xAt(el, 'theme'), ix = xAt(el, 'indexed');
    const hex = rgb && /^[0-9A-F]{8}$/i.test(rgb) ? rgb.slice(2) : th != null && scheme.length ? themeHex(+th) : ix != null ? INDEXED[+ix % 8] ?? INDEXED[+ix - 8] : null;
    return hex && xAt(el, 'tint') ? tint(hex, +xAt(el, 'tint')) : hex;
  };
  const fontsX = xKids(xKid(st, 'fonts'), 'font').map(f => ({ b: !!xKid(f, 'b') && xAt(xKid(f, 'b'), 'val') !== '0', i: !!xKid(f, 'i') && xAt(xKid(f, 'i'), 'val') !== '0', u: !!xKid(f, 'u'),
    sz: +xAt(xKid(f, 'sz'), 'val') || 11, font: xAt(xKid(f, 'name'), 'val') || 'Calibri', color: color(xKid(f, 'color')) }));
  const fills = xKids(xKid(st, 'fills'), 'fill').map(f => { const p = xKid(f, 'patternFill'); return p && xAt(p, 'patternType') === 'solid' ? color(xKid(p, 'fgColor')) : null; });
  const bordersX = xKids(xKid(st, 'borders'), 'border').map(b => Object.fromEntries(['left', 'right', 'top', 'bottom'].map(s => { const e = xKid(b, s), k = xAt(e, 'style'); return [s, k && k !== 'none' ? { w: /thick/.test(k) ? 1.5 : /medium/.test(k) ? 1 : .5, color: color(xKid(e, 'color')) || '000000' } : null]; })));
  const fmts = new Map(xKids(xKid(st, 'numFmts'), 'numFmt').map(n => [+xAt(n, 'numFmtId'), xAt(n, 'formatCode')]));
  const BUILTIN = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'hh:mm', 21: 'hh:mm:ss', 22: 'dd/mm/yyyy hh:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;(#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;(#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 49: '@' };
  const xfs = xKids(xKid(st, 'cellXfs'), 'xf').map(x => { const al = xKid(x, 'alignment'); return { fmt: fmts.get(+xAt(x, 'numFmtId')) ?? BUILTIN[+xAt(x, 'numFmtId')] ?? 'General', font: fontsX[+xAt(x, 'fontId') || 0] || fontsX[0] || { sz: 11, font: 'Calibri' },
    fill: fills[+xAt(x, 'fillId') || 0], border: bordersX[+xAt(x, 'borderId') || 0], h: xAt(al, 'horizontal'), v: xAt(al, 'vertical') || 'bottom', wrap: xAt(al, 'wrapText') === '1' || xAt(al, 'wrapText') === 'true', indent: +xAt(al, 'indent') || 0 }; });
  const MONTHS = fr ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const group = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, fr ? ' ' : ',');
  // valeur affichée selon le format de la case (sous-ensemble des formats Excel : nombres, monnaies, %, dates, heures)
  const show = (v, code) => {
    if (typeof v !== 'number') return v;
    const sec = code.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    let c = (v < 0 && sec[1] ? sec[1] : v === 0 && sec[2] ? sec[2] : sec[0]).replace(/\[(?!\$)[^\]]*\]/g, '');
    if (v < 0 && sec[1]) v = -v;
    const lit = c.replace(/"[^"]*"|\\./g, '');
    if (c === 'General' || c === '@' || !c) { const s = Number.isInteger(v) ? String(v) : String(+v.toPrecision(10)); return fr ? s.replace('.', ',') : s; }
    if (/[dmyhs]/i.test(lit) && !/[0#]/.test(lit)) { // date ou heure
      const d = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.round(v * 864e5)), p2 = n => String(n).padStart(2, '0');
      const hasH = /h/i.test(lit), ampm = /AM\/PM/i.test(c);
      return c.replace(/"([^"]*)"|\\(.)|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM/gi, (t, q, e, off, str) => {
        if (q != null) return q; if (e != null) return e;
        const T = t.toLowerCase(), H = d.getUTCHours();
        if (T === 'yyyy') return d.getUTCFullYear(); if (T === 'yy') return p2(d.getUTCFullYear() % 100);
        if (T === 'mmmm') return MONTHS[d.getUTCMonth()]; if (T === 'mmm') return MONTHS[d.getUTCMonth()].slice(0, 3);
        if (T === 'mm' || T === 'm') { const minute = hasH && (/h[^dmy]*$/i.test(str.slice(0, off)) || /^[^dmy]*s/i.test(str.slice(off + t.length))); return minute ? p2(d.getUTCMinutes()) : T === 'mm' ? p2(d.getUTCMonth() + 1) : d.getUTCMonth() + 1; }
        if (T === 'dddd' || T === 'ddd') { const n = new Intl.DateTimeFormat(fr ? 'fr' : 'en', { weekday: T === 'dddd' ? 'long' : 'short', timeZone: 'UTC' }).format(d); return n; }
        if (T === 'dd') return p2(d.getUTCDate()); if (T === 'd') return d.getUTCDate();
        if (T === 'hh') return p2(ampm ? (H % 12 || 12) : H); if (T === 'h') return ampm ? (H % 12 || 12) : H;
        if (T === 'ss') return p2(d.getUTCSeconds()); if (T === 's') return d.getUTCSeconds();
        if (T === 'am/pm') return H < 12 ? 'AM' : 'PM';
        return t;
      });
    }
    const pct = /%/.test(lit), x = pct ? v * 100 : v, m = /[0#,]+(?:\.[0#]+)?/.exec(lit.replace(/[$€£]/g, '')), pat = m ? m[0] : '0';
    const dec = (pat.split('.')[1] || '').length, s = Math.abs(x).toFixed(dec), [ip, dp] = s.split('.');
    const num = (/,/.test(pat) ? group(ip) : ip) + (dec ? (fr ? ',' : '.') + dp : '');
    let out = '', done = false;
    for (const t of c.match(/"[^"]*"|\\.|\[\$[^\]]*\]|[0#?,.]+|_.|\*.|./g) || []) {
      if (t[0] === '"') out += t.slice(1, -1); else if (t[0] === '\\') out += t[1]; else if (t.startsWith('[$')) out += t.slice(2, -1).split('-')[0];
      else if (/^[0#?,.]+$/.test(t) && t !== '.' && t !== ',') { if (!done) out += num; done = true; } else if (t[0] === '_') out += ' '; else if (t[0] === '*') ; else if (t !== '.' && t !== ',') out += t;
    }
    return (x < 0 && !sec[1] ? '-' : '') + (done ? out : num);
  };
  const ref = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); return m && { c: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r: +m[2] - 1 }; };
  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontCache = {}, fontFor = async f => { const key = fontKeyFor(f.font), font = await pdfFont(pdf, { key, bold: f.b, italic: f.i }, fontCache); font.rKey = key; return font; };
  for (const sh of xKids(xKid(wb, 'sheets'), 'sheet')) {
    if (xAt(sh, 'state') === 'hidden' || xAt(sh, 'state') === 'veryHidden') continue;
    const ws = xml(wbRels[xAt(sh, 'id')]);
    if (!ws) continue;
    const fmtPr = xKid(ws, 'sheetFormatPr'), defW = +(xAt(fmtPr, 'defaultColWidth') || (+(xAt(fmtPr, 'baseColWidth') || 8) + 1.14)), defH = +(xAt(fmtPr, 'defaultRowHeight') || 15);
    const colW = [], rowH = [], cells = new Map(), hidden = { c: new Set(), r: new Set() };
    for (const c of xKids(xKid(ws, 'cols'), 'col')) for (let k = +xAt(c, 'min') - 1; k < +xAt(c, 'max') && k < 16384; k++) { colW[k] = +xAt(c, 'width'); if (xAt(c, 'hidden') === '1') hidden.c.add(k); }
    let maxR = -1, maxC = -1;
    for (const row of xKids(xKid(ws, 'sheetData'), 'row')) {
      const r = +xAt(row, 'r') - 1;
      if (xAt(row, 'ht')) rowH[r] = +xAt(row, 'ht');
      if (xAt(row, 'hidden') === '1') hidden.r.add(r);
      for (const c of xKids(row, 'c')) {
        const p = ref(xAt(c, 'r')), t = xAt(c, 't'), v = xKid(c, 'v')?.textContent, x = xfs[+xAt(c, 's') || 0] || xfs[0] || { fmt: 'General', font: { sz: 11, font: 'Calibri' }, border: {} };
        if (!p) continue;
        let value = t === 's' ? strings[+v] : t === 'inlineStr' ? xDeep(c, 't').map(e => e.textContent).join('') : t === 'b' ? (v === '1' ? (fr ? 'VRAI' : 'TRUE') : (fr ? 'FAUX' : 'FALSE')) : t === 'str' || t === 'e' ? v : v != null && v !== '' ? +v : null;
        if (value == null && !x.fill && !Object.values(x.border || {}).some(Boolean)) continue;
        cells.set(p.r * 16384 + p.c, { ...p, value, x, text: value == null ? '' : show(value, x.fmt) });
        if (value != null || x.fill || Object.values(x.border || {}).some(Boolean)) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); }
      }
    }
    if (maxR < 0) continue;
    const merges = xKids(xKid(ws, 'mergeCells'), 'mergeCell').map(m => { const [a, b] = xAt(m, 'ref').split(':').map(ref); return { a, b }; }).filter(m => m.a && m.b);
    const inMerge = (r, c) => merges.find(m => r >= m.a.r && r <= m.b.r && c >= m.a.c && c <= m.b.c);
    // largeur Excel (en caractères) → points ; hauteur déjà en points
    const cw = k => hidden.c.has(k) ? 0 : Math.round((colW[k] ?? defW) * 7) * .75, rh = k => hidden.r.has(k) ? 0 : (rowH[k] ?? defH);
    const xs = [0]; for (let k = 0; k <= maxC; k++) xs.push(xs[k] + cw(k));
    const setup = xKid(ws, 'pageSetup'), pm = xKid(ws, 'pageMargins'), inch = (a, d) => (+(xAt(pm, a) ?? d)) * 72;
    const ML = inch('left', .7), MR = inch('right', .7), MT = inch('top', .75), MB = inch('bottom', .75);
    const wide = xAt(setup, 'orientation') === 'landscape' || xs.at(-1) > 595 - ML - MR, PW = wide ? 842 : 595, PH = wide ? 595 : 842;
    const k = Math.min(1, (PW - ML - MR) / xs.at(-1)), grid = xAt(xKid(ws, 'printOptions'), 'gridLines') === '1' || xAt(xKid(ws, 'printOptions'), 'gridLines') === 'true';
    let page = null, y = 0;
    const newPage = () => { page = pdf.addPage([PW, PH]); y = MT; };
    newPage();
    for (let r = 0; r <= maxR; r++) {
      const h = rh(r) * k;
      if (!h) continue;
      if (y + h > PH - MB && y > MT) newPage();
      for (let c = 0; c <= maxC; c++) {
        const m = inMerge(r, c);
        if (m && (m.a.r !== r || m.a.c !== c)) continue; // couverte par une case fusionnée
        const cell = cells.get(r * 16384 + c), x0 = ML + xs[c] * k;
        const w = (m ? xs[m.b.c + 1] - xs[c] : cw(c)) * k, hh = m ? Array.from({ length: m.b.r - r + 1 }, (_, j) => rh(r + j)).reduce((a, b) => a + b, 0) * k : h;
        if (!w) continue;
        const Y = PH - y;
        if (grid) page.drawRectangle({ x: x0, y: Y - hh, width: w, height: hh, borderColor: PDFLib.rgb(.8, .8, .8), borderWidth: .3 });
        if (!cell) continue;
        const x = cell.x;
        if (x.fill) page.drawRectangle({ x: x0, y: Y - hh, width: w, height: hh, color: pdfColor(x.fill) });
        const b = x.border || {}, line = (s, ax, ay, bx, by) => s && page.drawLine({ start: { x: ax, y: ay }, end: { x: bx, y: by }, thickness: s.w, color: pdfColor(s.color) });
        line(b.top, x0, Y, x0 + w, Y); line(b.bottom, x0, Y - hh, x0 + w, Y - hh); line(b.left, x0, Y, x0, Y - hh); line(b.right, x0 + w, Y, x0 + w, Y - hh);
        if (!cell.text) continue;
        const f = await fontFor(x.font), size = x.font.sz * k, pad = 2 * k + x.indent * 9 * k, num = typeof cell.value === 'number';
        const al = x.h === 'general' || !x.h ? (num ? 'right' : 'left') : x.h === 'centerContinuous' ? 'center' : x.h;
        // texte trop long : il déborde sur les cases vides voisines, sinon il est coupé (un nombre devient ###, comme dans Excel)
        let room = w;
        if (!x.wrap && !m && al === 'left') for (let j = c + 1; j <= maxC + 20 && !cells.get(r * 16384 + j)?.text && !inMerge(r, j); j++) room += cw(j) * k;
        let lines = [String(cell.text)];
        if (x.wrap) { lines = []; for (const para of String(cell.text).split('\n')) { let cur = ''; for (const wd of para.split(/(\s+)/)) { if (cur && f.widthOfTextAtSize(cleanText(cur + wd), size) > w - 2 * pad && wd.trim()) { lines.push(cur.trimEnd()); cur = wd.trimStart(); } else cur += wd; } lines.push(cur); } }
        else if (f.widthOfTextAtSize(cleanText(lines[0]), size) > room - 2 * pad) {
          if (num) lines = ['#'.repeat(Math.max(1, Math.floor((w - 2 * pad) / f.widthOfTextAtSize('#', size))))];
          else { let s = lines[0]; while (s && f.widthOfTextAtSize(cleanText(s), size) > room - 2 * pad) s = s.slice(0, -1); lines = [s]; }
        }
        const m2 = fontMetric(f), lh = (m2.asc + m2.desc) * size, th = lh * lines.length;
        let ty = x.v === 'top' ? Y - pad - m2.asc * size : x.v === 'center' ? Y - (hh - th) / 2 - m2.asc * size : Y - hh + pad + m2.desc * size + lh * (lines.length - 1);
        for (const t of lines) {
          const tw2 = f.widthOfTextAtSize(cleanText(t), size), tx = al === 'right' ? x0 + w - pad - tw2 : al === 'center' ? x0 + (w - tw2) / 2 : x0 + pad;
          try { page.drawText(cleanText(t), { x: tx, y: ty, size, font: f, color: pdfColor(x.font.color || '000000') }); } catch {}
          if (x.font.u) page.drawLine({ start: { x: tx, y: ty - size * .12 }, end: { x: tx + tw2, y: ty - size * .12 }, thickness: Math.max(.4, size / 18), color: pdfColor(x.font.color || '000000') });
          ty -= lh;
        }
      }
      y += h;
    }
  }
  if (!pdf.getPageCount()) throw new Error('classeur vide');
  return pdf.save();
}
