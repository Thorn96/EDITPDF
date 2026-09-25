// Plume · Polices intégrées aux PDF
// Polices libres ayant les mêmes largeurs de lettres que les polices courantes des PDF (Arial, Times, Calibri…) :
// un texte corrigé garde exactement la même longueur. Fichiers dans fonts/pdf, chargés seulement si besoin.
const FONTS = {
  arial:   { label: 'Arial / Helvetica', file: 'LiberationSans' },
  times:   { label: 'Times New Roman', file: 'LiberationSerif', serif: true },
  courier: { label: 'Courier New', file: 'LiberationMono', mono: true },
  calibri: { label: 'Calibri', file: 'Carlito' },
  cambria: { label: 'Cambria', file: 'Caladea', serif: true },
  segoe:   { label: 'Segoe UI', file: 'Selawik', noItalic: true },
  verdana: { label: 'Verdana', file: 'DejaVuSans' },
  lato:    { label: 'Lato', file: 'Lato' },
};
// Nom de police trouvé dans un PDF → police libre équivalente (du plus précis au plus général)
const FONT_MATCH = [
  ['calibri', /calibri|carlito/i], ['cambria', /cambria|caladea/i], ['segoe', /segoe|selawik/i],
  ['verdana', /verdana|tahoma|dejavu|vera/i], ['lato', /lato/i], ['courier', /courier|mono|consol|cousine/i],
  ['times', /times|tinos|georgia|garamond|antiqua|palatino|minion|roman|serif/i], ['arial', /arial|helvetica|arimo|sans/i],
];
const fontKeyFor = (name = '', generic) =>
  FONT_MATCH.find(([, re]) => re.test(name))?.[0] || ({ serif: 'times', monospace: 'courier' })[generic] || 'arial';
// Anciennes sauvegardes : { generic } au lieu de { key }
const normFont = f => {
  if (!f) return { key: 'arial' };
  if (f.key && FONTS[f.key]) return f;
  return { ...f, key: f.local ? fontKeyFor(f.family || f.ps, f.generic) : fontKeyFor('', f.generic) };
};
const fontStyle = (key, bold, italic) => {
  const it = italic && !FONTS[key].noItalic;
  return (bold ? 'Bold' : '') + (it ? 'Italic' : '') || 'Regular';
};
const cssFamily = f => {
  f = normFont(f);
  const d = FONTS[f.key], generic = d.mono ? 'monospace' : d.serif ? 'serif' : 'sans-serif';
  return (f.local && f.family ? `"${f.family}", ` : '') + `"Plume ${f.key}", ${generic}`;
};

const fontFiles = {};
const fontData = (key, style) => fontFiles[key + style] ??= fetch(here(`fonts/pdf/${FONTS[key].file}-${style}.ttf`))
  .then(r => { if (!r.ok) throw new Error('police ' + key); return r.arrayBuffer(); })
  .catch(e => { delete fontFiles[key + style]; throw e; });

