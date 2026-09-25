// Rature · Outils, sélection, barre d'options
const HINTS = {
  text: 'Clique pour écrire · Entrée : nouvelle ligne · Échap : terminer · poignée bleue : largeur du paragraphe',
  edit: 'Clique sur un texte du PDF pour le corriger · vide-le pour le supprimer',
  stamp: 'Choisis un symbole ou une mention, puis clique à l\'endroit voulu',
  highlight: 'Fais glisser sur le texte à surligner',
  draw: 'Dessine à main levée',
  rect: 'Clique et fais glisser pour tracer un rectangle',
  link: 'Trace la zone cliquable, puis indique une adresse web ou un numéro de page',
  ellipse: 'Clique et fais glisser pour tracer un cercle',
  line: 'Clique et fais glisser pour tracer un trait',
  arrow: 'Fais glisser du départ vers la pointe de la flèche',
  note: 'Clique pour coller une note',
  field: 'Trace la zone du champ : il sera remplissable dans le PDF téléchargé',
  redact: 'Fais glisser sur ce qui doit disparaître : effacé définitivement au téléchargement',
  move: 'Clic : sélectionner · Maj+clic ou cadre : plusieurs · flèches : ajuster · Alt : sans aimantation',
  crop: 'Trace la zone de la page à garder · Échap : annuler',
};
const KEYS = { t: 'text', e: 'edit', s: 'stamp', h: 'highlight', d: 'draw', r: 'rect', c: 'ellipse', l: 'line', a: 'arrow', k: 'link', n: 'note', f: 'field', x: 'redact', v: 'move' };
const SHAPES = ['rect', 'ellipse', 'line', 'arrow', 'link'];
// Contexte d'un élément = liste d'options affichées pour lui dans la barre
const ctxOf = it => it.orig ? 'edit' : it.note ? 'note' : it.frame ? 'seal' : ({ mark: 'stamp', hl: 'highlight', ink: 'draw' })[it.type] || it.type;
const TEXT_STAMPS = { date: () => today(), lu: () => tr('Lu et approuvé'), bon: () => tr('Bon pour accord'), fait: () => tr('Fait à  le {d}', { d: today() }) };

function setTool(t) {
  tool = t;
  document.body.dataset.tool = t;
  document.querySelectorAll('#tools button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (SHAPES.includes(t)) { // le bouton « Formes » prend l'icône de la dernière forme choisie
    const sb = $('shapebtn');
    sb.dataset.t = t;
    sb.firstElementChild.replaceWith(document.querySelector(`.flyout [data-t=${t}] svg`).cloneNode(true));
    sb.classList.add('on');
  }
  select(null);
  // consigne en 2 temps : l'outil choisi, puis quoi faire sur la page
  const tb = document.querySelector(`#tools [data-t=${t}][data-tip]`), name = tb?.querySelector('span')?.textContent || tb?.dataset.tip.split(' · ')[0];
  $('hint').innerHTML = (name ? `<em>1</em>${esc(tr('Outil'))} <b>${esc(name)}</b><em>2</em>` : '') + `${esc(tr(HINTS[t]))}<i></i><kbd>?</kbd> ${esc(tr('raccourcis'))}`;
  prefsChanged();
}
$('tools').onclick = e => {
  const b = e.target.closest('button');
  if (b?.dataset.a === 'image') return pages.length ? $('imgfile').click() : toast("Ouvre d'abord un PDF.", 'error');
  if (b?.dataset.a === 'sign') { // pas de signature : on la crée ; sinon on montre où elles sont
    if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
    if (!$('siglist').children.length) return $('signew').click();
    const side = document.querySelector('.side.right');
    document.body.classList.add('show-right');
    side.classList.remove('flash'); void side.offsetWidth; side.classList.add('flash');
    return toast('Clique sur ta signature pour la poser sur la page.');
  }
  if (b?.dataset.t) { setTool(b.dataset.t); b.blur(); }
};

function updateProps() {
  const c = current ? ctxOf(current) : tool;
  let any = false;
  document.querySelectorAll('#props .prop').forEach(p => {
    const f = p.dataset.for.split(' ');
    p.hidden = !(f.includes(c) || (f.includes('sel') && selection.length));
    any ||= !p.hidden;
  });
  $('fldoptsbox').hidden = $('fldkind').value !== 'list';
  $('props').hidden = !any;
}

