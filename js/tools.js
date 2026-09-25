// Rature · Outils sur le document entier : extraire le texte, comparer deux PDF, traitement par lot
// ---------- Extraire le texte ----------
const scannedPages = () => pages.filter(p => p.wrap.classList.contains('scan') && !p.ocr);
async function openText() {
  if (!pages.length) return;
  $('textout').value = tr('Lecture du document…');
  $('textdlg').showModal();
  try {
    const mupdf = await getMupdf(), doc = mupdf.Document.openDocument(await build(pages), 'application/pdf'), parts = [];
    for (let i = 0; i < doc.countPages(); i++) parts.push(`— ${tr('Page {n}', { n: i + 1 })} —\n${doc.loadPage(i).toStructuredText().asText().trim()}`);
    $('textout').value = parts.join('\n\n');
    const scan = scannedPages().length;
    $('textinfo').textContent = scan ? plural(scan, '{n} page scannée n\'a pas encore de texte : lance la reconnaissance pour l\'inclure.', '{n} pages scannées n\'ont pas encore de texte : lance la reconnaissance pour les inclure.') : tr('Texte de toutes les pages, avec tes modifications.');
    $('textocr').hidden = !scan;
  } catch (e) { console.error(e); $('textout').value = tr('Erreur : {m}', { m: e.message }); }
}
$('textclose').onclick = () => $('textdlg').close();
$('textcopy').onclick = async () => { try { await navigator.clipboard.writeText($('textout').value); toast('Texte copié'); } catch { $('textout').select(); document.execCommand('copy'); toast('Texte copié'); } };
$('textdl').onclick = () => download(new Blob([$('textout').value], { type: 'text/plain;charset=utf-8' }), baseName($('expname').value || 'document') + '.txt');
$('textocr').onclick = async () => {
  const btn = $('textocr'), list = scannedPages();
  btn.classList.add('busy');
  for (const [k, pg] of list.entries()) { btn.lastChild.textContent = tr('Page {k} sur {n}…', { k: k + 1, n: list.length }); await ocrPage(pg, undefined, true); }
  btn.classList.remove('busy');
  btn.lastChild.textContent = tr('Reconnaître les pages scannées');
  openText();
};

// ---------- Comparer deux PDF ----------
function openCompare() {
  if (!pages.length) return;
  $('cmpout').innerHTML = '';
  $('cmpname').textContent = '';
  $('cmpdlg').showModal();
}
$('cmpclose').onclick = () => $('cmpdlg').close();
// Différence ligne à ligne (plus longue sous-suite commune) : [[' ' | '-' | '+', ligne], …]
function diffLines(a, b) {
  const n = a.length, m = b.length, T = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; }
    else if (T[i + 1][j] >= T[i][j + 1]) out.push(['-', a[i++]]);
    else out.push(['+', b[j++]]);
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}
// Image des différences : page A en gris clair, pixels qui changent en rouge
function visualDiff(mupdf, pa, pb) {
  const W = 420, ra = pa.getBounds(), k = W / (ra[2] - ra[0]);
  const A = pa.toPixmap(mupdf.Matrix.scale(k, k), mupdf.ColorSpace.DeviceRGB, false, true), w = A.getWidth(), h = A.getHeight(), a = A.getPixels();
  const rb = pb.getBounds(), B = pb.toPixmap(mupdf.Matrix.scale(w / (rb[2] - rb[0]), h / (rb[3] - rb[1])), mupdf.ColorSpace.DeviceRGB, false, true), b = B.getPixels(), bw = B.getWidth();
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d'), id = g.createImageData(w, h), o = id.data;
  let diff = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, j = (y * bw + x) * 3, q = (y * w + x) * 4;
    const d = Math.abs(a[i] - (b[j] ?? 255)) + Math.abs(a[i + 1] - (b[j + 1] ?? 255)) + Math.abs(a[i + 2] - (b[j + 2] ?? 255));
    const l = 235 - (765 - a[i] - a[i + 1] - a[i + 2]) / 12;
    if (d > 90) { o[q] = 220; o[q + 1] = 40; o[q + 2] = 30; diff++; } else { o[q] = o[q + 1] = o[q + 2] = l; }
    o[q + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return { canvas: c, share: diff / (w * h) };
}
$('cmpfile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('cmpname').textContent = f.name;
  $('cmpout').innerHTML = `<p class="muted">${esc(tr('Comparaison en cours…'))}</p>`;
  try {
    let other = new Uint8Array(await f.arrayBuffer());
    if (isEncrypted(other)) other = await decrypt(other, f.name);
    const mupdf = await getMupdf(), A = mupdf.Document.openDocument(await build(pages), 'application/pdf'), B = mupdf.Document.openDocument(other, 'application/pdf');
    const n = Math.max(A.countPages(), B.countPages()), rows = [];
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const pa = i < A.countPages() && A.loadPage(i), pb = i < B.countPages() && B.loadPage(i);
      const lines = p => p ? p.toStructuredText().asText().split('\n').map(s => s.trim()).filter(Boolean) : [];
      const d = diffLines(lines(pa), lines(pb)), rem = d.filter(x => x[0] === '-').length, add = d.filter(x => x[0] === '+').length;
      const vis = pa && pb ? visualDiff(mupdf, pa, pb) : null, same = !rem && !add && (!vis || vis.share < .0005);
      if (!same) changed++;
      const status = !pa ? tr('page seulement dans l\'autre PDF') : !pb ? tr('page absente de l\'autre PDF')
        : same ? tr('identique') : [rem + add ? tr('{a} ligne(s) retirée(s), {b} ajoutée(s)', { a: rem, b: add }) : '', vis && vis.share >= .0005 ? tr('{p} % de la page change', { p: (vis.share * 100).toFixed(1) }) : ''].filter(Boolean).join(' · ');
      const row = document.createElement('details');
      row.className = 'cmprow' + (same ? ' same' : '');
      row.innerHTML = `<summary><b>${esc(tr('Page {n}', { n: i + 1 }))}</b> <span>${esc(status)}</span></summary><div class="cmpbody"><pre class="diff">${d.filter(x => x[0] !== ' ').map(([k, t]) => `<span class="${k === '-' ? 'del' : 'ins'}">${k} ${esc(t)}</span>`).join('\n') || esc(tr('Aucune différence dans le texte.'))}</pre></div>`;
      if (vis) row.querySelector('.cmpbody').append(vis.canvas);
      rows.push(row);
    }
    $('cmpout').innerHTML = `<p class="cmpsum">${esc(changed ? plural(changed, '{n} page différente', '{n} pages différentes') : tr('Les deux documents sont identiques.'))} <span class="muted">${esc(tr('Rouge : ce qui change à l\'image. « − » : seulement dans ton document, « + » : seulement dans l\'autre.'))}</span></p>`;
    $('cmpout').append(...rows);
    rows.find(r => !r.classList.contains('same'))?.setAttribute('open', '');
  } catch (err) {
    console.error(err);
    $('cmpout').innerHTML = `<p class="dlg-msg">${esc(err.message === 'annulé' ? tr('Comparaison annulée.') : tr('Impossible de lire ce PDF.'))}</p>`;
  }
};

