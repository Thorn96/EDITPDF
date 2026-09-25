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

// Police la plus fidèle : la vraie si elle est installée sur l'ordinateur (Chrome/Edge),
// sinon son équivalent libre embarqué ; en tout dernier recours (hors ligne) une police standard du PDF
async function pdfFont(pdf, f, cache, localFonts = []) {
  f = normFont(f);
  const style = fontStyle(f.key, f.bold, f.italic), key = [f.local && f.family, f.ps, f.key, style, f.touched].join('|');
  if (cache[key]) return cache[key];
  if (f.local) {
    const m = (!f.touched && localFonts.find(x => x.postscriptName === f.ps.replace(',', '-')))
      || localFonts.find(x => x.family === f.family && /bold|black|heavy|semibold/i.test(x.style) === !!f.bold && /italic|oblique/i.test(x.style) === !!f.italic);
    if (m) try { return cache[key] = await pdf.embedFont(await (await m.blob()).arrayBuffer(), { subset: true }); } catch {}
  }
  try { return cache[key] = await pdf.embedFont(await fontData(f.key, style), { subset: true }); }
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

// Liste du sélecteur de police (chaque nom affiché dans sa police)
$('font').append(...Object.entries(FONTS).map(([k, d]) => Object.assign(new Option(d.label, k), { style: `font-family:"Plume ${k}"` })));
$('font').value = 'arial';