// Sélection : un ou plusieurs éléments ; le dernier choisi (« current ») affiche ses réglages
function select(it, additive = false) {
  if (!additive) { selection.forEach(s => s.el?.classList.remove('sel')); selection = []; }
  if (it) {
    if (additive && selection.includes(it)) { it.el.classList.remove('sel'); selection = selection.filter(s => s !== it); }
    else if (!selection.includes(it)) { selection.push(it); it.el.classList.add('sel'); }
  }
  current = selection.at(-1) || null;
  reflect();
}
function reflect() {
  const it = current;
  if (it) {
    if (it.color) showColor(it.color);
    if (it.type === 'text' || it.type === 'mark') $('size').value = Math.round(it.size * 2) / 2;
    if (['ink', 'rect', 'ellipse', 'line', 'arrow'].includes(it.type)) $('width').value = it.w;
    if (it.type === 'text') showFont(it.font);
    if (it.type === 'mark') showKind(it.kind);
    if (it.type === 'rect' || it.type === 'ellipse') $('fill').classList.toggle('on', !!it.fill);
    if (it.type === 'link') $('linkto').value = it.url || (it.page ? String(it.page) : '');
    if (it.type === 'field') { $('fldkind').value = it.fkind; $('fldname').value = it.name; $('fldopts').value = (it.opts || []).join(', '); }
    $('rot').value = Math.round(it.rot || 0);
    $('opacity').value = Math.round((it.op ?? 1) * 100);
  } else showColor(tool === 'highlight' ? hlColor : penColor);
  updateProps();
}
const snap = it => ({ color: it.color, size: it.size, w: it.w, kind: it.kind, fill: it.fill, rot: it.rot, op: it.op,
                      fkind: it.fkind, name: it.name, opts: it.opts && [...it.opts], font: it.font && { ...it.font }, segs: it.segs && structuredClone(it.segs) });
function restoreProps(it, s) {
  const { segs, ...rest } = s;
  Object.assign(it, rest, { font: s.font && { ...s.font } });
  if (segs) setText(it, segs); else draw(it);
  if (it === current) reflect();
}
// Police d'une ligne mixte : gras / italique sur la partie sélectionnée (ou toute la ligne) ; autre police : toute la ligne
function richFont(it) {
  const nf = readFont(it.font), bold = $('bold').classList.contains('on'), italic = $('italic').classList.contains('on');
  if ($('font').value !== 'orig') styleRich(it, () => nf);
  else styleRich(it, f => f.local ? { ...f, bold, italic, touched: f.touched || bold !== !!f.bold || italic !== !!f.italic } : { ...f, bold, italic });
  it.font = it.segs[0].f;
}
const PROP_NAMES = { color: 'Couleur', size: 'Taille', width: 'Épaisseur', font: 'Police', kind: 'Symbole', fill: 'Remplissage', rot: 'Rotation', op: 'Opacité', field: 'Champ' };
const PROP_OK = {
  color: it => !['img', 'redact', 'field', 'link'].includes(it.type),
  size: it => it.type === 'text' || it.type === 'mark',
  width: it => ['ink', 'rect', 'ellipse', 'line', 'arrow'].includes(it.type),
  font: it => it.type === 'text',
  kind: it => it.type === 'mark' && !TEXT_STAMPS[stampKind],
  fill: it => it.type === 'rect' || it.type === 'ellipse',
  rot: it => (it.type === 'text' && !it.orig) || it.type === 'img',
  op: it => !['redact', 'field', 'link'].includes(it.type),
  field: it => it.type === 'field',
};
function applyProps(kind) {
  group(() => selection.filter(PROP_OK[kind]).forEach(it => {
    const b = snap(it);
    if (kind === 'color') it.color = $('color').value;
    if (kind === 'size') it.size = +$('size').value;
    if (kind === 'width') it.w = +$('width').value;
    if (kind === 'font') { if (it.rich) richFont(it); else it.font = readFont(it.font); }
    if (kind === 'kind') it.kind = stampKind;
    if (kind === 'fill') it.fill = $('fill').classList.contains('on');
    if (kind === 'rot') it.rot = ((+$('rot').value % 360) + 540) % 360 - 180;
    if (kind === 'op') it.op = +$('opacity').value / 100;
    if (kind === 'field') Object.assign(it, readField());
    draw(it);
    const a = snap(it);
    if (!it.fresh) record(() => restoreProps(it, b), () => restoreProps(it, a), tr('{p} · {x}', { p: tr(PROP_NAMES[kind] || 'Réglage'), x: tr(itemName(it)) }));
  }));
  prefsChanged();
}