// ---------- Traitement par lot ----------
let batchFiles = [];
function openBatch() {
  batchFiles = [];
  $('batchlist').textContent = '';
  $('batchmsg').textContent = '';
  $('batchdlg').showModal();
}
$('batchfiles').onchange = e => {
  batchFiles = [...e.target.files].filter(isPdf);
  e.target.value = '';
  $('batchlist').textContent = batchFiles.length ? plural(batchFiles.length, '{n} fichier choisi', '{n} fichiers choisis') : '';
};
$('batchpw').onchange = () => $('batchpwbox').hidden = !$('batchpw').checked;
$('batchcancel').onclick = () => $('batchdlg').close();
$('batchgo').onclick = async () => {
  const msg = t => $('batchmsg').textContent = t;
  if (!batchFiles.length) return msg(tr('Choisis d\'abord les PDF à traiter.'));
  const pw = $('batchpw').checked ? $('batchpass').value : '', compress = $('batchcompress').checked, a4 = $('batcha4').checked;
  if ($('batchpw').checked && (!pw || pw.includes(','))) return msg(tr('Choisis un mot de passe (sans virgule).'));
  const btn = $('batchgo'), keepDeco = deco, out = [], failed = [];
  btn.classList.add('busy');
  if (!$('batchdeco').checked) deco = { ...DECO0 }; // les réglages de mise en page ne s'appliquent que si la case est cochée
  try {
    for (const [k, f] of batchFiles.entries()) {
      msg(tr('Fichier {k} sur {n} : {name}', { k: k + 1, n: batchFiles.length, name: f.name }));
      try {
        let bytes = new Uint8Array(await f.arrayBuffer());
        if (isEncrypted(bytes)) bytes = await decrypt(bytes, f.name);
        const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise, src = { name: f.name, bytes, fields: {}, fields0: {} }, list = [];
        for (let i = 0; i < doc.numPages; i++) { const e = { src, index: i, rot: 0, pdfPage: await doc.getPage(i + 1) }; e.vp = viewportOf(e); list.push(e); }
        let res = await build(list);
        if (a4) res = await toA4(res);
        if (pw || compress) res = await finish(res, { pw, compress });
        out.push({ name: f.name, data: res });
      } catch (e) { console.error(e); failed.push(f.name); }
    }
    if (out.length) download(makeZip(out), tr('Rature - lot.zip'));
    msg(failed.length ? tr('Terminé. Impossible de traiter : {names}', { names: failed.join(', ') }) : plural(out.length, 'Terminé : {n} fichier traité.', 'Terminé : {n} fichiers traités.'));
  } finally {
    deco = keepDeco;
    btn.classList.remove('busy');
  }
};
