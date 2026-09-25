// Plume · Outils de pages : vue en grille, page blanche, duplication, recadrage, découpage
// ---------- Vue en grille ----------
let gridSel = new Set(), gridLast = null;
const gridIO = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting && !e.target.done) { e.target.done = true; renderThumb(e.target.pg, e.target.querySelector('canvas'), 170); }
}, { root: $('gridcards'), rootMargin: '400px 0px' });
function openGrid() {
  if (!pages.length) return;
  select(null);
  gridSel = new Set([visiblePage()]);
  $('grid').hidden = false;
  renderGrid();
}
function closeGrid() { $('grid').hidden = true; gridIO.disconnect(); }
function renderGrid() {
  gridIO.disconnect();
  $('gridcards').replaceChildren(...pages.map((pg, i) => {
    const c = document.createElement('div');
    c.className = 'gcard' + (gridSel.has(pg) ? ' on' : '');
    c.draggable = true;
    c.pg = pg;
    c.innerHTML = `<canvas></canvas><span>${i + 1}</span>`;
    c.onclick = e => {
      if (e.shiftKey && gridLast && pages.includes(gridLast)) { // plage
        const [a, b] = [pages.indexOf(gridLast), i].sort((x, y) => x - y);
        pages.slice(a, b + 1).forEach(p => gridSel.add(p));
      } else if (e.ctrlKey || e.metaKey) gridSel.has(pg) ? gridSel.delete(pg) : gridSel.add(pg);
      else gridSel = new Set([pg]);
      gridLast = pg;
      renderGridSel();
    };
    c.ondblclick = () => { closeGrid(); $('pages').scrollTo({ top: pg.wrap.offsetTop - 70 }); };
    c.oncontextmenu = e => { e.preventDefault(); openPageMenu(e, pg); };
    c.ondragstart = e => e.dataTransfer.setData('text/plain', 'gpage:' + pages.indexOf(pg));
    c.ondragover = e => { e.preventDefault(); const r = c.getBoundingClientRect(); c.classList.toggle('before', e.clientX < r.left + r.width / 2); c.classList.toggle('after', e.clientX >= r.left + r.width / 2); };
    c.ondragleave = () => c.classList.remove('before', 'after');
    c.ondrop = e => {
      const d = e.dataTransfer.getData('text/plain'), after = c.classList.contains('after');
      c.classList.remove('before', 'after');
      if (!d.startsWith('gpage:')) return;
      e.preventDefault();
      const from = +d.slice(6);
      let to = pages.indexOf(pg) + (after ? 1 : 0);
      if (from < to) to--;
      if (to !== from) { movePage(from, to); record(() => movePage(to, from), () => movePage(from, to)); }
    };
    gridIO.observe(c);
    return c;
  }));
  renderGridSel();
}
function renderGridSel() {
  gridSel = new Set([...gridSel].filter(p => pages.includes(p)));
  document.querySelectorAll('.gcard').forEach(c => c.classList.toggle('on', gridSel.has(c.pg)));
  $('gridsel').textContent = plural(gridSel.size, '{n} page sélectionnée', '{n} pages sélectionnées');
  document.querySelectorAll('.gridacts button').forEach(b => b.disabled = !gridSel.size && b.dataset.g !== 'blank');
}
const gridList = () => pages.filter(p => gridSel.has(p));
$('gridclose').onclick = closeGrid;
document.querySelector('.gridacts').onclick = async e => {
  const g = e.target.closest('button')?.dataset.g, list = gridList();
  if (!g) return;
  if (g === 'left' || g === 'right') group(() => list.forEach(p => userRotate(p, g === 'left' ? -90 : 90)));
  if (g === 'dup') for (const p of list.reverse()) await duplicatePage(p);
  if (g === 'blank') insertBlank(list.at(-1) || pages.at(-1));
  if (g === 'extract') openExport(list);
  if (g === 'png') for (const p of list) await pageToImage(p);
  if (g === 'del') {
    if (list.length >= pages.length) return toast('Un document doit garder au moins une page.', 'error');
    const removed = list.map(p => ({ p, ...removePage(p) })); // chaque index est relevé après les suppressions précédentes
    record(() => { for (const r of [...removed].reverse()) pages.splice(r.i, 0, r.p); mount(); removed.forEach(r => r.its.forEach(it => attach(it))); },
           () => removed.forEach(r => removePage(r.p)));
    gridSel.clear();
    toast(plural(list.length, '{n} page supprimée', '{n} pages supprimées'), '', { label: 'Annuler', fn: undo });
  }
  renderGridSel();
};

