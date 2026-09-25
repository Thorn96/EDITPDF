// Plume · Éléments posés sur les pages, souris, texte d'origine
// ---------- Éléments posés sur les pages ----------
// it.el : l'élément dessiné ; it.host : ce qui est posé dans la page (it.el, ou le <svg> qui entoure une forme).
// Chaque élément a son propre calque : l'ordre des éléments (premier plan / arrière-plan) est le même à l'écran et dans le PDF.
const SVG_TAG = { rect: 'rect', hl: 'rect', redact: 'rect', link: 'rect', ellipse: 'ellipse', line: 'line', arrow: 'path', mark: 'path', ink: 'path' };
const SVG_NS = 'http://www.w3.org/2000/svg';
function makeEl(it) {
  if (it.type === 'text') {
    it.el = document.createElement('div');
    it.el.className = 'box' + (it.note ? ' note' : '') + (it.frame ? ' seal frame-' + it.frame : '');
    // ligne d'origine mêlant plusieurs styles (un mot en gras…) : zone éditable qui garde les styles de chaque morceau
    const ta = it.input = document.createElement(it.rich ? 'div' : 'textarea');
    if (it.rich) {
      ta.className = 'rich';
      try { ta.contentEditable = 'plaintext-only'; } catch { ta.contentEditable = 'true'; }
      renderSegs(it);
    } else { ta.rows = 1; ta.value = it.text; }
    ta.item = it;
    ta.spellcheck = !it.frame;
    if (it.lang) ta.lang = it.lang;
    ta.oninput = () => { if (it.rich) readSegs(it); else it.text = ta.value; typoQuotes(it); draw(it); changed(); };
    ta.onfocus = () => { it.before = snapText(it); if (!selection.includes(it) || selection.length > 1) select(it); };
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
// Zones de texte d'origine remplacées par un élément : une ligne (span) ou les lignes d'un paragraphe (spans)
const spansOf = it => it.spans || (it.span ? [it.span] : []);
const runsOf = it => it.runs || (it.run ? [it.run] : []);
function attach(it, at = items.length) {
  if (!it.el) makeEl(it);
  spansOf(it).forEach(s => s?.remove());
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
  spansOf(it).forEach(s => s && it.pg.layer.append(s)); // texte d'origine de nouveau cliquable
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
const recAdd = it => record(() => detach(it), () => attach(it), tr('Ajout · {x}', { x: tr(itemName(it)) }));
function del(it) {
  if (it.lock) return toast('Élément verrouillé : déverrouille-le d\'abord (clic droit).', 'error');
  const i = detach(it);
  if (!it.fresh) record(() => attach(it, i), () => detach(it), tr('Suppression · {x}', { x: tr(itemName(it)) }));
}
const delMany = list => group(() => [...list].filter(i => !i.lock).forEach(del));
function endEdit(it) {
  if (!items.includes(it)) return;
  if (it.fresh) {
    if (!it.text.trim()) return detach(it);
    it.fresh = false;
    return recAdd(it);
  }
  const a = snapText(it), b = it.before;
  if (JSON.stringify(a) !== JSON.stringify(b)) record(() => setText(it, b), () => setText(it, a), tr(it.orig ? 'Correction du texte' : 'Texte modifié'));
}
// Texte d'un élément pour l'annulation : la chaîne, ou les morceaux stylés d'une ligne mixte
const snapText = it => it.rich ? structuredClone(it.segs) : it.text;
function setText(it, t) {
  if (it.rich) {
    it.segs = Array.isArray(t) ? structuredClone(t) : [{ t, f: it.segs[0]?.f || it.font }];
    it.text = it.segs.map(s => s.t).join('');
    renderSegs(it);
  } else it.text = it.input.value = Array.isArray(t) ? t.map(s => s.t).join('') : t;
  draw(it);
}
const segCss = (f, size) => { f = normFont(f); return `${f.italic ? 'italic ' : ''}${f.bold ? '700' : '400'} ${size}px ${cssFamily(f)}`; };
function renderSegs(it) {
  it.input.replaceChildren(...it.segs.map(s => {
    const e = document.createElement('span'), f = normFont(s.f);
    e.textContent = s.t;
    e.f = s.f;
    Object.assign(e.style, { fontFamily: cssFamily(f), fontWeight: f.bold ? '700' : '400', fontStyle: f.italic ? 'italic' : 'normal' });
    return e;
  }));
}
// Morceaux stylés lus dans la zone éditable après une saisie (le navigateur garde le texte tapé dans le morceau où il est tapé)
function readSegs(it) {
  const segs = [], put = (t, f) => { if (!t) return; if (segs.at(-1)?.f === f) segs.at(-1).t += t; else segs.push({ t, f }); };
  const walk = (n, f) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) put(c.data, f);
      else if (c.nodeName === 'BR') put('\n', f);
      else walk(c, c.f || f);
    }
  };
  walk(it.input, it.segs[0]?.f || it.font);
  it.segs = segs.length ? segs : [{ t: '', f: it.segs[0]?.f || it.font }];
  it.text = it.segs.map(s => s.t).join('');
}
// Gras / italique d'une ligne mixte : sur la partie sélectionnée si elle existe, sinon sur toute la ligne
function styleRich(it, change) {
  const [a, b] = selOffsets(it), out = [];
  let pos = 0;
  for (const s of it.segs) {
    const cuts = [0, clamp(a - pos, 0, s.t.length), clamp(b - pos, 0, s.t.length), s.t.length];
    for (let k = 0; k < 3; k++) {
      const t = s.t.slice(cuts[k], cuts[k + 1]);
      if (!t) continue;
      const inside = a === b || k === 1;
      out.push({ t, f: inside ? change(s.f) : s.f });
    }
    pos += s.t.length;
  }
  setText(it, out.reduce((m, s) => (JSON.stringify(m.at(-1)?.f) === JSON.stringify(s.f) ? m.at(-1).t += s.t : m.push({ ...s }), m), []));
  if (a !== b) setCaret(it, a, b);
}
// Position du curseur ou de la sélection dans le texte d'un élément (zone de texte ou zone éditable)
function selOffsets(it) {
  const ta = it.input;
  if (!it.rich) return [ta.selectionStart, ta.selectionEnd];
  const sel = getSelection();
  if (!sel.rangeCount || !ta.contains(sel.anchorNode)) return [0, 0];
  const r = sel.getRangeAt(0), off = (node, o) => { const x = document.createRange(); x.setStart(ta, 0); x.setEnd(node, o); return x.toString().length; };
  return [off(r.startContainer, r.startOffset), off(r.endContainer, r.endOffset)];
}
function setCaret(it, a, b = a) {
  const ta = it.input;
  if (!it.rich) return ta.setSelectionRange(a, b);
  const at = i => { // nœud de texte et décalage pour une position dans le texte
    const w = document.createTreeWalker(ta, NodeFilter.SHOW_TEXT);
    let n, last = null;
    while ((n = w.nextNode())) { if (i <= n.data.length) return [n, i]; i -= n.data.length; last = n; }
    return last ? [last, last.data.length] : [ta, 0];
  };
  const r = document.createRange();
  r.setStart(...at(a));
  r.setEnd(...at(b));
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}
// Apostrophe typographique (’) quand le document l'emploie : « l'honneur » tapé devient « l’honneur »
function typoQuotes(it) {
  if (!it.curly || !/\p{L}'\p{L}/u.test(it.text)) return;
  const [a, b] = selOffsets(it), fix = s => s.replace(/(\p{L})'(?=\p{L})/gu, '$1’');
  if (it.rich) { it.segs.forEach(s => s.t = fix(s.t)); it.text = it.segs.map(s => s.t).join(''); renderSegs(it); }
  else it.text = it.input.value = fix(it.text);
  setCaret(it, a, b);
}
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
  const e = { nudge: [...list], dx, dy, t: Date.now(), label: tr('Déplacement · {x}', { x: tr(itemName(list[0])) }) };
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
  record(() => [...before].sort((a, b) => a[1] - b[1]).forEach(([it, i]) => moveInStack(it, i)), apply, tr(front ? 'Premier plan' : 'Arrière-plan'));
}
function setLock(list, v) {
  const set = w => list.forEach(it => { it.lock = w; draw(it); });
  set(v);
  record(() => set(!v), () => set(v), tr(v ? 'Verrouillage' : 'Déverrouillage'));
  toast(v ? 'Verrouillé : il ne bougera plus' : 'Déverrouillé');
}
// Copie d'un élément (sur la même page ou une autre : position proportionnelle à la taille de la page)
function cloneItem(it, pg = it.pg, dx = 0, dy = 0) {
  const { el, host, input, span, spans, run, runs, orig, fit, bg, before, fresh, lock, pg: p0, ...rest } = it;
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
  else if (it.type === 'link') { a('stroke-width', 1); it.host.querySelector('title')?.remove(); it.host.insertAdjacentHTML('afterbegin', `<title>${esc(linkLabel(it))}</title>`); }
  else { a('fill', it.fill ? it.color : 'none'); a('stroke', it.color); a('stroke-width', it.w); }
}
const textPad = it => it.note ? 8 : it.frame ? 6 : 4;
// Texte d'origine corrigé : même serrage des lettres (ou même espacement des mots d'un texte justifié) que la ligne d'origine,
// pour qu'une ligne peu modifiée garde sa longueur et que ce qui n'a pas changé reste à sa place. measure.font doit être à jour.
function origSpacing(it) {
  const o = it.orig;
  if (it.fit || o?.scan) { // ligne scannée ou paragraphe : espacement calé une fois, valable tant que police et taille n'ont pas changé
    const f = normFont(it.font);
    if (!it.fit || it.fit.key !== f.key || !!it.fit.bold !== !!f.bold || Math.abs(it.fit.size - it.size) > .01) it.ls = 0;
    it.ws = 0;
    return;
  }
  if (!o || !it.font.local || it.font.touched || Math.abs(it.size - o.h) > .01) { it.ls = it.ws = 0; return; }
  if (!document.fonts.check(measure.font)) return; // mesure fausse tant que la police n'est pas chargée
  const raw = o.raw ?? it.run?.str ?? '', n = [...raw].length, spaces = raw.split(' ').length - 1, extra = o.w - textW(raw);
  it.ls = it.ws = 0;
  if (extra > 0 && spaces) it.ws = Math.min(extra / spaces, it.size);
  else if (n > 1 && Math.abs(extra / n) < .08 * it.size) it.ls = extra / n;
}
// Largeur de la plus longue ligne d'une ligne mixte, morceau par morceau, chacun dans sa police
function richWidth(it) {
  let w = 0, max = 0;
  for (const s of it.segs) s.t.split('\n').forEach((t, k) => {
    if (k) { max = Math.max(max, w); w = 0; }
    w += textW(t, segCss(s.f, it.size)) + (it.ls || 0) * [...t].length;
  });
  return Math.max(max, w);
}
// Zones de l'ancien texte à masquer (repère de la page) : chaque ligne d'origine, ou la boîte de la ligne scannée
function coverRects(it) {
  const o = it.orig;
  if (!o) return [];
  if (o.scan) return (o.lines || [o]).map(({ box: b }) => [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]);
  return (o.lines || [o]).map(l => { const base = l.top + .85 * o.h; return [l.x - .5, base - .92 * o.h, l.x + l.w + .5, base + .27 * o.h]; });
}
// Position réelle de la ligne de base dans une ligne de texte : dépend de la police et des arrondis du navigateur à cette taille
const baselines = new Map();
function baselineOf(css, lh = L) {
  const key = css + '|' + lh;
  if (baselines.has(key)) return baselines.get(key);
  const d = Object.assign(document.createElement('div'), { innerHTML: 'x<span style="display:inline-block;width:0;height:0"></span>' });
  d.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font:${css};line-height:${lh}`; // font remet line-height à zéro : après
  document.body.append(d);
  const b = d.lastChild.getBoundingClientRect().bottom - d.getBoundingClientRect().top;
  d.remove();
  if (document.fonts.check(css)) baselines.set(key, b); // police pas encore chargée : mesure provisoire
  return b;
}
function drawText(it) {
  const f = it.font, fam = cssFamily(f), weight = f.bold ? '700' : '400', style = f.italic ? 'italic' : 'normal', ta = it.input, pad = textPad(it);
  measure.font = `${style} ${weight} ${it.size}px ${fam}`;
  whenFontReady(measure.font, () => it.el.isConnected && drawText(it));
  origSpacing(it);
  const spaced = l => textW(l) + (it.ls || 0) * [...l].length + (it.ws || 0) * (l.split(' ').length - 1);
  const natural = (it.rich ? richWidth(it) : Math.max(...it.text.split('\n').map(spaced))) + it.size * .6;
  // ligne de base au même endroit qu'à l'enregistrement, quelle que soit la hauteur de ligne propre à la police
  const lh = it.lh || L, shift = (lh / 2 + BASE) * it.size - baselineOf(measure.font, lh);
  Object.assign(it.el.style, { left: it.x - pad + 'px', top: it.y - pad + 'px', background: it.note ? NOTE_BG : '',
                               borderColor: it.frame ? it.color : '' });
  Object.assign(ta.style, { width: (it.wrapW || Math.max(natural, it.orig?.w || 0, it.size)) + 'px', fontSize: it.size + 'px',
                            lineHeight: lh, fontFamily: fam, fontWeight: weight, fontStyle: style, color: it.color,
                            background: it.orig ? 'transparent' : it.bg || 'transparent', whiteSpace: it.wrapW ? 'pre-wrap' : 'pre',
                            textAlign: it.justify ? 'justify' : '', transform: Math.abs(shift) > .01 ? `translateY(${shift}px)` : '',
                            letterSpacing: it.ls ? it.ls + 'px' : '', wordSpacing: it.ws ? it.ws + 'px' : '' });
  // texte d'origine corrigé : on masque exactement l'ancien (chaque ligne d'un paragraphe), sans déborder sur ses voisins
  const covers = it.el.covers ??= [];
  coverRects(it).forEach(([x0, y0, x1, y1], i) => {
    const c = covers[i] ??= it.el.insertBefore(Object.assign(document.createElement('span'), { className: 'cover' }), ta);
    Object.assign(c.style, { left: x0 - it.x + pad + 'px', top: y0 - it.y + pad + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px', background: it.bg });
  });
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
  if (e.button !== 0 || pinch) return;
  if (e.pointerType === 'touch' && Date.now() - lastPen < 1500) return; // paume posée pendant qu'on écrit au stylet
  closeMenu();
  const t = e.target, cl = t.classList;
  if (cl.contains('field') || ((t.tagName === 'TEXTAREA' || t.closest?.('.rich')) && tool !== 'move' && !(t.item || t.closest('.rich')?.item)?.lock)) return; // champ ou texte en cours d'écriture
  const pos = ev => toBase(pg, ev);
  const [sx, sy] = pos(e);
  let it, onMove, onUp, creating = false; // creating : élément en train d'être tracé (abandonné si le geste l'est)
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
      if (dx || dy) record(() => moving.forEach(i => moveBy(i, -dx, -dy)), () => moving.forEach(i => moveBy(i, dx, dy)), tr('Déplacement · {x}', { x: tr(itemName(it)) }));
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
    if (cl.contains('tl')) { e.preventDefault(); editText(t, pg, sx, sy); } else select(null);
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
    creating = true;
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
    creating = true;
    onMove = ev => { [it.x2, it.y2] = pos(ev); draw(it); };
    onUp = async () => {
      if (it.type === 'link') { // lien : un cadre, puis sa destination
        if (Math.hypot(it.x2 - it.x, it.y2 - it.y) < 3) [it.x2, it.y2] = [sx + 120, sy + 16];
        draw(it);
        if (!await askLink(it)) return detach(it);
        draw(it);
        reflect();
        return recAdd(it);
      }
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
  pg.layer.onpointerup = ev => { pg.layer.onpointermove = pg.layer.onpointerup = null; cancelGesture = null; onUp?.(ev); };
  // deuxième doigt posé (zoom) : le tracé commencé est abandonné
  cancelGesture = () => { pg.layer.onpointermove = pg.layer.onpointerup = null; cancelGesture = null; if (creating) detach(it); };
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
  if (it.needSample === 'color') { if (it.orig?.color === it.color) it.orig.color = s.ink; it.color = s.ink; }
  it.needSample = false;
}
const runFonts = (pg, r) => r.fonts || [...new Set((r.parts || [r]).map(p => fontOf(pg, p.font).ps))].filter(Boolean);
function editRun(span, pg, text, focus = true) {
  const r = span.run, box = r.box || [r.x, r.top, r.x + r.w, r.top + r.px * 1.1], s = sample(pg, ...box, r.scan), font = r.scan ? { key: 'arial' } : fontOf(pg, r.font);
  const it = add({ type: 'text', pg, x: r.x, y: r.top + .85 * r.px - (L / 2 + BASE) * r.px, text: text ?? r.str, size: r.px, ...docStyle(pg),
                   color: s?.ink || '#000000', bg: s?.bg || '#ffffff', needSample: s ? false : 'color', span, run: r, font,
                   orig: { x: r.x, top: r.top, w: r.w, h: r.px, scan: !!r.scan, box, raw: r.raw, str: r.str, fonts: r.scan ? [] : runFonts(pg, r) } }, focus);
  Object.assign(it.orig, { y0: it.y, color: it.color }); // position et couleur d'origine : tant qu'elles ne changent pas, ce qui n'a pas été retouché reste intact
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

// ---------- Paragraphes ----------
// Comme dans Acrobat : un clic dans un paragraphe l'édite en entier et le texte se redistribue sur ses lignes,
// justifié si l'original l'était. Paragraphe = lignes voisines de même style, alignées à gauche, régulièrement espacées.
// Lignes scannées : mêmes règles, avec la marge d'imprécision de la reconnaissance (début d'encre, taille estimée)
function paraOf(span, pg) {
  const r0 = span.run, scan = !!r0.scan;
  if (!scan && !r0.fonts) return [span]; // styles pas encore connus
  const s0 = scan || styleOf(pg, r0.font), all = [...pg.layer.querySelectorAll('.tl')], tol = scan ? .1 : .03;
  const mates = all.filter(d => !!d.run.scan === scan && (scan || d.run.fonts && styleOf(pg, d.run.font) === s0)
    && Math.abs(d.run.x - r0.x) < (scan ? .3 * r0.px : 1) && Math.abs(d.run.px - r0.px) < tol * r0.px).sort((a, b) => a.run.base - b.run.base);
  const i = mates.indexOf(span), out = [span];
  let gap = 0;
  const next = (a, b) => { const g = b.base - a.base; if (g < a.px || g > 1.8 * a.px || gap && Math.abs(g - gap) > (scan ? .1 : .06) * gap) return false; gap ||= g; return true; };
  for (let k = i + 1; k < mates.length && next(mates[k - 1].run, mates[k].run); k++) out.push(mates[k]);
  for (let k = i - 1; k >= 0 && next(mates[k].run, mates[k + 1].run); k--) out.unshift(mates[k]);
  // autre chose sur ces lignes (mot en gras, colonne voisine) : on s'en tient à la ligne cliquée
  const right = Math.max(...out.map(d => d.run.x + d.run.w)) + 2 * r0.px;
  if (all.some(d => !out.includes(d) && d.run.x < right && d.run.x + d.run.w > r0.x && out.some(o => Math.abs(d.run.base - o.run.base) < .2 * r0.px))) return [span];
  return out;
}
async function editPara(spans, pg) {
  const rs = spans.map(s => s.run), r0 = rs[0], scan = !!r0.scan;
  // scan : police, taille et serrage retrouvés d'après l'image, sur la ligne la plus longue
  const m = scan ? await matchScanFont(pg, rs.reduce((a, b) => b.w > a.w ? b : a)).catch(() => null) : null;
  if (scan && !m) return null;
  const size = scan ? m.size : r0.px, font = scan ? m.font : fontOf(pg, r0.font);
  const css = `${font.italic ? 'italic ' : ''}${font.bold ? '700' : '400'} ${size}px ${cssFamily(font)}`;
  await document.fonts.load(css).catch(() => {});
  measure.font = css;
  const mw = s => textW(s), len = s => [...s].length, first = r => r.str.split(/\s/)[0];
  const W0 = Math.max(...rs.map(r => r.w)), sp = mw(' '), near = scan ? .3 * r0.px : 1;
  // largeur de la colonne : la plus longue ligne de la page qui commence au même endroit
  const lines = [...[...pg.layer.querySelectorAll('.tl')].map(d => d.run), ...items.filter(i => i.pg === pg).flatMap(runsOf)];
  const col = Math.max(W0, ...lines.filter(r => !!r.scan === scan && Math.abs(r.x - r0.x) < near).map(r => r.w));
  // retour automatique : le premier mot de la ligne suivante n'aurait pas tenu dans la colonne ; sinon retour voulu (adresse, liste…)
  const soft = rs.slice(0, -1).map((r, i) => r.w + sp + mw(first(rs[i + 1])) > col + .5);
  const justify = soft.some(Boolean) && rs.every((r, i) => !soft[i] || Math.abs(r.w - W0) < (scan ? .015 : .01) * W0);
  // serrage des lettres d'après les lignes non étirées ; en justifié, au moins ce qu'il faut pour que chaque ligne d'origine tienne
  // (Word tasse parfois une ligne d'un rien pour y faire entrer un dernier mot)
  const plain = rs.filter((r, i) => !(justify && soft[i])), n = plain.reduce((t, r) => t + len(r.raw ?? r.str), 0);
  const extra = plain.reduce((t, r) => t + r.w - mw(r.raw ?? r.str), 0);
  let ls = n > 10 && Math.abs(extra / n) < .08 * size ? extra / n : 0;
  if (justify) ls = Math.min(ls, 0, ...rs.filter((r, i) => soft[i]).map(r => (W0 + .2 - mw(r.str)) / len(r.str)));
  if (ls < -.08 * size) return null;
  const nat = r => mw(r.str) + ls * len(r.str);
  // largeur de coupure : chaque ligne d'origine y tient, et le premier mot de la suivante n'y entre pas
  const lo = Math.max(...rs.map(nat)), hi = Math.min(...rs.slice(0, -1).map((r, i) => soft[i] ? nat(r) + sp + ls + mw(first(rs[i + 1])) + ls * len(first(rs[i + 1])) : Infinity));
  const W = justify ? Math.max(W0 + .3, lo + .1) : clamp(col + .3, lo + .3, hi - .3);
  const gaps = rs.slice(1).map((r, i) => r.base - rs[i].base).sort((a, b) => a - b), lh = gaps[gaps.length >> 1] / size;
  const box = [r0.x, Math.min(...rs.map(r => r.top)), r0.x + W0, Math.max(...rs.map(r => r.top + r.px * 1.1))];
  if (scan) { box[1] = Math.min(...rs.map(r => r.box[1])); box[3] = Math.max(...rs.map(r => r.box[3])); }
  // scan : x de la ligne = début de l'encre moins l'approche de la première lettre (médiane des lignes)
  const lsb = r => { measure.font = css; return measure.measureText(r.str[0] || ' ').actualBoundingBoxLeft; };
  const x = scan ? rs.map(r => r.x + lsb(r)).sort((a, b) => a - b)[rs.length >> 1] : r0.x, s = sample(pg, ...box, scan);
  const it = add({ type: 'text', pg, x, y: r0.base - (lh / 2 + BASE) * size, size, lh, wrapW: W, justify, ls, font, spans, runs: rs, ...docStyle(pg),
                   text: rs.map((r, i) => r.str + (i < rs.length - 1 ? soft[i] ? ' ' : '\n' : '')).join(''),
                   fit: { key: normFont(font).key, bold: !!font.bold, size }, color: s?.ink || '#000000', bg: s?.bg || '#ffffff', needSample: s ? false : 'color',
                   orig: { x: r0.x, top: r0.top, w: W0, h: size, box, raw: r0.raw, scan, fonts: scan ? [] : [...new Set(rs.flatMap(r => r.fonts))],
                           lines: rs.map(r => ({ x: r.x, top: r.top, w: r.w, str: r.str, box: r.box })) } }, false);
  Object.assign(it.orig, { y0: it.y, color: it.color });
  // garde-fou : si notre mise en page ne retombe pas exactement sur les lignes d'origine, on n'édite que la ligne cliquée
  const got = layoutLines(it).map(l => l.t.trim().replace(/\s+/g, ' ')), want = rs.map(r => r.str.trim().replace(/\s+/g, ' '));
  if (got.join('\n') !== want.join('\n')) { detach(it); return null; }
  recAdd(it);
  return it;
}
// Ligne mêlant plusieurs styles : ses morceaux voisins (même ligne, même taille), édités ensemble dans une zone qui garde leurs styles
function lineMates(span, pg) {
  const r0 = span.run;
  if (r0.scan || !r0.fonts) return [span];
  const same = [...pg.layer.querySelectorAll('.tl')].filter(d => d.run.fonts && !d.run.scan && Math.abs(d.run.base - r0.base) < .2 * r0.px && Math.abs(d.run.px - r0.px) < .08 * r0.px)
    .sort((a, b) => a.run.x - b.run.x);
  const near = (p, q) => { const g = q.run.x - (p.run.x + p.run.w); return g > -.5 * r0.px && g < 1.2 * r0.px; };
  let a = same.indexOf(span), b = a;
  while (a > 0 && near(same[a - 1], same[a])) a--;
  while (b < same.length - 1 && near(same[b], same[b + 1])) b++;
  return same.slice(a, b + 1);
}
function editRich(spans, pg) {
  const rs = spans.map(s => s.run), r0 = rs[0], z = rs.at(-1), size = r0.px;
  const segs = rs.map((r, i) => {
    const gap = i ? r.x - (rs[i - 1].x + rs[i - 1].w) : 0, sep = i && gap > .15 * size && !/\s$/.test(rs[i - 1].str) ? ' ' : '';
    return { t: sep + r.str, f: fontOf(pg, r.font) };
  });
  const text = segs.map(s => s.t).join(''), w = z.x + z.w - r0.x, box = [r0.x, r0.top, r0.x + w, r0.top + size * 1.1], s = sample(pg, ...box);
  const n = [...text].length, nat = segs.reduce((t, g) => t + textW(g.t, segCss(g.f, size)), 0), ls = n > 1 && Math.abs((w - nat) / n) < .08 * size ? (w - nat) / n : 0;
  const it = add({ type: 'text', rich: true, segs, text, pg, x: r0.x, y: r0.base - (L / 2 + BASE) * size, size, font: segs[0].f, ls, ...docStyle(pg),
                   fit: { key: normFont(segs[0].f).key, bold: !!segs[0].f.bold, size }, color: s?.ink || '#000000', bg: s?.bg || '#ffffff', needSample: s ? false : 'color',
                   spans, runs: rs, orig: { x: r0.x, top: r0.top, w, h: size, box, str: text, segs: JSON.stringify(segs), fonts: [...new Set(rs.flatMap(r => r.fonts || []))],
                                            lines: rs.map(r => ({ x: r.x, top: r.top, w: r.w, str: r.str })) } }, false);
  Object.assign(it.orig, { y0: it.y, color: it.color });
  recAdd(it);
  return it;
}
// Langue et apostrophes du document, d'après le texte de la page : correcteur orthographique dans la bonne langue,
// et ’ plutôt que ' si le document l'emploie (ou si c'est un scan en français, où la reconnaissance ne les distingue pas)
function docStyle(pg) {
  if (pg.docStyle) return pg.docStyle;
  const runs = [...pg.layer.querySelectorAll('.tl')].map(d => d.run), t = runs.map(r => r.str).join(' '), count = re => (t.match(re) || []).length;
  const fr = count(/\b(le|la|les|des|du|et|est|une?|pour|que|qui|dans|sur|avec|aux?|nous|vous)\b/gi), en = count(/\b(the|and|of|to|is|for|that|with|on|are|this|you|we)\b/gi);
  const l = fr > en ? 'fr' : en > fr ? 'en' : lang, curly = count(/’/g), straight = count(/'/g);
  return pg.docStyle = { lang: l, curly: curly > straight || (!curly && l === 'fr' && runs.some(r => r.scan)) };
}
// Clic sur un texte d'origine : son paragraphe, sa ligne (mixte si elle mêle plusieurs styles) ; curseur placé là où l'on a cliqué
async function editText(span, pg, x, y) {
  const para = paraOf(span, pg);
  let it = para.length > 1 && await editPara(para, pg);
  if (!it) { const line = lineMates(span, pg); it = line.length > 1 ? editRich(line, pg) : editRun(span, pg, undefined, false); }
  it.input.focus();
  if (it.rich) { // la zone éditable sait placer le curseur sous la souris
    const l = pg.layer.getBoundingClientRect(), cx = l.left + x * Z, cy = l.top + y * Z;
    let r = document.caretRangeFromPoint?.(cx, cy);
    if (!r) { const p = document.caretPositionFromPoint?.(cx, cy); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
    if (r && it.input.contains(r.startContainer)) { r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }
    return;
  }
  const i = caretAt(it, x, y);
  it.input.setSelectionRange(i, i);
}
function caretAt(it, x, y) {
  const lines = layoutLines(it), k = clamp(Math.floor((y - it.y) / ((it.lh || L) * it.size)) || 0, 0, lines.length - 1);
  const f = it.font, l = lines[k].t, t = l.trimEnd(), spaces = s => s.split(' ').length - 1;
  measure.font = `${f.italic ? 'italic ' : ''}${f.bold ? '700' : '400'} ${it.size}px ${cssFamily(f)}`;
  // ligne justifiée : les espaces y sont élargis
  const wide = it.justify && lines[k].soft && spaces(t) ? (it.wrapW - textW(t) - (it.ls || 0) * t.length) / spaces(t) : 0;
  let best = 0, bd = Infinity;
  for (let j = 0; j <= l.length; j++) {
    const d = Math.abs(it.x + measure.measureText(l.slice(0, j)).width + (it.ls || 0) * j + wide * spaces(l.slice(0, j)) - x);
    if (d < bd) { bd = d; best = j; }
  }
  return lines.slice(0, k).reduce((t, l) => t + l.t.length + (l.soft ? 0 : 1), 0) + best;
}
// Lignes telles que le navigateur les affiche, retours automatiques compris : le PDF enregistré est coupé exactement pareil
function layoutLines(it) {
  const ta = it.input, text = it.text;
  if (!ta?.isConnected || !it.wrapW) return text.split('\n').map(t => ({ t, soft: false }));
  const m = document.createElement('div'), cs = getComputedStyle(ta);
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'lineHeight', 'whiteSpace', 'textAlign',
                   'fontKerning', 'fontVariantLigatures', 'overflowWrap', 'wordBreak', 'tabSize']) m.style[p] = cs[p];
  Object.assign(m.style, { position: 'absolute', left: '-99999px', top: '0', width: ta.style.width, visibility: 'hidden' }); // largeur exacte (clientWidth arrondit)
  m.textContent = text;
  document.body.append(m);
  const node = m.firstChild, range = document.createRange(), out = [];
  let top = null, start = 0;
  for (let i = 0; node && i < text.length; i++) {
    if (text[i] === '\n') { out.push({ t: text.slice(start, i), soft: false }); start = i + 1; top = null; continue; }
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getClientRects()[0];
    if (!r) continue;
    if (top === null) top = r.top;
    else if (r.top > top + 1) { out.push({ t: text.slice(start, i), soft: true }); start = i; top = r.top; }
  }
  out.push({ t: text.slice(start), soft: false });
  m.remove();
  return out;
}