// fontkit (qui découpe les polices pour pdf-lib) casse celles dont des glyphes ont une longueur impaire, comme Carlito :
// il écrit une table d'index courte, qui exige des longueurs paires. On complète ces glyphes d'un octet nul.
let subsetPatched = false;
function patchSubset(bytes) {
  if (subsetPatched) return;
  subsetPatched = true;
  try {
    const proto = Object.getPrototypeOf(fontkit.create(new Uint8Array(bytes)).createSubset()), add = proto._addGlyph;
    if (typeof add !== 'function') return;
    proto._addGlyph = function (gid) {
      const r = add.call(this, gid), i = this.glyf.length - 1, b = this.glyf[i];
      if (b && b.length % 2) {
        const p = b.constructor.alloc ? b.constructor.alloc(b.length + 1) : new Uint8Array(b.length + 1);
        p.set(b);
        this.glyf[i] = p;
        this.offset++;
      }
      return r;
    };
  } catch (e) { console.warn('Correctif fontkit', e); }
}
// Sans ligatures : pdf-lib les déclarerait mal (« a�estons » au copier-coller), et l'écran n'en affiche pas non plus
const EMBED = { subset: true, features: { liga: false, clig: false, dlig: false, rlig: false } };
const embedTTF = (pdf, bytes) => { patchSubset(bytes); return pdf.embedFont(bytes, EMBED); };
// Police la plus fidèle : la vraie si elle est installée sur l'ordinateur (Chrome/Edge),
// sinon son équivalent libre embarqué ; en tout dernier recours (hors ligne) une police standard du PDF
async function pdfFont(pdf, f, cache, localFonts = []) {
  f = normFont(f);
  const style = fontStyle(f.key, f.bold, f.italic), key = [f.local && f.family, f.ps, f.key, style, f.touched].join('|');
  if (cache[key]) return cache[key];
  if (f.local) {
    const m = (!f.touched && localFonts.find(x => x.postscriptName === f.ps.replace(',', '-')))
      || localFonts.find(x => x.family === f.family && /bold|black|heavy|semibold/i.test(x.style) === !!f.bold && /italic|oblique/i.test(x.style) === !!f.italic);
    if (m) try { return cache[key] = await embedTTF(pdf, await (await m.blob()).arrayBuffer()); } catch {}
  }
  try { return cache[key] = await embedTTF(pdf, await fontData(f.key, style)); }
  catch {
    const d = FONTS[f.key], base = d.serif ? 'TimesRoman' : d.mono ? 'Courier' : 'Helvetica';
    return cache[key] = await pdf.embedFont(PDFLib.StandardFonts[base + (f.bold ? 'Bold' : '') + (f.italic ? (d.serif ? 'Italic' : 'Oblique') : '')]);
  }
}
// À l'écran, la police doit être chargée avant de mesurer le texte
function whenFontReady(css, redraw) {
  if (document.fonts.check(css)) return;
  document.fonts.load(css).then(redraw, () => {});
}

