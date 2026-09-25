// Plume · Éléments posés sur les pages, souris, texte d'origine
// ---------- Éléments posés sur les pages ----------
// it.el : l'élément dessiné ; it.host : ce qui est posé dans la page (it.el, ou le <svg> qui entoure une forme).
// Chaque élément a son propre calque : l'ordre des éléments (premier plan / arrière-plan) est le même à l'écran et dans le PDF.
const SVG_TAG = { rect: 'rect', hl: 'rect', redact: 'rect', ellipse: 'ellipse', line: 'line', arrow: 'path', mark: 'path', ink: 'path' };
const SVG_NS = 'http://www.w3.org/2000/svg';
function makeEl(it) {
  if (it.type === 'text') {
    it.el = document.createElement('div');
    it.el.className = 'box' + (it.note ? ' note' : '') + (it.frame ? ' seal frame-' + it.frame : '');
    const ta = it.input = document.createElement('textarea');
    ta.rows = 1;
    ta.value = it.text;
    ta.item = it;
    ta.spellcheck = !it.frame;
    ta.oninput = () => { it.text = ta.value; draw(it); changed(); };
    ta.onfocus = () => { it.before = it.text; if (!selection.includes(it) || selection.length > 1) select(it); };
    ta.onblur = () => endEdit(it);
    const g = document.createElement('span');
    g.className = 'grip';
    g.item = it;
    g.title = tr('Largeur du paragraphe (double-clic : automatique)');
    g.ondblclick = () => { const b = it.wrapW; if (b == null) return; setWrap(it, null); record(() => setWrap(it, b), () => setWrap(it, null)); };
    it.el.append(ta, g);
    it.host = it.el;
  } else if (it.type === 'img') {
    it.el = document.createElement('div');
    it.el.className = 'img';
    it.el.innerHTML = `<img src="${it.src}" alt="">`;
    it.el.style.aspectRatio = it.ratio; // largeur seule redimensionnable, proportions conservées
    it.host = it.el;
  } else if (it.type === 'field') { // champ de formulaire à créer dans le PDF
    it.el = document.createElement('div');
    it.el.className = 'fieldbox';
    it.el.innerHTML = '<span></span>';
    it.host = it.el;
  } else {
    it.host = document.createElementNS(SVG_NS, 'svg');
    it.host.classList.add('shape');
    it.el = document.createElementNS(SVG_NS, SVG_TAG[it.type]);
    it.el.classList.add(it.type);
    it.host.append(it.el);
  }
  it.el.item = it;
  it.el.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); openItemMenu(e, it); };
}
// Place le calque de l'élément dans la page selon son rang dans `items`
function placeHost(it) {
  const i = items.indexOf(it), next = items.slice(i + 1).find(x => x.pg === it.pg && x.host?.parentNode === it.pg.layer);
  next ? next.host.before(it.host) : it.pg.layer.append(it.host);
}
function attach(it, at = items.length) {
  if (!it.el) makeEl(it);
  it.span?.remove();
  items.splice(Math.min(at, items.length), 0, it);
  placeHost(it);
  draw(it);
}
function detach(it) {
  const i = items.indexOf(it);
  if (i < 0) return -1;
  if (selection.includes(it)) select(it, true); // la retire de la sélection
  items.splice(i, 1);
  it.host.remove();
  if (it.span) it.pg.layer.append(it.span); // texte d'origine de nouveau cliquable
  return i;
}
function add(it, focus = true) {
  it = { color: tool === 'highlight' ? hlColor : penColor, size: +$('size').value, w: +$('width').value, ...it };
  if (it.type === 'text' && !it.font) it.font = readFont(null);
  attach(it);
  select(it);
  if (it.type === 'text' && focus) it.input.focus(); // tout de suite : les premières touches ne doivent pas se perdre
  return it;
}
const recAdd = it => record(() => detach(it), () => attach(it));
function del(it) {
  if (it.lock) return toast('Élément verrouillé : déverrouille-le d\'abord (clic droit).', 'error');
  const i = detach(it);
  if (!it.fresh) record(() => attach(it, i), () => detach(it));
}
const delMany = list => group(() => [...list].filter(i => !i.lock).forEach(del));
function endEdit(it) {
  if (!items.includes(it)) return;
  if (it.fresh) {
    if (!it.text.trim()) return detach(it);
    it.fresh = false;
    return recAdd(it);
  }
  if (it.text !== it.before) { const b = it.before, a = it.text; record(() => setText(it, b), () => setText(it, a)); }
}
function setText(it, t) { it.text = it.input.value = t; draw(it); }
function setWrap(it, w) { it.wrapW = w; draw(it); }
function setWidth(it, w) { it.width = w; draw(it); }
function moveBy(it, dx, dy) {
  it.x += dx; it.y += dy;
  if ('x2' in it) { it.x2 += dx; it.y2 += dy; }
  draw(it);
}
function nudge(list, dx, dy) { // flèches : les appuis rapprochés comptent pour une seule étape d'annulation
  list = list.filter(i => !i.lock);
  list.forEach(i => moveBy(i, dx, dy));
  const last = past.at(-1), same = last?.nudge?.length === list.length && last.nudge.every((x, i) => x === list[i]);
  if (same && Date.now() - last.t < 1000) { last.dx += dx; last.dy += dy; last.t = Date.now(); return changed(); }
  const e = { nudge: [...list], dx, dy, t: Date.now() };
  e.undo = () => e.nudge.forEach(i => moveBy(i, -e.dx, -e.dy));
  e.redo = () => e.nudge.forEach(i => moveBy(i, e.dx, e.dy));
  past.push(e); future = []; changed();
}
// Premier plan / arrière-plan : change le rang dans `items` (ordre de dessin) et dans la page
function moveInStack(it, to) {
  items.splice(items.indexOf(it), 1);
  items.splice(to, 0, it);
  placeHost(it);
}
function userReorder(list, front) {
  const before = new Map(list.map(it => [it, items.indexOf(it)]));
  const apply = () => list.forEach(it => moveInStack(it, front ? items.length - 1 : 0));
  apply();
  record(() => [...before].sort((a, b) => a[1] - b[1]).forEach(([it, i]) => moveInStack(it, i)), apply);
}
function setLock(list, v) {
  const set = w => list.forEach(it => { it.lock = w; draw(it); });
  set(v);
  record(() => set(!v), () => set(v));
  toast(v ? 'Verrouillé : il ne bougera plus' : 'Déverrouillé');
}
// Copie d'un élément (sur la même page ou une autre : position proportionnelle à la taille de la page)
function cloneItem(it, pg = it.pg, dx = 0, dy = 0) {
  const { el, host, input, span, run, orig, bg, before, fresh, lock, pg: p0, ...rest } = it;
  const c = structuredClone(rest), kx = pg.vp.width / p0.vp.width, ky = pg.vp.height / p0.vp.height;
  c.pg = pg;
  c.x = c.x * kx + dx; c.y = c.y * ky + dy;
  if ('x2' in c) { c.x2 = c.x2 * kx + dx; c.y2 = c.y2 * ky + dy; }
  if (c.type === 'field') c.name = nextFieldName(c.name);
  return c;
}
function addClones(clones) {
  const made = group(() => clones.map(c => { const n = add(c, false); recAdd(n); return n; }));
  select(null);
  made.forEach(n => select(n, true));
  return made;
}
const duplicate = list => list.length && addClones(list.map(i => cloneItem(i, i.pg, 12, 12)));
function copyToAllPages(list) {
  if (!list.length || pages.length < 2) return toast('Il faut au moins deux pages.', 'error');
  group(() => list.forEach(it => pages.forEach(pg => { if (pg !== it.pg) recAdd(add(cloneItem(it, pg), false)); })));
  select(null);
  list.forEach(i => select(i, true));
  toast(plural(pages.length - 1, 'Copié sur {n} autre page', 'Copié sur {n} autres pages'));
}
function pasteItems(pg = visiblePage()) {
  if (!pg || !clip.length) return;
  const made = addClones(clip.map(c => cloneItem(c, pg, c.pg === pg ? 12 : 0, c.pg === pg ? 12 : 0)));
  clip = made.map(i => cloneItem(i)); // coller encore décale de nouveau
}
// Nom de champ de formulaire unique dans le document
function nextFieldName(base) {
  const names = new Set(items.filter(i => i.type === 'field').map(i => i.name));
  base = (base || tr('Champ')).replace(/ \d+$/, '');
  if (!names.has(base) && base !== tr('Champ')) return base;
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function markPath({ kind, x, y, size: s }) {
  if (kind === 'dot') { const r = s * .28; return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; }
  if (kind === 'cross') return `M${x - .32 * s} ${y - .32 * s}L${x + .32 * s} ${y + .32 * s}M${x + .32 * s} ${y - .32 * s}L${x - .32 * s} ${y + .32 * s}`;
  return `M${x - .38 * s} ${y + .02 * s}L${x - .1 * s} ${y + .3 * s}L${x + .42 * s} ${y - .34 * s}`;
}
function arrowHead(it) {
  const a = Math.atan2(it.y2 - it.y, it.x2 - it.x), h = Math.max(7, it.w * 4.5), s = .42;
  return [[it.x2 - h * Math.cos(a - s), it.y2 - h * Math.sin(a - s)], [it.x2 - h * Math.cos(a + s), it.y2 - h * Math.sin(a + s)]];
}
const FIELD_ICON = { text: 'Aa', multi: '¶', check: '☑', list: '▾' };
function draw(it) {
  drawShape(it);
  // réglages communs : rotation (texte, image), transparence, verrou
  const html = !(it.host instanceof SVGElement);
  if (html) it.el.style.transform = it.rot ? `rotate(${it.rot}deg)` : '';
  it.host.style.opacity = it.op != null && it.op < 1 ? it.op : '';
  it.el.classList.toggle('locked', !!it.lock);
}
function drawShape(it) {
  const el = it.el, a = (k, v) => el.setAttribute(k, v);
  if (it.type === 'img') return Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.width + 'px' });
  if (it.type === 'text') return drawText(it);
  if (it.type === 'field') {
    const x = Math.min(it.x, it.x2), y = Math.min(it.y, it.y2);
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.abs(it.x2 - it.x) + 'px', height: Math.abs(it.y2 - it.y) + 'px' });
    el.firstChild.textContent = `${FIELD_ICON[it.fkind] || ''} ${it.name}`;
    return;
  }
  if (it.type === 'mark') {
    const dot = it.kind === 'dot';
    a('d', markPath(it)); a('fill', dot ? it.color : 'none'); a('stroke', dot ? 'none' : it.color);
    a('stroke-width', it.size * .14); a('stroke-linecap', 'round'); a('stroke-linejoin', 'round');
    return;
  }
  if (it.type === 'ink') {
    a('d', 'M' + it.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'));
    a('transform', `translate(${it.x} ${it.y})`);
    a('fill', 'none'); a('stroke', it.color); a('stroke-width', it.w); a('stroke-linecap', 'round'); a('stroke-linejoin', 'round');
    return;
  }
  if (it.type === 'arrow') {
    const [h1, h2] = arrowHead(it);
    a('d', `M${it.x} ${it.y}L${it.x2} ${it.y2}M${h1.join(' ')}L${it.x2} ${it.y2}L${h2.join(' ')}`);
    a('fill', 'none'); a('stroke', it.color); a('stroke-width', it.w); a('stroke-linecap', 'round'); a('stroke-linejoin', 'round');
    return;
  }
  if (it.type === 'line') { a('x1', it.x); a('y1', it.y); a('x2', it.x2); a('y2', it.y2); a('stroke', it.color); a('stroke-width', it.w); a('stroke-linecap', 'round'); return; }
  const x = Math.min(it.x, it.x2), y = Math.min(it.y, it.y2), w = Math.abs(it.x2 - it.x), h = Math.abs(it.y2 - it.y);
  if (it.type === 'ellipse') { a('cx', x + w / 2); a('cy', y + h / 2); a('rx', w / 2); a('ry', h / 2); }
  else { a('x', x); a('y', y); a('width', w); a('height', h); }
  if (it.type === 'hl') { a('fill', it.color); a('fill-opacity', .4); a('stroke', 'none'); }
  else if (it.type === 'redact') { a('fill', '#111'); a('stroke', 'none'); }
  else { a('fill', it.fill ? it.color : 'none'); a('stroke', it.color); a('stroke-width', it.w); }
}
const textPad = it => it.note ? 8 : it.frame ? 6 : 4;
// Texte d'origine corrigé : même serrage des lettres (ou même espacement des mots d'un texte justifié) que la ligne d'origine,
// pour qu'une ligne peu modifiée garde sa longueur et que ce qui n'a pas changé reste à sa place. measure.font doit être à jour.
function origSpacing(it) {
  const o = it.orig;
  if (o?.scan) { // ligne scannée : espacement calé par matchScanFont, valable tant que police et taille n'ont pas changé
    const f = normFont(it.font);
    if (!it.fit || it.fit.key !== f.key || !!it.fit.bold !== !!f.bold || Math.abs(it.fit.size - it.size) > .01) it.ls = 0;
    it.ws = 0;
    return;
  }
  if (!o || !it.font.local || it.font.touched || Math.abs(it.size - o.h) > .01) { it.ls = it.ws = 0; return; }
  if (!document.fonts.check(measure.font)) return; // mesure fausse tant que la police n'est pas chargée
  const raw = o.raw ?? it.run?.str ?? '', n = [...raw].length, spaces = raw.split(' ').length - 1, extra = o.w - measure.measureText(raw).width;
  it.ls = it.ws = 0;
  if (extra > 0 && spaces) it.ws = Math.min(extra / spaces, it.size);
  else if (n > 1 && Math.abs(extra / n) < .08 * it.size) it.ls = extra / n;
}
// Position réelle de la ligne de base dans une ligne de texte : dépend de la police et des arrondis du navigateur à cette taille
const baselines = new Map();
function baselineOf(css) {
  if (baselines.has(css)) return baselines.get(css);
  const d = Object.assign(document.createElement('div'), { innerHTML: 'x<span style="display:inline-block;width:0;height:0"></span>' });
  d.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font:${css};line-height:${L}`; // font remet line-height à zéro : après
  document.body.append(d);
  const b = d.lastChild.getBoundingClientRect().bottom - d.getBoundingClientRect().top;
  d.remove();
  if (document.fonts.check(css)) baselines.set(css, b); // police pas encore chargée : mesure provisoire
  return b;
}
function drawText(it) {
  const f = it.font, fam = cssFamily(f), weight = f.bold ? '700' : '400', style = f.italic ? 'italic' : 'normal', ta = it.input, pad = textPad(it);
  measure.font = `${style} ${weight} ${it.size}px ${fam}`;
  whenFontReady(measure.font, () => it.el.isConnected && drawText(it));
  origSpacing(it);
  const spaced = l => measure.measureText(l).width + (it.ls || 0) * [...l].length + (it.ws || 0) * (l.split(' ').length - 1);
  const natural = Math.max(...it.text.split('\n').map(spaced)) + it.size * .6;
  // ligne de base au même endroit qu'à l'enregistrement, quelle que soit la hauteur de ligne propre à la police
  const shift = (L / 2 + BASE) * it.size - baselineOf(measure.font);
  const cover = !!it.orig; // texte d'origine corrigé : on masque exactement l'ancien, sans déborder sur ses voisins
  Object.assign(it.el.style, { left: it.x - pad + 'px', top: it.y - pad + 'px', background: it.note ? NOTE_BG : '',
                               borderColor: it.frame ? it.color : '' });
  Object.assign(ta.style, { width: (it.wrapW || Math.max(natural, it.orig?.w || 0, it.size)) + 'px', fontSize: it.size + 'px',
                            lineHeight: L, fontFamily: fam, fontWeight: weight, fontStyle: style, color: it.color,
                            background: cover ? 'transparent' : it.bg || 'transparent', whiteSpace: it.wrapW ? 'pre-wrap' : 'pre',
                            transform: Math.abs(shift) > .01 ? `translateY(${shift}px)` : '',
                            letterSpacing: it.ls ? it.ls + 'px' : '', wordSpacing: it.ws ? it.ws + 'px' : '' });
  if (cover) {
    const o = it.orig, base = o.top + .85 * o.h, c = it.el.cover ??= it.el.insertBefore(Object.assign(document.createElement('span'), { className: 'cover' }), ta);
    const [x0, y0, x1, y1] = o.scan ? [o.box[0] - 1, o.box[1] - 1, o.box[2] + 1, o.box[3] + 1] : [o.x - .5, base - .92 * o.h, o.x + o.w + .5, base + .27 * o.h];
    Object.assign(c.style, { left: x0 - it.x + pad + 'px', top: y0 - it.y + pad + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px', background: it.bg });
  }
  ta.style.height = '0px';
  ta.style.height = ta.scrollHeight + 'px';
}

// ---------- Aimantation et sélection au cadre ----------
function bbox(it) { // cadre de l'élément en points, dans le repère de sa page
  const r = (it.type === 'text' && !it.rot ? it.input : it.el).getBoundingClientRect(), l = it.pg.layer.getBoundingClientRect();
  return { x0: (r.left - l.left) / Z, y0: (r.top - l.top) / Z, x1: (r.right - l.left) / Z, y1: (r.bottom - l.top) / Z };
}
function snapTargets(pg, moving) {
  const xs = [0, pg.vp.width / 2, pg.vp.width], ys = [0, pg.vp.height / 2, pg.vp.height];
  for (const i of items) if (i.pg === pg && !moving.includes(i)) {
    const b = bbox(i);
    xs.push(b.x0, (b.x0 + b.x1) / 2, b.x1);
    ys.push(b.y0, (b.y0 + b.y1) / 2, b.y1);
  }
  return { xs, ys };
}
function snapOffset(b, ox, oy, { xs, ys }) { // bords et centres qui s'alignent à moins de 5 px écran
  const best = (vals, cands, o) => {
    let d = 5 / Z, r = { o };
    for (const v of vals) for (const c of cands) { const e = Math.abs(c - v - o); if (e < d) { d = e; r = { o: c - v, g: c }; } }
    return r;
  };
  const X = best([b.x0, (b.x0 + b.x1) / 2, b.x1], xs, ox), Y = best([b.y0, (b.y0 + b.y1) / 2, b.y1], ys, oy);
  return { ox: X.o, oy: Y.o, gx: X.g, gy: Y.g };
}
function guides(pg, gx, gy) {
  for (const [k, v, cls, prop] of [['gv', gx, 'v', 'left'], ['gh', gy, 'h', 'top']]) {
    if (v == null) { pg[k]?.remove(); continue; }
    pg[k] ??= Object.assign(document.createElement('div'), { className: 'guide ' + cls });
    pg.layer.append(pg[k]);
    pg[k].style[prop] = v + 'px';
  }
}

// ---------- Souris sur la page ----------
function down(e, pg) {
  if (e.button !== 0) return;
  closeMenu();
  const t = e.target, cl = t.classList;
  if (cl.contains('field') || (t.tagName === 'TEXTAREA' && tool !== 'move' && !t.item?.lock)) return; // champ ou texte en cours d'écriture
  const pos = ev => toBase(pg, ev);
  const [sx, sy] = pos(e);
  let it, onMove, onUp;
  if (t.item?.lock) { select(t.item, e.shiftKey); e.preventDefault(); return; } // verrouillé : se sélectionne mais ne bouge pas
  if (cl.contains('grip')) { // largeur du paragraphe
    it = t.item;
    const b = it.wrapW;
    onMove = ev => { it.wrapW = Math.max(20, pos(ev)[0] - it.x); draw(it); };
    onUp = () => { const a = it.wrapW; if (a !== b) record(() => setWrap(it, b), () => setWrap(it, a)); };
  } else if (cl.contains('img') && !t.item.rot && e.offsetX > t.clientWidth - 16 && e.offsetY > t.clientHeight - 16) { // poignée native de redimensionnement
    it = t.item;
    select(it);
    const b = it.width;
    addEventListener('pointerup', () => {
      const a = t.offsetWidth;
      if (Math.abs(a - b) > .5) { it.width = a; record(() => setWidth(it, b), () => setWidth(it, a)); }
    }, { once: true });
    return;
  } else if (t.item && (tool === 'move' || cl.contains('box') || cl.contains('img') || cl.contains('mark') || cl.contains('fieldbox'))) { // déplacer
    it = t.item;
    if (e.shiftKey) { select(it, true); e.preventDefault(); return; } // Maj+clic : ajoute / retire de la sélection
    if (!selection.includes(it)) select(it);
    const moving = selection.filter(i => !i.lock), b0 = bbox(it), targets = snapTargets(pg, moving);
    let ax = 0, ay = 0;
    onMove = ev => {
      const [x, y] = pos(ev);
      let s = { ox: x - sx, oy: y - sy };
      if (!ev.altKey) s = snapOffset(b0, s.ox, s.oy, targets);
      guides(pg, s.gx, s.gy);
      moving.forEach(i => moveBy(i, s.ox - ax, s.oy - ay));
      ax = s.ox; ay = s.oy;
    };
    onUp = () => {
      guides(pg);
      const dx = ax, dy = ay;
      if (dx || dy) record(() => moving.forEach(i => moveBy(i, -dx, -dy)), () => moving.forEach(i => moveBy(i, dx, dy)));
    };
  } else if (tool === 'move' || tool === 'crop') { // sélection au cadre, ou zone à garder (recadrage)
    if (tool === 'move' && !e.shiftKey) select(null);
    const m = Object.assign(document.createElement('div'), { className: 'marquee' + (tool === 'crop' ? ' crop' : '') });
    pg.layer.append(m);
    const rect = ev => { const [x, y] = pos(ev); return [Math.min(sx, x), Math.min(sy, y), Math.abs(x - sx), Math.abs(y - sy)]; };
    onMove = ev => { const [x, y, w, h] = rect(ev); Object.assign(m.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); };
    onUp = ev => {
      const [x, y, w, h] = rect(ev);
      if (tool === 'crop') return w > 20 && h > 20 ? cropPage(pg, [x, y, x + w, y + h], m) : m.remove();
      m.remove();
      if (w < 3 && h < 3) return;
      for (const i of items) if (i.pg === pg && !selection.includes(i) && !i.lock) {
        const b = bbox(i);
        if (b.x1 > x && b.x0 < x + w && b.y1 > y && b.y0 < y + h) select(i, true);
      }
    };
  } else if (tool === 'edit') {
    if (cl.contains('tl')) editRun(t, pg); else select(null);
    e.preventDefault();
    return;
  } else if (tool === 'text' || tool === 'note') {
    const note = tool === 'note', size = note ? 10 : +$('size').value;
    add({ type: 'text', pg, x: sx, y: sy - L / 2 * size, text: '', fresh: true, size,
          ...(note && { note: true, wrapW: 150, color: '#3b3413', font: { key: 'arial' } }) });
    e.preventDefault();
    return;
  } else if (tool === 'stamp') {
    const s = +$('size').value, mention = TEXT_STAMPS[stampKind];
    if (mention) {
      const text = mention(), n = add({ type: 'text', pg, x: sx, y: sy - L / 2 * s, text }, stampKind === 'fait');
      recAdd(n);
      if (stampKind === 'fait') { const c = text.indexOf('  ') + 1; n.input.setSelectionRange(c, c); } // curseur là où il reste la ville à taper
    } else recAdd(add({ type: 'mark', pg, kind: stampKind, x: sx, y: sy }));
    e.preventDefault();
    return;
  } else if (tool === 'draw') {
    it = add({ type: 'ink', pg, x: sx, y: sy, pts: [[0, 0]] });
    onMove = ev => {
      const [x, y] = pos(ev), p = it.pts.at(-1);
      if (Math.hypot(x - it.x - p[0], y - it.y - p[1]) > .8) { it.pts.push([x - it.x, y - it.y]); draw(it); }
    };
    onUp = () => { if (it.pts.length === 1) it.pts.push([.01, 0]); draw(it); recAdd(it); };
  } else { // formes, surligneur, caviardage, champ de formulaire : on trace un cadre
    const f = tool === 'field' ? readField() : null;
    it = add({ type: tool === 'highlight' ? 'hl' : tool, pg, x: sx, y: sy, x2: sx, y2: sy,
               ...((tool === 'rect' || tool === 'ellipse') && { fill: $('fill').classList.contains('on') }),
               ...(f && { ...f, name: nextFieldName(f.name) }) });
    onMove = ev => { [it.x2, it.y2] = pos(ev); draw(it); };
    onUp = () => {
      if (Math.hypot(it.x2 - it.x, it.y2 - it.y) < 3) {
        if (it.type !== 'field') return detach(it);
        [it.x2, it.y2] = it.fkind === 'check' ? [sx + 12, sy + 12] : [sx + 160, sy + (it.fkind === 'multi' ? 48 : 18)]; // simple clic : taille par défaut
        draw(it);
      }
      recAdd(it);
    };
  }
  e.preventDefault();
  pg.layer.setPointerCapture(e.pointerId);
  pg.layer.onpointermove = onMove;
  pg.layer.onpointerup = ev => { pg.layer.onpointermove = pg.layer.onpointerup = null; onUp?.(ev); };
}

// Police d'origine d'un morceau de texte : "ABCDEF+TimesNewRomanPS-BoldMT" → Times New Roman, gras
function fontOf(pg, id) {
  let name = '';
  try { name = pg.pdfPage.commonObjs.get(id).name || ''; } catch {}
  name = name.replace(/^[A-Z]{6}\+/, '');
  const family = name.split(/[-,]/)[0].replace(/(PS)?MT$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  const generic = /courier|mono|consol/i.test(name) ? 'monospace'
    : /times|serif|roman|garamond|georgia|cambria|book/i.test(name) && !/sans/i.test(name) ? 'serif' : 'sans-serif';
  return { local: !!name, ps: name, family, generic, key: fontKeyFor(name, generic), bold: /bold|black|heavy|semibold|demi/i.test(name), italic: /italic|oblique/i.test(name) };
}
// Couleur du fond (pixel le plus clair) et de l'encre (pixel le plus sombre) d'une zone de la page
function sample(pg, x0, y0, x1, y1, scan) {
  if (pg.renderedZ == null) return null; // page pas encore dessinée : on relèvera plus tard
  const k = pg.canvas.width / pg.vp.width;
  const d = pg.canvas.getContext('2d').getImageData(x0 * k, y0 * k, Math.max(1, (x1 - x0) * k), Math.max(1, (y1 - y0) * k)).data;
  let ink = [0, 0, 0], bg = [255, 255, 255], min = 766, max = -1;
  for (let i = 0; i < d.length; i += 4) {
    const s = d[i] + d[i + 1] + d[i + 2];
    if (s < min) { min = s; ink = [d[i], d[i + 1], d[i + 2]]; }
    if (s > max) { max = s; bg = [d[i], d[i + 1], d[i + 2]]; }
  }
  if (scan) { // scan : le pixel le plus noir est trop foncé, on prend la teinte moyenne du cœur des lettres
    const t = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] <= min + (max - min) * .3) { t[0] += d[i]; t[1] += d[i + 1]; t[2] += d[i + 2]; n++; }
    if (n) ink = t.map(v => Math.round(v / n));
  }
  // l'anticrénelage éclaircit le noir et fonce le blanc : on retrouve les vraies couleurs quand elles sont proches
  const grey = c => Math.max(...c) - Math.min(...c) < 24;
  if (grey(ink) && Math.max(...ink) < 90) ink = [0, 0, 0];
  if (grey(bg) && Math.min(...bg) > 232) bg = [255, 255, 255];
  return { ink: hex(ink), bg: hex(bg) };
}
function resample(it) {
  const s = sample(it.pg, ...it.orig.box, it.orig.scan);
  if (!s) return;
  it.bg = s.bg;
  if (it.needSample === 'color') it.color = s.ink;
  it.needSample = false;
}
const runFonts = (pg, r) => r.fonts || [...new Set((r.parts || [r]).map(p => fontOf(pg, p.font).ps))].filter(Boolean);
function editRun(span, pg, text, focus = true) {
  const r = span.run, box = r.box || [r.x, r.top, r.x + r.w, r.top + r.px * 1.1], s = sample(pg, ...box, r.scan), font = r.scan ? { key: 'arial' } : fontOf(pg, r.font);
  const it = add({ type: 'text', pg, x: r.x, y: r.top + .85 * r.px - (L / 2 + BASE) * r.px, text: text ?? r.str, size: r.px,
                   color: s?.ink || '#000000', bg: s?.bg || '#ffffff', needSample: s ? false : 'color', span, run: r, font,
                   orig: { x: r.x, top: r.top, w: r.w, h: r.px, scan: !!r.scan, box, raw: r.raw, fonts: r.scan ? [] : runFonts(pg, r) } }, focus);
  // ligne scannée : police, taille et espacement retrouvés d'après les pixels (quelques dixièmes de seconde)
  if (r.scan) matchScanFont(pg, r).then(m => {
    if (!m || it.font !== font) return; // police changée entre-temps
    Object.assign(it, { font: m.font, size: m.size, x: m.x, y: r.top + .85 * r.px - (L / 2 + BASE) * m.size, ls: m.ls, fit: { ...m.font, size: m.size } });
    draw(it);
    if (current === it) reflect();
    changed();
  }, e => console.warn('Police du scan', e));
  // page pas encore dessinée : polices inconnues pour l'instant, on les récupère sans attendre le dessin
  else if (!pg.pdfPage.commonObjs.has(r.font)) pg.pdfPage.getOperatorList().then(() => {
    if (it.font !== font) return; // police changée entre-temps
    it.font = fontOf(pg, r.font);
    it.orig.fonts = runFonts(pg, r);
    draw(it);
    if (current === it) reflect();
  }, () => {});
  recAdd(it);
  return it;
}