// ---------- Page blanche, duplication ----------
async function insertBlank(after) {
  const [w, h] = after ? [after.vp.width, after.vp.height] : [595.28, 841.89];
  const pdf = await PDFLib.PDFDocument.create();
  pdf.addPage([w, h]);
  const at = after ? pages.indexOf(after) + 1 : pages.length;
  const made = await openSources([{ bytes: await pdf.save(), name: tr('Page blanche') + '.pdf', made: true }], 'append', true, at);
  if (made) toast('Page blanche ajoutée');
}
// Copie éditable (éléments recopiés) ; si la page porte des corrections ou du caviardage, copie figée pour ne rien dupliquer deux fois
async function duplicatePage(pg) {
  const baked = items.some(i => i.pg === pg && (i.orig || i.type === 'redact'));
  let bytes;
  if (baked) bytes = await build([pg]);
  else {
    const s = await PDFLib.PDFDocument.load(pg.src.bytes), d = await PDFLib.PDFDocument.create();
    d.addPage((await d.copyPages(s, [pg.index]))[0]);
    bytes = await d.save();
  }
  const [np] = await addSource(bytes, pg.src.name);
  if (!baked) Object.assign(np, { rot: pg.rot, crop: pg.crop, ocr: pg.ocr && structuredClone(pg.ocr) });
  const at = pages.indexOf(pg) + 1;
  await showEntries([np], at);
  group(() => {
    record(() => removePage(np), () => { pages.splice(at, 0, np); mount(); });
    if (!baked) items.filter(i => i.pg === pg).forEach(i => recAdd(add(cloneItem(i, np), false)));
  });
  select(null);
  toast(baked ? 'Page dupliquée (copie figée, avec ses corrections)' : 'Page dupliquée');
}

// ---------- Recadrage ----------
function startCrop(pg) {
  if (!pg) return;
  setTool('crop');
  $('pages').scrollTo({ top: pg.wrap.offsetTop - 70, behavior: 'smooth' });
  toast('Trace la zone de la page à garder');
}
async function cropPage(pg, [x0, y0, x1, y1], marquee) {
  const ok = await ask({ title: 'Recadrer la page', text: 'Garder seulement la zone sélectionnée ? Le reste sera masqué dans le PDF (annulable).',
                         buttons: [{ label: 'Annuler', value: false }, { label: 'Recadrer', value: true, primary: true }] });
  marquee.remove();
  setTool('move');
  if (!ok) return;
  const a = pg.vp.convertToPdfPoint(x0, y0), b = pg.vp.convertToPdfPoint(x1, y1);
  userCrop(pg, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
}
function userCrop(pg, crop) {
  if (items.some(i => i.pg === pg && i.orig)) return toast('Recadre la page avant de corriger son texte.', 'error');
  const before = pg.crop || null;
  applyCrop(pg, crop);
  record(() => applyCrop(pg, before), () => applyCrop(pg, crop));
}
// Le recadrage ne fait que décaler l'origine : éléments et texte reconnu sont décalés d'autant
async function applyCrop(pg, crop) {
  const old = pg.vp, nv = viewportOf({ ...pg, crop }), [dx, dy] = nv.convertToViewportPoint(...old.convertToPdfPoint(0, 0));
  pg.crop = crop;
  pg.ocr?.forEach(r => { r.x += dx; r.top += dy; if (r.box) r.box = [r.box[0] + dx, r.box[1] + dy, r.box[2] + dx, r.box[3] + dy]; });
  items.filter(i => i.pg === pg).forEach(i => { i.x += dx; i.y += dy; if ('x2' in i) { i.x2 += dx; i.y2 += dy; } });
  await rebuildPage(pg);
}

// ---------- Découper en plusieurs fichiers ----------
function openSplit() {
  if (!pages.length) return;
  $('splitmsg').textContent = '';
  $('splitdlg').showModal();
}
$('splitcancel').onclick = () => $('splitdlg').close();
$('splitat').onfocus = () => document.querySelector('input[name=splitmode][value=at]').checked = true;
$('splitn').onfocus = () => document.querySelector('input[name=splitmode][value=every]').checked = true;
$('splitgo').onclick = async () => {
  const mode = document.querySelector('input[name=splitmode]:checked').value, n = pages.length, chunks = [];
  if (mode === 'each') pages.forEach((_, i) => chunks.push([i]));
  if (mode === 'every') { const k = Math.max(1, +$('splitn').value | 0); for (let i = 0; i < n; i += k) chunks.push([...Array(Math.min(k, n - i)).keys()].map(j => i + j)); }
  if (mode === 'at') {
    const cuts = [...new Set($('splitat').value.split(/[,; ]+/).map(Number).filter(v => v > 1 && v <= n))].sort((a, b) => a - b);
    if (!cuts.length) return $('splitmsg').textContent = tr('Indique des numéros de page entre 2 et {n}, par exemple 3, 7.', { n });
    [1, ...cuts, n + 1].reduce((a, b) => { chunks.push([...Array(b - a).keys()].map(j => a - 1 + j)); return b; });
  }
  const btn = $('splitgo');
  btn.classList.add('busy');
  try {
    const localFonts = await askLocalFonts(), base = baseName($('expname').value || 'document'), files = [];
    for (const [k, idx] of chunks.entries()) {
      $('splitmsg').textContent = tr('Fichier {k} sur {n}…', { k: k + 1, n: chunks.length });
      const range = idx.length > 1 ? `${idx[0] + 1}-${idx.at(-1) + 1}` : `${idx[0] + 1}`;
      files.push({ name: `${base} - ${tr('p.')} ${range}.pdf`, data: await build(idx.map(i => pages[i]), localFonts) });
    }
    download(makeZip(files), `${base} - ${tr('découpé')}.zip`);
    $('splitdlg').close();
    toast(plural(files.length, '{n} fichier créé', '{n} fichiers créés'));
  } catch (e) { console.error(e); $('splitmsg').textContent = tr('Erreur : {m}', { m: e.message }); }
  finally { btn.classList.remove('busy'); }
};