// ---------- Polices intégrées au PDF ----------
// Table ToUnicode d'une police : code → texte
function parseToUnicode(txt) {
  const map = new Map(), u16 = h => h.length < 4 ? (h ? String.fromCharCode(parseInt(h, 16)) : '')
    : String.fromCharCode(...(h.match(/.{4}/g) || []).map(x => parseInt(x, 16)));
  for (const [, body] of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const [, c, u] of body.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]*)>/gi)) map.set(parseInt(c, 16), u16(u));
  for (const [, body] of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const [, a, b, dst] of body.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<[0-9a-f]*>|\[[^\]]*\])/gi)) {
      const lo = parseInt(a, 16), hi = Math.min(parseInt(b, 16), lo + 65535);
      if (dst[0] === '[') [...dst.matchAll(/<([0-9a-f]*)>/gi)].forEach(([, u], i) => map.set(lo + i, u16(u)));
      else { const s = u16(dst.slice(1, -1)); for (let c = lo; c <= hi; c++) map.set(c, s.slice(0, -1) + String.fromCharCode(s.charCodeAt(s.length - 1) + c - lo)); }
    }
  return map;
}
// Ce qu'on sait d'une police du PDF : codes → texte, largeurs, et son dessin (fontkit) pour comparer des glyphes.
// ponytail: polices Type0 en Identity-H et polices simples avec ToUnicode seulement (la quasi-totalité des PDF actuels)
function pdfFontInfo(ctx, dict) {
  const L = PDFLib, get = (d, k) => d && ctx.lookup(d.get(L.PDFName.of(k))), num = o => o?.asNumber?.();
  const sub = get(dict, 'Subtype')?.toString(), tu = get(dict, 'ToUnicode');
  if (!(tu instanceof L.PDFRawStream) || !/^\/(Type0|TrueType|Type1)$/.test(sub)) return null;
  let text;
  try { text = new TextDecoder('latin1').decode(L.decodePDFRawStream(tu).decode()); } catch { return null; }
  const name = (get(dict, 'BaseFont')?.toString() || '').slice(1).replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const f = { dict, text, name, family: name.replace(/^[A-Z]{6}\+/, ''), bytes: 1, map: parseToUnicode(text), w: new Map(), dw: 0 };
  let desc = dict;
  if (sub === '/Type0') {
    if (get(dict, 'Encoding')?.toString() !== '/Identity-H') return null;
    const arr = get(dict, 'DescendantFonts'), d = arr && ctx.lookup(arr.get(0));
    if (!d) return null;
    desc = d; f.bytes = 2; f.dw = (num(get(d, 'DW')) ?? 1000) / 1000;
    const a = get(d, 'W')?.asArray().map(x => ctx.lookup(x)) || [];
    for (let i = 0; i < a.length;) {
      const c = num(a[i]);
      if (a[i + 1] instanceof L.PDFArray) { a[i + 1].asArray().forEach((x, k) => f.w.set(c + k, num(ctx.lookup(x)) / 1000)); i += 2; }
      else { const v = num(a[i + 2]) / 1000; for (let k = c; k <= num(a[i + 1]) && k - c < 65536; k++) f.w.set(k, v); i += 3; }
    }
    const m = get(d, 'CIDToGIDMap');
    if (m instanceof L.PDFRawStream) try { const b = L.decodePDFRawStream(m).decode(); f.gid = c => b[2 * c] << 8 | b[2 * c + 1]; } catch {}
    f.gid ??= c => c;
  } else {
    const first = num(get(dict, 'FirstChar')) ?? 0;
    get(dict, 'Widths')?.asArray().forEach((x, k) => f.w.set(first + k, num(ctx.lookup(x)) / 1000));
    f.dw = (num(get(get(dict, 'FontDescriptor'), 'MissingWidth')) ?? 0) / 1000;
  }
  f.width = c => f.w.get(c) ?? f.dw;
  // dessin des glyphes : chargé seulement si on en a besoin
  f.program = () => {
    if (f.prog !== undefined) return f.prog;
    f.prog = null;
    try {
      const ff = get(get(desc, 'FontDescriptor'), 'FontFile2');
      if (ff && typeof fontkit !== 'undefined') f.prog = fontkit.create(L.decodePDFRawStream(ff).decode());
    } catch {}
    return f.prog;
  };
  f.glyph = c => {
    const p = f.program();
    if (!p) return null;
    try {
      const g = f.bytes === 2 ? p.getGlyph(f.gid(c)) : p.glyphForCodePoint(c).id ? p.glyphForCodePoint(c) : p.glyphForCodePoint(0xF000 + c);
      return g?.id ? g : null;
    } catch { return null; }
  };
  return f;
}
// Toutes les polices d'un document pdf-lib, par objet
function pdfFonts(pdf) {
  const out = [];
  for (const [ref, obj] of pdf.context.enumerateIndirectObjects())
    if (obj instanceof PDFLib.PDFDict && obj.get(PDFLib.PDFName.of('Type'))?.toString() === '/Font') {
      const f = pdfFontInfo(pdf.context, obj);
      if (f) { f.ref = ref; out.push(f); }
    }
  return out;
}

// Nom de police comparable entre pdf.js et le PDF : sans préfixe de sous-ensemble (« ABCDEF+ »), « Arial,Bold » = « Arial-Bold »
const famKey = s => (s || '').replace(/^[A-Z]{6}\+/, '').replace(/[,\s]+/g, '-').toLowerCase();
// Polices du PDF par famille, chacune avec sa table texte → code : pour réécrire un texte corrigé avec la police d'origine
function fontsByFamily(pdf) {
  const m = new Map();
  for (const f of pdfFonts(pdf)) {
    f.rev = new Map();
    for (const [c, s] of f.map) {
      const k = PRESENTATION.test(s) ? s.normalize('NFKC') : s, prev = f.rev.get(k);
      if (!k || k === '�' || !(f.width(c) > 0)) continue;
      if (prev == null || f.width(c) < f.width(prev)) f.rev.set(k, c); // en double : le glyphe normal plutôt qu'une ligature mal déclarée
    }
    const k = famKey(f.name);
    (m.get(k) ?? m.set(k, []).get(k)).push(f);
  }
  return m;
}

