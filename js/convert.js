// Plume · Conversion : PDF → Word (.docx), Word (.docx) → PDF
// ponytail: le texte, ses paragraphes et le gras/italique/taille ; pas les images, tableaux complexes ni mises en page en colonnes

const xmlEsc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

// ---------- PDF → Word ----------
// Le document tel qu'il sera téléchargé (corrections comprises), lu par MuPDF bloc par bloc : un bloc = un paragraphe
async function exportDocx() {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  toast('Préparation du fichier Word…');
  try {
    const out = await build(pages), mu = await getMupdf(), doc = mu.Document.openDocument(out, 'application/pdf'), n = doc.countPages(), body = [];
    let size0;
    for (let i = 0; i < n; i++) {
      const page = doc.loadPage(i), [x0, y0, x1, y1] = page.getBounds();
      size0 ??= [Math.round((x1 - x0) * 20), Math.round((y1 - y0) * 20)];
      // paragraphes refaits ligne par ligne : nouveau paragraphe après un blanc, un changement de retrait ou de style,
      // ou une ligne qui s'arrête avant la marge (retour voulu) ; deux textes sur la même ligne sont séparés d'une tabulation
      const lines = JSON.parse(page.toStructuredText('preserve-whitespace').asJSON()).blocks.flatMap(b => b.lines || []).filter(l => l.text.trim());
      const right = Math.max(...lines.map(l => l.bbox.x + l.bbox.w)), style = l => [Math.round(l.font.size), l.font.weight, l.font.style].join();
      const paras = [];
      let cur, prev;
      for (const l of lines) {
        const t = l.text.trim(), b = l.bbox;
        if (prev && Math.abs(b.y - prev.bbox.y) < prev.bbox.h * .5) { cur.text += '\t' + t; prev = l; continue; }
        const soft = prev && b.y - (prev.bbox.y + prev.bbox.h) < prev.bbox.h * .6 && Math.abs(b.x - cur.x) < 3 && style(l) === style(prev)
          && prev.bbox.x + prev.bbox.w > right - 3 * prev.font.size;
        if (soft) cur.text += (/-$/.test(cur.text) ? '' : ' ') + t;
        else paras.push(cur = { text: t, font: l.font, x: b.x, w: b.w });
        prev = l;
      }
      for (const q of paras) {
        const f = q.font, name = (f.name || '').replace(/^[A-Z]{6}\+/, '').split(/[-,]/)[0];
        const bold = /bold/i.test(f.weight || '') || /bold|black|heavy/i.test(f.name || ''), italic = /italic/i.test(f.style || '') || /italic|oblique/i.test(f.name || '');
        const center = Math.abs(q.x + q.w / 2 - (x0 + x1) / 2) < 12 && q.w < (x1 - x0) * .6 && q.x > x0 + (x1 - x0) * .2;
        const rPr = `<w:rPr>${name ? `<w:rFonts w:ascii="${xmlEsc(name)}" w:hAnsi="${xmlEsc(name)}"/>` : ''}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:sz w:val="${Math.round((f.size || 11) * 2)}"/></w:rPr>`;
        body.push(`<w:p><w:pPr>${center ? '<w:jc w:val="center"/>' : ''}<w:spacing w:after="120"/></w:pPr><w:r>${rPr}${q.text.split('\t').map(s => `<w:t xml:space="preserve">${xmlEsc(s)}</w:t>`).join('<w:tab/>')}</w:r></w:p>`);
      }
      if (i < n - 1) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
    const [W, H] = size0 || [11906, 16838], enc = new TextEncoder();
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`],
    ].map(([name, s]) => ({ name, data: enc.encode(s) }));
    const name = ($('expname').value.trim() || baseName($('fname').textContent) || 'document').replace(/\.pdf$/i, '') + '.docx';
    download(makeZip(files), name);
    toast(tr('{name} téléchargé ✓', { name }));
  } catch (e) { console.error(e); toast(tr('Conversion impossible : {m}', { m: e.message }), 'error'); }
}

// ---------- Word → PDF ----------
const isDocx = f => /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// Archive ZIP (fichier .docx) : nom → contenu, décompressé par le navigateur
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
async function docxToPdf(bytes) {
  const files = await unzip(bytes), dec = new TextDecoder(), W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const read = n => files.has(n) ? new DOMParser().parseFromString(dec.decode(files.get(n)), 'application/xml') : null;
  const doc = read('word/document.xml');
  if (!doc) throw new Error('document Word illisible');
  const kids = (el, tag) => [...(el?.children || [])].filter(c => c.namespaceURI === W_NS && c.localName === tag);
  const kid = (el, tag) => kids(el, tag)[0], val = el => el?.getAttributeNS(W_NS, 'val') ?? el?.getAttribute('w:val');
  const on = el => el && !/^(0|false|none)$/.test(val(el) || '');
  // réglages par défaut du document (taille, police)
  const defs = read('word/styles.xml')?.getElementsByTagNameNS(W_NS, 'rPrDefault')[0];
  const size0 = +val(defs?.getElementsByTagNameNS(W_NS, 'sz')[0]) / 2 || 11, font0 = defs?.getElementsByTagNameNS(W_NS, 'rFonts')[0]?.getAttributeNS(W_NS, 'ascii') || 'Calibri';
  const sect = doc.getElementsByTagNameNS(W_NS, 'sectPr')[0], pgSz = kid(sect, 'pgSz'), pgMar = kid(sect, 'pgMar'), tw = (el, a, d) => (+el?.getAttributeNS(W_NS, a) || d) / 20;
  const PW = tw(pgSz, 'w', 11906), PH = tw(pgSz, 'h', 16838), ML = tw(pgMar, 'left', 1417), MR = tw(pgMar, 'right', 1417), MT = tw(pgMar, 'top', 1417), MB = tw(pgMar, 'bottom', 1417);
  // paragraphes : [{ runs: [{ t, bold, italic, size, font }], align, heading, bullet, pageBefore }]
  const paras = [];
  const para = (p, extra = {}) => {
    const pPr = kid(p, 'pPr'), style = val(kid(pPr, 'pStyle')) || '', h = /heading|titre|title/i.exec(style) && (+style.replace(/\D/g, '') || 1);
    const q = { runs: [], align: val(kid(pPr, 'jc')) || '', heading: h, bullet: !!kid(pPr, 'numPr'), ...extra };
    for (const r of p.getElementsByTagNameNS(W_NS, 'r')) {
      const rPr = kid(r, 'rPr'), st = { bold: on(kid(rPr, 'b')) || !!h, italic: on(kid(rPr, 'i')), size: +val(kid(rPr, 'sz')) / 2 || (h ? size0 * (h === 1 ? 1.6 : h === 2 ? 1.3 : 1.15) : size0),
                                       font: kid(rPr, 'rFonts')?.getAttributeNS(W_NS, 'ascii') || font0 };
      for (const c of r.children) {
        if (c.localName === 't') q.runs.push({ ...st, t: c.textContent });
        else if (c.localName === 'tab') q.runs.push({ ...st, t: '    ' });
        else if (c.localName === 'br' && val(c) !== 'page' && c.getAttributeNS(W_NS, 'type') !== 'page') q.runs.push({ ...st, t: '\n' });
        else if (c.localName === 'br') { paras.push({ ...q }); q.runs = []; paras.push({ runs: [], pageBreak: true }); } // saut de page
      }
    }
    paras.push(q);
  };
  for (const el of kid(doc.documentElement, 'body').children) {
    if (el.localName === 'p') para(el);
    else if (el.localName === 'tbl') for (const tr of kids(el, 'tr')) { // tableau : une ligne par rangée, cellules séparées
      const row = { runs: [], align: '' };
      kids(tr, 'tc').forEach((tc, i) => { const tmp = paras.length; kids(tc, 'p').forEach(p => para(p)); const cell = paras.splice(tmp).flatMap(x => x.runs); if (i) row.runs.push({ ...(cell[0] || { size: size0, font: font0 }), t: '   |   ' }); row.runs.push(...cell); });
      paras.push(row);
    }
  }
  // mise en page
  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const cache = {}, fontFor = r => pdfFont(pdf, { key: fontKeyFor(r.font), bold: r.bold, italic: r.italic }, cache);
  let page = pdf.addPage([PW, PH]), y = PH - MT;
  const newPage = () => { page = pdf.addPage([PW, PH]); y = PH - MT; };
  for (const q of paras) {
    if (q.pageBreak) { newPage(); continue; }
    const words = []; // morceaux sans espace, avec leur style ; null = retour à la ligne forcé
    if (q.bullet) words.push({ t: '•  ', r: q.runs[0] || { size: size0, font: font0 } });
    for (const r of q.runs) for (const [i, part] of r.t.split('\n').entries()) {
      if (i) words.push(null);
      for (const w of part.split(/(\s+)/)) if (w) words.push({ t: w, r });
    }
    const size = Math.max(size0, ...q.runs.map(r => r.size)), lh = size * 1.25, maxW = PW - ML - MR, lines = [[]];
    let w = 0;
    for (const x of words) {
      if (!x) { lines.push([]); w = 0; continue; }
      const f = await fontFor(x.r), ww = f.widthOfTextAtSize(x.t.replace(/[^\u0000-￿]/g, '?'), x.r.size);
      if (w + ww > maxW && lines.at(-1).length && !/^\s+$/.test(x.t)) { lines.push([]); w = 0; }
      if (!lines.at(-1).length && /^\s+$/.test(x.t)) continue;
      lines.at(-1).push({ ...x, f, w: ww });
      w += ww;
    }
    if (q.heading) y -= size * .4;
    for (const [li, ln] of lines.entries()) {
      while (ln.length && /^\s+$/.test(ln.at(-1).t)) ln.pop();
      if (y - lh < MB) newPage();
      y -= lh;
      const tot = ln.reduce((t, x) => t + x.w, 0), gaps = ln.filter(x => /^\s+$/.test(x.t)).length, last = li === lines.length - 1;
      let x = ML + (q.align === 'center' ? (maxW - tot) / 2 : q.align === 'right' ? maxW - tot : 0);
      const extra = q.align === 'both' && !last && gaps ? (maxW - tot) / gaps : 0;
      for (const s of ln) {
        if (/^\s+$/.test(s.t)) { x += s.w + extra; continue; }
        try { page.drawText(s.t, { x, y: y + size * .22, size: s.r.size, font: s.f }); } catch {}
        x += s.w;
      }
    }
    y -= Math.min(10, size * .7); // espace après le paragraphe
  }
  return pdf.save();
}
