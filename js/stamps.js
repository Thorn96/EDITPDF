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
      + `<button class="del" title="${esc(tr('Supprimer'))}"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    d.ondragstart = e => e.dataTransfer.setData('text/plain', 'stamp:' + s.id);
    d.onclick = e => {
      if (!e.target.closest('.del')) { document.body.classList.remove('show-right'); return placeStamp(s.id); }
      const [gone] = stamps.splice(i, 1);
      saveStamps(); renderStamps();
      toast('Tampon supprimé', '', { label: 'Annuler', fn: () => { stamps.splice(i, 0, gone); saveStamps(); renderStamps(); } });
    };
    return d;
  }));
}
renderStamps();

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
  toast('Tampon créé : clique dessus pour le poser');
};
// Tampon d'entreprise photographié : fond blanc retiré, comme pour une signature
$('stampimg').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const im = await normImage(f, 1200);
  const c = im && trimCanvas(transparentize(im.canvas));
  if (!c) return toast('Image illisible.', 'error');
  stamps.push({ id: 's' + Date.now(), src: c.toDataURL('image/png'), ratio: c.width / c.height });
  saveStamps(); renderStamps();
  $('stampdlg').close();
  toast('Tampon créé : clique dessus pour le poser');
};