// ---------- Réparation des ligatures mal déclarées ----------
// Word (et d'autres) dessinent « ti », « tt », « ft »… d'un seul glyphe, que le PDF traduit souvent mal : « � », ou « t » seul.
// Résultat : « cau�on », « atestons ». On retrouve la bonne ligature par la largeur du glyphe (celle de ses lettres réunies),
// puis, si plusieurs conviennent, en comparant son dessin avec celui de ses lettres dans la même police.
const LIGATURES = ['fi', 'fl', 'ff', 'ffi', 'ffl', 'tt', 'ti', 'ft', 'tti', 'fft', 'fj', 'ffj', 'fb', 'ffb', 'fh', 'ffh', 'fk', 'ffk', 'tf', 'tz', 'st', 'ct', 'Th'];
const PRESENTATION = /[ﬀ-ﬆ]/; // ﬁ ﬂ ﬀ ﬃ ﬄ ﬅ ﬆ : notés comme un seul caractère
function glyphMask(parts, width) { // parts : [{ g: glyphe fontkit, x: position en em }] → pixels encrés
  const S = 48, c = Object.assign(document.createElement('canvas'), { width: Math.ceil(width * S) + 16, height: 80 }), cx = c.getContext('2d', { willReadFrequently: true });
  for (const { g, x } of parts) {
    const k = S / (g._font?.unitsPerEm || 1000);
    cx.setTransform(k, 0, 0, -k, 8 + x * S, 60);
    cx.fill(new Path2D(g.path.toSVG()));
  }
  const d = cx.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(d.length / 4);
  for (let i = 0; i < m.length; i++) m[i] = d[4 * i + 3] > 110;
  return { m, w: c.width };
}
function maskIoU(a, b) {
  let inter = 0, union = 0;
  const w = Math.max(a.w, b.w);
  for (let y = 0; y < 80; y++) for (let x = 0; x < w; x++) {
    const p = x < a.w && a.m[y * a.w + x], q = x < b.w && b.m[y * b.w + x];
    inter += p && q; union += p || q;
  }
  return union ? inter / union : 0;
}
function repairLigatures(fonts) {
  // par famille (Calibri, Calibri-Bold…) : largeur normale et glyphe de chaque lettre, et ligatures déjà présentes
  const fam = new Map();
  for (const f of fonts) {
    const F = fam.get(f.family) ?? fam.set(f.family, { w: new Map(), src: new Map(), has: new Set() }).get(f.family);
    for (const [c, s] of f.map) {
      const w = f.width(c);
      F.has.add(s.normalize('NFKC'));
      if ([...s].length === 1 && w > 0 && !(F.w.get(s) <= w)) { F.w.set(s, w); F.src.set(s, [f, c]); }
    }
  }
  let fixed = 0;
  for (const f of fonts) {
    const F = fam.get(f.family);
    for (const [c, s] of f.map) {
      const w = f.width(c), unknown = !s || s === '�';
      if (!(w > 0) || !(unknown || ([...s].length === 1 && F.w.get(s) && w > F.w.get(s) * 1.35 + .05))) continue;
      const cands = LIGATURES.map((l, i) => ({ l, i, lw: [...l].reduce((t, ch) => t + (F.w.get(ch) ?? NaN), 0) }))
        .filter(o => (unknown || o.l.startsWith(s)) && !F.has.has(o.l) && Math.abs(o.lw - w) / w < .12);
      if (!cands.length) continue;
      const g = f.glyph(c);
      if (g) { // comparaison des dessins : les lettres côte à côte, espacées pour occuper la largeur de la ligature
        const lig = glyphMask([{ g, x: 0 }], w);
        for (const o of cands) { // lettres plus ou moins resserrées : une ligature est souvent un peu plus étroite
          const gs = [...o.l].map(ch => { const [sf, sc] = F.src.get(ch); return [sf.glyph(sc), F.w.get(ch)]; });
          o.iou = gs.every(([g]) => g) ? Math.max(...[.9, .95, 1, 1.05].map(k => {
            let x = 0;
            return maskIoU(lig, glyphMask(gs.map(([g, gw]) => { const p = { g, x }; x += gw * k * w / o.lw; return p; }), w * 1.1));
          })) : 0;
        }
        cands.sort((a, b) => b.iou - a.iou);
        if (cands[0].iou < .6) continue;
      } else { // sans dessin : la plus proche en largeur, à égalité la plus courante
        cands.sort((a, b) => Math.abs(a.lw - w) / w + a.i * .01 - Math.abs(b.lw - w) / w - b.i * .01);
        if (Math.abs(cands[0].lw - w) / w > .06) continue;
      }
      f.map.set(c, cands[0].l);
      F.has.add(cands[0].l);
      f.fixed = (f.fixed || 0) + 1;
      fixed++;
    }
  }
  return fixed;
}
// Réécrit dans la table ToUnicode les codes réparés (et ﬁ → fi, pour copier-coller et chercher dans le PDF final)
function patchToUnicode(pdf, f) {
  const hex = c => c.toString(16).padStart(2 * f.bytes, '0').toUpperCase();
  const u16 = s => [...s].map(ch => ch.codePointAt(0)).flatMap(cp => cp < 0x10000 ? [cp] : [0xD800 + (cp - 0x10000 >> 10), 0xDC00 + (cp - 0x10000 & 1023)])
    .map(n => n.toString(16).padStart(4, '0').toUpperCase()).join('');
  let text = f.text;
  const extra = [];
  for (const [c, s0] of f.map) {
    const s = s0.normalize(PRESENTATION.test(s0) ? 'NFKC' : 'NFC'), old = f.orig.get(c);
    if (s === old) continue;
    const re = new RegExp(`<0*${c.toString(16)}>(\\s*)<[0-9a-f]*>`, 'i');
    let done = false;
    text = text.replace(/beginbfchar[\s\S]*?endbfchar/g, b => done ? b : b.replace(re, (_, sp) => { done = true; return `<${hex(c)}>${sp}<${u16(s)}>`; }));
    if (!done) extra.push(`<${hex(c)}> <${u16(s)}>`); // code donné par une plage : l'entrée ajoutée après la remplace
  }
  if (extra.length) text = text.replace(/endcmap/, `${extra.length} beginbfchar\n${extra.join('\n')}\nendbfchar\nendcmap`);
  f.dict.set(PDFLib.PDFName.of('ToUnicode'), pdf.context.register(pdf.context.flateStream(text)));
}
// À l'ouverture : PDF corrigé si des ligatures étaient illisibles, sinon le PDF tel quel
async function repairText(bytes) {
  // ponytail: lecture complète du fichier par pdf-lib (≈ 40 ms par Mo) ; au-delà de 12 Mo (surtout des images), on s'en passe
  if (bytes.length > 12e6) return bytes;
  try {
    const pdf = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true, parseSpeed: PDFLib.ParseSpeeds.Fastest });
    const fonts = pdfFonts(pdf);
    fonts.forEach(f => f.orig = new Map(f.map));
    if (!repairLigatures(fonts)) return bytes;
    fonts.filter(f => f.fixed).forEach(f => patchToUnicode(pdf, f));
    return await pdf.save({ useObjectStreams: false, objectsPerTick: Infinity });
  } catch (e) { console.warn('Réparation du texte impossible', e); return bytes; }
}

// Liste du sélecteur de police (chaque nom affiché dans sa police)
$('font').append(...Object.entries(FONTS).map(([k, d]) => Object.assign(new Option(d.label, k), { style: `font-family:"Plume ${k}"` })));
$('font').value = 'arial';
