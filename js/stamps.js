// Rature · Tampons personnalisés : texte encadré (« PAYÉ », « REÇU LE {date} »…) ou image d'un tampon d'entreprise
const STAMPS0 = [
  { id: 's1', text: 'PAYÉ', color: '#c62828', frame: 'rect' },
  { id: 's2', text: 'REÇU LE {date}', color: '#1d3fbf', frame: 'round' },
  { id: 's3', text: 'COPIE CONFORME', color: '#1d3fbf', frame: 'double' },
];
let stamps = STAMPS0;
try { stamps = JSON.parse(localStorage.stamps || 'null') || STAMPS0; } catch {}
const saveStamps = () => { try { localStorage.stamps = JSON.stringify(stamps); } catch { toast('Ce navigateur refuse de mémoriser les tampons.', 'error'); } };
// les tampons proposés d'office suivent la langue ; ceux créés par l'utilisateur gardent son texte
const stampText = s => (STAMPS0.some(d => d.id === s.id && d.text === s.text) ? tr(s.text) : s.text).replaceAll('{date}', today());

function renderStamps() {
  $('stamplist').replaceChildren(...stamps.map((s, i) => {
    const d = document.createElement('div');
    d.className = 'thumb stampcard';
    d.draggable = true;
    d.title = tr('Glisse-moi sur le document, ou clique pour me poser sur la page affichée');
    d.innerHTML = (s.src ? `<img src="${s.src}" alt="">` : `<span class="seal-prev frame-${s.frame}" style="color:${s.color};border-color:${s.color}">${esc(stampText(s))}</span>`)
      + (s.src ? `<button class="mv" title="${esc(tr('Ranger dans les signatures'))}" aria-label="${esc(tr('Ranger dans les signatures'))}"><svg class="i" viewBox="0 0 24 24"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button>` : '')
      + `<button class="del" title="${esc(tr('Supprimer'))}"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    d.ondragstart = e => { e.dataTransfer.setData('text/plain', 'stamp:' + s.id); document.body.dataset.drag = s.src ? 'stamp' : 'textstamp'; };
    d.ondragend = () => delete document.body.dataset.drag;
    d.onclick = e => {
      if (e.target.closest('.mv')) return moveMark('stamp:' + s.id);
      if (!e.target.closest('.del')) { document.body.classList.remove('show-right'); return placeStamp(s.id); }
      const [gone] = stamps.splice(i, 1);
      saveStamps(); renderStamps();
      toast('Tampon supprimé', '', { label: 'Annuler', fn: () => { stamps.splice(i, 0, gone); saveStamps(); renderStamps(); } });
    };
    return d;
  }));
}
renderStamps();

// Rangée au mauvais endroit : une signature devient un tampon en image, et inversement (glisser d'une liste à l'autre, ou bouton ⇄)
function moveMark(d, quiet) {
  let back;
  if (d.startsWith('sig:')) {
    const [s] = sigs.splice(+d.slice(4), 1);
    if (!s) return;
    const id = 's' + Date.now();
    stamps.push({ id, src: s.src, ratio: s.ratio });
    back = 'stamp:' + id;
  } else {
    const i = stamps.findIndex(t => t.id === d.slice(6));
    if (i < 0) return;
    if (!stamps[i].src) return toast('Seul un tampon en image peut devenir une signature.', 'error');
    const [s] = stamps.splice(i, 1);
    sigs.push({ src: s.src, ratio: s.ratio });
    back = 'sig:' + (sigs.length - 1);
  }
  saveSigs(); saveStamps(); renderSigs(); renderStamps();
  if (!quiet) toast(back.startsWith('sig:') ? 'Rangé dans les signatures' : 'Rangé dans les tampons', '', { label: 'Annuler', fn: () => moveMark(back, true) });
}
for (const [ids, from] of [[['siglist', 'sigempty'], 'stamp:'], [['stamplist'], 'sig:']]) for (const id of ids) {
  const z = $(id);
  z.ondragover = e => { if (document.body.dataset.drag === from.slice(0, -1)) e.preventDefault(); };
  z.ondrop = e => {
    const d = e.dataTransfer.getData('text/plain');
    if (!d.startsWith(from)) return;
    e.preventDefault(); e.stopPropagation();
    delete document.body.dataset.drag;
    moveMark(d);
  };
}

function placeStamp(id, pg, x, y) {
  const s = stamps.find(t => t.id === id);
  pg ||= visiblePage();
  if (!s || !pg) return toast("Ouvre d'abord un PDF.", 'error');
  if (x == null) {
    const r = pg.wrap.getBoundingClientRect(), box = $('pages').getBoundingClientRect();
    x = pg.vp.width / 2;
    y = clamp((box.top + box.height / 2 - r.top) / Z, 60, pg.vp.height - 60);
  }
  if (s.src) return placeImage(s, pg, x, y, 110);
  const it = add({ type: 'text', pg, x, y, text: stampText(s), frame: s.frame, color: s.color, size: 15, rot: -4, font: { key: 'arial', bold: true } }, false);
  moveBy(it, -it.input.offsetWidth / 2, -it.input.offsetHeight / 2); // centré sur le point choisi
  recAdd(it);
}

// ---------- Création ----------
let stampDraft = { color: '#c62828', frame: 'rect' };
function stampPreview() {
  const p = $('stampprev');
  p.textContent = ($('stamptext').value.trim() || tr('PAYÉ')).replaceAll('{date}', today());
  p.className = 'seal-prev frame-' + stampDraft.frame;
  Object.assign(p.style, { color: stampDraft.color, borderColor: stampDraft.color });
}
$('stampnew').onclick = () => { $('stamptext').value = ''; stampPreview(); $('stampdlg').showModal(); $('stamptext').focus(); };
$('stamptext').oninput = stampPreview;
$('stampchips').onclick = e => { const b = e.target.closest('button'); if (b) { $('stamptext').value = tr(b.dataset.s); stampPreview(); } };
$('stampcolors').onclick = e => {
  const c = e.target.dataset.c;
  if (!c) return;
  stampDraft.color = c;
  document.querySelectorAll('#stampcolors .sw').forEach(s => s.classList.toggle('on', s === e.target));
  stampPreview();
};
$('stampframe').onclick = e => {
  const f = e.target.dataset.f;
  if (!f) return;
  stampDraft.frame = f;
  document.querySelectorAll('#stampframe button').forEach(b => b.classList.toggle('on', b === e.target));
  stampPreview();
};
$('stampcancel').onclick = () => $('stampdlg').close();
$('stampok').onclick = () => {
  const text = $('stamptext').value.trim() || tr('PAYÉ');
  stamps.push({ id: 's' + Date.now(), text, ...stampDraft });
  saveStamps(); renderStamps();
  $('stampdlg').close();
  track('tampon');
  toast('Tampon créé : clique dessus pour le poser');
};
// Tampon d'entreprise en image, fond déjà transparent (photo recadrée dans l'écran de numérisation, ou reçue du téléphone)
function saveImageStamp(canvas) {
  const c = trimCanvas(canvas);
  if (!c) return toast('Aucun tampon trouvé dans ce cadre.', 'error');
  stamps.push({ id: 's' + Date.now(), src: c.toDataURL('image/png'), ratio: c.width / c.height });
  saveStamps(); renderStamps();
  $('stampdlg').close();
  track('tampon', { depuis: 'photo' });
  toast('Tampon créé : clique dessus pour le poser');
}