function showColor(c) {
  $('color').value = c;
  let preset = false;
  document.querySelectorAll('#swatches .sw[data-c]').forEach(s => preset = s.classList.toggle('on', s.dataset.c === c) || preset);
  document.querySelector('#swatches .custom').classList.toggle('on', !preset);
}
function setColor(c) {
  showColor(c);
  if ((current ? ctxOf(current) : tool) === 'highlight') hlColor = c; else penColor = c;
  applyProps('color');
}
const keepFocus = e => e.preventDefault(); // garde le curseur dans le texte en cours
$('swatches').onpointerdown = e => { if (e.target.dataset.c) keepFocus(e); };
$('swatches').onclick = e => { if (e.target.dataset.c) setColor(e.target.dataset.c); };
$('color').onchange = e => { addFavColor(e.target.value); setColor(e.target.value); };
document.querySelectorAll('.stepper button').forEach(b => {
  b.onpointerdown = keepFocus;
  b.onclick = () => {
    const i = $(b.dataset.target);
    i.value = clamp(Math.round((+i.value + +b.dataset.step) * 10) / 10, +i.min, +i.max);
    applyProps(b.dataset.target);
  };
});
$('size').onchange = () => applyProps('size');
$('width').onchange = () => applyProps('width');
$('rot').onchange = () => applyProps('rot');
$('fill').onclick = () => { $('fill').classList.toggle('on'); applyProps('fill'); };
// Opacité : aperçu en direct pendant le glissement, une seule étape d'annulation au lâcher
$('opacity').oninput = () => selection.filter(PROP_OK.op).forEach(it => { it._op0 ??= it.op ?? 1; it.op = +$('opacity').value / 100; draw(it); });
$('opacity').onchange = () => group(() => selection.filter(PROP_OK.op).forEach(it => {
  const b = it._op0 ?? it.op ?? 1, a = it.op;
  delete it._op0;
  if (b !== a) record(() => { it.op = b; draw(it); if (it === current) reflect(); }, () => { it.op = a; draw(it); if (it === current) reflect(); });
}));

function showFont(f) {
  f = normFont(f);
  const o = $('font').options[0];
  o.hidden = !f.local;
  o.textContent = f.local ? f.family || tr("Police d'origine") : tr("Police d'origine");
  $('font').value = f.local ? 'orig' : f.key;
  $('bold').classList.toggle('on', !!f.bold);
  $('italic').classList.toggle('on', !!f.italic);
}
function readFont(prev) {
  const v = $('font').value, bold = $('bold').classList.contains('on'), italic = $('italic').classList.contains('on');
  if (v === 'orig' && prev?.local) return { ...prev, bold, italic, touched: prev.touched || bold !== !!prev.bold || italic !== !!prev.italic };
  return { key: v === 'orig' ? normFont(prev).key : v, bold, italic };
}
$('font').onchange = () => applyProps('font');
for (const id of ['bold', 'italic']) {
  $(id).onpointerdown = keepFocus;
  $(id).onclick = () => { $(id).classList.toggle('on'); applyProps('font'); };
}
function showKind(k) { document.querySelectorAll('#kinds button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); }
$('kinds').onclick = e => { const k = e.target.closest('button')?.dataset.k; if (!k) return; stampKind = k; showKind(k); applyProps('kind'); };
$('allpages').onclick = () => copyToAllPages([...selection]);

// Champs de formulaire créés : type, nom, choix d'une liste
function readField() {
  const opts = $('fldopts').value.split(',').map(s => s.trim()).filter(Boolean);
  return { fkind: $('fldkind').value, name: $('fldname').value.trim() || tr('Champ'), opts: opts.length ? opts : [tr('Choix 1'), tr('Choix 2')] };
}
$('fldkind').onchange = () => { updateProps(); applyProps('field'); };
$('fldname').onchange = () => applyProps('field');
$('fldopts').onchange = () => applyProps('field');
