// Rature · Aides : profil et remplissage intelligent, modèles, caviardage automatique, signets, liens

// ---------- Mon profil ----------
// Chaque info : clé, libellé, et comment la reconnaître dans un formulaire (libellé imprimé ou nom de champ, sans accents)
const PROFILE = [
  ['civ', 'Civilité', /civilite|^titre$/],
  ['prenom', 'Prénom', /prenom|first ?name|given ?name/],
  ['nomnaiss', 'Nom de naissance', /nom de naissance|nom de jeune fille|maiden/],
  ['nom', 'Nom', /\bnom\b|last ?name|surname|family ?name|\bname\b/],
  ['naissdate', 'Date de naissance', /date de naissance|\bne\(?e?\)? le\b|birth ?date|date of birth|\bdob\b/],
  ['naisslieu', 'Lieu de naissance', /lieu de naissance|\bne\(?e?\)? a\b|place of birth|birth ?place/],
  ['nationalite', 'Nationalité', /nationalite|nationality/],
  ['profession', 'Profession', /profession|metier|occupation/],
  ['adresse', 'Adresse', /adresse|domicile|demeurant|address|\brue\b/],
  ['cp', 'Code postal', /code postal|\bcp\b|postal|\bzip\b/],
  ['ville', 'Ville', /\bville\b|commune|\bcity\b|localite/],
  ['tel', 'Téléphone', /telephone|\btel\b|portable|mobile|phone/],
  ['email', 'E-mail', /e-?mail|courriel|\bmel\b/],
];
let profile = {};
try { profile = JSON.parse(localStorage.profile || '{}'); } catch {}
// sans accents ni majuscules (même longueur que le texte d'origine, pour y retrouver les positions)
const plainText = s => s.replace(/[^\x00-\x7f]/g, c => c.normalize('NFD')[0]).toLowerCase();
const profileKey = label => { const n = plainText(label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ')); return PROFILE.find(([, , re]) => re.test(n))?.[0]; };

function openProfile(after) {
  $('profgrid').replaceChildren(...PROFILE.map(([k, label]) => {
    const l = document.createElement('label');
    l.className = k === 'adresse' || k === 'email' ? 'full' : '';
    l.append(tr(label), Object.assign(document.createElement('input'), { className: 'txt', value: profile[k] || '', name: k, autocomplete: 'off' }));
    return l;
  }));
  $('profsave').onclick = () => {
    for (const i of $('profgrid').querySelectorAll('input')) profile[i.name] = i.value.trim();
    try { localStorage.profile = JSON.stringify(profile); } catch {}
    $('profdlg').close();
    toast('Profil enregistré');
    after?.();
  };
  $('profdlg').showModal();
}
$('profclose').onclick = () => $('profdlg').close();

// ---------- Remplir avec mon profil ----------
// Champs du formulaire reconnus par leur nom ; dans un PDF sans champs, libellés imprimés (« Nom : ……… ») suivis d'un blanc
function fillProposals() {
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('.field')) {
    if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') continue;
    const k = profileKey(el.dataset.k.split('.').pop().replace(/\[\d+\]/g, '')), key = el.source && sources.indexOf(el.source) + ':' + el.dataset.k;
    if (!k || !profile[k] || seen.has(key) || String(el.source.fields[el.dataset.k] || '').trim()) continue;
    seen.add(key);
    out.push({ k, label: el.dataset.k, field: el });
  }
  for (const pg of pages) {
    // lignes qui ont déjà un vrai champ de formulaire : leur libellé imprimé ne se remplit pas en plus
    const lay = pg.layer.getBoundingClientRect(), fieldRows = [...pg.layer.querySelectorAll('.field')].map(el => { const b = el.getBoundingClientRect(); return [(b.top - lay.top) / Z, (b.bottom - lay.top) / Z]; });
    for (const d of pg.layer.querySelectorAll('.tl')) {
      const r = d.run, s = plainText(r.str);
      if (fieldRows.some(([a, b]) => r.base > a - 2 && r.top < b + 2)) continue;
      // libellé seul sur sa ligne (« Nom : »), ou suivi de pointillés à remplir (« né(e) le ……… ») ; le texte va juste après
      const found = [...s.matchAll(/([a-z()' ]{1,30}?)\s*(:\s*)?[._…]{3,}/g)].map(m => ({ label: m[1].trim(), at: m.index + m[1].length + (m[2]?.length || 0), end: m.index + m[0].length }));
      const whole = /^\s*([a-z()' ]{2,40}?)\s*(:?)\s*$/.exec(s);
      if (whole) found.push({ label: whole[1].trim(), at: s.length, end: null });
      let prev;
      for (const { label, at, end } of found) {
        const k = label === 'a' && prev === 'naissdate' ? 'naisslieu' : profileKey(label); // « né(e) le ……… à ……… »
        prev = k;
        if (k && profile[k]) out.push({ k, label: r.str.slice(0, at).trim(), pg, run: r, at, end });
      }
    }
  }
  return out;
}
function openFill() {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  if (!PROFILE.some(([k]) => profile[k])) return openProfile(openFill);
  const list = fillProposals();
  $('fillinfo').textContent = list.length ? tr('{n} zone(s) reconnue(s). Vérifie avant de remplir.', { n: list.length }) : tr('Aucune zone reconnue : ajoute tes informations avec l\'outil Texte, ou complète ton profil.');
  $('filllist').replaceChildren(...list.map(p => {
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<input type="checkbox" checked><span class="grow"><small></small><input class="txt"></span>`;
    row.querySelector('small').textContent = `${tr(PROFILE.find(([k]) => k === p.k)[1])} · ${p.field ? tr('champ') : tr('page {n}', { n: pages.indexOf(p.pg) + 1 })} « ${p.label} »`;
    row.querySelector('.txt').value = profile[p.k];
    row.p = p;
    return row;
  }));
  $('fillgo').disabled = !list.length;
  $('filldlg').showModal();
}
$('fillclose').onclick = () => $('filldlg').close();
$('fillprof').onclick = () => { $('filldlg').close(); openProfile(openFill); };
$('fillgo').onclick = () => {
  const rows = [...$('filllist').children].filter(r => r.querySelector('[type=checkbox]').checked);
  group(() => rows.forEach(row => {
    const p = row.p, v = row.querySelector('.txt').value;
    if (!v) return;
    if (p.field) {
      const src = p.field.source, k = p.field.dataset.k, b = src.fields[k];
      setField(src, k, v);
      record(() => setField(src, k, b), () => setField(src, k, v));
      return;
    }
    // texte posé juste après le libellé, sur sa ligne, dans sa police
    const r = p.run, f = r.fonts ? fontOf(p.pg, r.font) : { key: 'arial' }, font = f.local ? { ...f } : { key: f.key };
    measure.font = segCss(f, r.px);
    const k = r.w / (textW(r.str) || 1), x = r.x + textW(r.str.slice(0, p.at)) * k + r.px * .3;
    // entre des pointillés : taille réduite (jusqu'à 70 %) si le texte déborderait sur la suite de la ligne
    const room = p.end != null && p.end < r.str.length ? r.x + textW(r.str.slice(0, p.end)) * k - x : Infinity, w = textW(v, segCss(font, r.px));
    const size = w > room ? Math.max(r.px * .7, r.px * room / w) : r.px;
    recAdd(add({ type: 'text', pg: p.pg, x, y: r.base - (L / 2 + BASE) * size - (r.px - size) * .2, size, text: v, font, color: penColor }, false));
  }), tr('Remplissage avec mon profil'));
  $('filldlg').close();
  select(null);
  toast(plural(rows.length, '{n} zone remplie', '{n} zones remplies'));
};

// ---------- Modèles ----------
async function tplIndex() { return (await idb('readonly', s => s.get('tplindex')).catch(() => null)) || []; }
async function openTemplates() {
  const list = await tplIndex();
  $('tpllist').replaceChildren(...(list.length ? list.map(t => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="grow"><b></b><small></small></span><button class="btn">${esc(tr('Ouvrir'))}</button><button class="btn danger">${esc(tr('Supprimer'))}</button>`;
    row.querySelector('b').textContent = t.name;
    row.querySelector('small').textContent = new Date(t.t).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');
    const [open, del] = row.querySelectorAll('button');
    open.onclick = async () => {
      if (pages.length && !await ask({ title: 'Ouvrir le modèle', text: 'Le document ouvert sera remplacé (il reste dans la sauvegarde automatique jusqu\'à la prochaine modification).',
                                        buttons: [{ label: 'Annuler', value: false }, { label: 'Ouvrir', value: true, primary: true }] })) return;
      const snap = await idb('readonly', s => s.get('tpl:' + t.id));
      $('tpldlg').close();
      await restore(snap);
      $('expname').value = t.name;
      toast(tr('Modèle « {name} » ouvert', { name: t.name }));
    };
    del.onclick = async () => {
      await idb('readwrite', s => { s.delete('tpl:' + t.id); return s.put(list.filter(x => x !== t), 'tplindex'); });
      openTemplates();
    };
    return row;
  }) : [Object.assign(document.createElement('p'), { className: 'empty', textContent: tr('Aucun modèle pour l\'instant.') })]));
  $('tplsave').disabled = !pages.length;
  if (!$('tpldlg').open) $('tpldlg').showModal();
}
$('tplclose').onclick = () => $('tpldlg').close();
$('tplsave').onclick = async () => {
  const r = await ask({ title: 'Enregistrer comme modèle', text: 'Nom du modèle :', input: { value: baseName($('fname').textContent || 'Modèle') },
                        buttons: [{ label: 'Annuler', value: 0 }, { label: 'Enregistrer', value: 1, primary: true }] });
  if (!r?.v || !r.text.trim()) return openTemplates();
  const id = Date.now().toString(36), list = await tplIndex();
  try {
    await idb('readwrite', s => { s.put(snapshot(), 'tpl:' + id); return s.put([{ id, name: r.text.trim(), t: Date.now() }, ...list], 'tplindex'); });
    toast('Modèle enregistré');
  } catch { toast('Impossible d\'enregistrer le modèle (espace du navigateur plein ?)', 'error'); }
  openTemplates();
};

// ---------- Caviardage automatique ----------
const SENSITIVE = [
  ['email', 'Adresses e-mail', /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, true],
  ['tel', 'Numéros de téléphone', /(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, true],
  ['iban', 'IBAN', /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, true],
  ['nir', 'Numéros de sécurité sociale', /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2]|[2-9]\d)\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}(?:\s?\d{2})?\b/g, true],
  ['carte', 'Numéros de carte bancaire', /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, true],
  ['date', 'Dates', /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, false],
];
// clé de Luhn des cartes bancaires : écarte les suites de chiffres qui n'en sont pas (IBAN, références…)
const luhn = s => { const d = s.replace(/\D/g, ''); let t = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
function sensitiveHits() {
  const hits = Object.fromEntries(SENSITIVE.map(([k]) => [k, []]));
  for (const pg of pages) for (const d of pg.layer.querySelectorAll('.tl')) for (const [k, , re] of SENSITIVE)
    for (const m of d.run.str.matchAll(re)) if (k !== 'carte' || luhn(m[0])) hits[k].push({ pg, span: d, start: m.index, len: m[0].length });
  return hits;
}
function openAutoRedact() {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  const hits = sensitiveHits(), scans = pages.filter(p => p.wrap.classList.contains('scan') && !p.ocr).length;
  $('redactlist').replaceChildren(...SENSITIVE.map(([k, label, , on]) => {
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<input type="checkbox"><span class="grow"><b></b><small></small></span>`;
    const n = hits[k].length, box = row.querySelector('input');
    box.checked = on && n > 0;
    box.disabled = !n;
    box.dataset.k = k;
    row.querySelector('b').textContent = tr(label);
    row.querySelector('small').textContent = n ? hits[k].slice(0, 3).map(h => h.span.run.str.substr(h.start, h.len)).join(' · ') + (n > 3 ? ' …' : '') : tr('aucun trouvé');
    row.querySelector('b').append(` (${n})`);
    return row;
  }));
  $('redactmsg').textContent = scans ? tr('{n} page(s) scannée(s) pas encore reconnue(s) : lance d\'abord la reconnaissance du texte pour les inclure.', { n: scans }) : '';
  $('redactgo').onclick = () => {
    const keys = [...$('redactlist').querySelectorAll('input:checked')].map(i => i.dataset.k);
    let n = 0;
    group(() => { for (const k of keys) for (const h of hits[k]) {
      const [x, y, w, hh] = hitRect(h);
      recAdd(add({ type: 'redact', pg: h.pg, x: x - 1, y: y - 1, x2: x + w + 1, y2: y + hh + 1 }, false));
      n++;
    } }, tr('Caviardage automatique'));
    select(null);
    $('redactdlg').close();
    toast(plural(n, '{n} zone caviardée : effacée pour de bon au téléchargement', '{n} zones caviardées : effacées pour de bon au téléchargement'));
  };
  $('redactdlg').showModal();
}
$('redactclose').onclick = () => $('redactdlg').close();

// ---------- Signets ----------
let bookmarks = []; // { title, pg }
function openBookmarks() {
  if (!pages.length) return toast("Ouvre d'abord un PDF.", 'error');
  renderBookmarks();
  $('bmdlg').showModal();
}
function renderBookmarks() {
  bookmarks = bookmarks.filter(b => pages.includes(b.pg)).sort((a, b) => pages.indexOf(a.pg) - pages.indexOf(b.pg));
  $('bmlist').replaceChildren(...(bookmarks.length ? bookmarks.map(b => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="grow"><input class="txt"></span><input class="mini" type="number" min="1" title="${esc(tr('Page'))}" style="width:64px"><button class="btn icon danger" title="${esc(tr('Supprimer'))}">✕</button>`;
    const [t, p] = row.querySelectorAll('input');
    t.value = b.title;
    p.value = pages.indexOf(b.pg) + 1;
    p.max = pages.length;
    t.onchange = () => { b.title = t.value; changed(); };
    p.onchange = () => { b.pg = pages[clamp(+p.value || 1, 1, pages.length) - 1]; renderBookmarks(); changed(); };
    row.querySelector('button').onclick = () => { bookmarks = bookmarks.filter(x => x !== b); renderBookmarks(); changed(); };
    return row;
  }) : [Object.assign(document.createElement('p'), { className: 'empty', textContent: tr('Aucun signet.') })]));
}
$('bmadd').onclick = () => { const pg = visiblePage(); bookmarks.push({ title: tr('Page {n}', { n: pages.indexOf(pg) + 1 }), pg }); renderBookmarks(); changed(); };
$('bmclose').onclick = () => $('bmdlg').close();
// Titres : lignes nettement plus grandes que le texte courant de la page, ou courtes et en gras
$('bmauto').onclick = () => {
  const found = [];
  for (const pg of pages) {
    const runs = [...pg.layer.querySelectorAll('.tl')].map(d => d.run).filter(r => r.str.trim().length > 2);
    const sizes = runs.map(r => r.px).sort((a, b) => a - b), body = sizes[sizes.length >> 1] || 0;
    for (const r of runs) {
      const bold = r.fonts && fontOf(pg, r.font).bold, short = r.str.length < 70 && !/[.;,]$/.test(r.str.trim());
      if (short && (r.px > body * 1.15 || bold && r.px >= body)) found.push({ title: r.str.trim(), pg, top: r.top });
    }
  }
  if (!found.length) return toast('Aucun titre repéré.', 'error');
  bookmarks = found.slice(0, 200).map(({ title, pg }) => ({ title, pg }));
  renderBookmarks();
  changed();
};
// Dans le PDF final : table des matières (Outlines) vers les pages gardées
function writeBookmarks(pdf, target) {
  const bms = bookmarks.filter(b => target.has(b.pg));
  if (!bms.length) return;
  const { PDFName, PDFHexString } = PDFLib, ctx = pdf.context, top = ctx.nextRef(), refs = bms.map(() => ctx.nextRef());
  bms.forEach((b, i) => ctx.assign(refs[i], ctx.obj({
    Title: PDFHexString.fromText(b.title || '—'), Parent: top, Dest: [target.get(b.pg).ref, 'Fit'],
    ...(i && { Prev: refs[i - 1] }), ...(i < bms.length - 1 && { Next: refs[i + 1] }),
  })));
  ctx.assign(top, ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs.at(-1), Count: bms.length }));
  pdf.catalog.set(PDFName.of('Outlines'), top);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

// ---------- Liens ----------
// Destination d'un lien : adresse web, e-mail, ou numéro de page du document
const linkLabel = it => it.url || (it.page ? tr('Page {n}', { n: it.page }) : '');
function parseLink(v) {
  v = v.trim();
  if (/^\d+$/.test(v)) return { url: null, page: clamp(+v, 1, pages.length) };
  if (!v) return null;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) v = 'mailto:' + v;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  return { url: v, page: null };
}
async function askLink(it) {
  const r = await ask({ title: 'Lien', text: 'Adresse web, e-mail ou numéro de page :', input: { value: it.url || (it.page ? String(it.page) : ''), placeholder: 'https://…' },
                        buttons: [{ label: 'Annuler', value: 0 }, { label: 'Valider', value: 1, primary: true }] });
  const d = r?.v && parseLink(r.text);
  if (d) Object.assign(it, d);
  return !!d;
}
$('linkto').onchange = () => {
  const it = current, d = it?.type === 'link' && parseLink($('linkto').value);
  if (!d) return;
  const b = { url: it.url, page: it.page };
  Object.assign(it, d);
  draw(it);
  record(() => { Object.assign(it, b); draw(it); reflect(); }, () => { Object.assign(it, d); draw(it); reflect(); });
};
// Dans le PDF final : zone cliquable (annotation Link)
function writeLink(pdf, page, it, rect, target) {
  const { PDFString } = PDFLib, ctx = pdf.context, dest = it.page && target.get(pages[it.page - 1]);
  if (!it.url && !dest) return;
  page.node.addAnnot(ctx.register(ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height], Border: [0, 0, 0],
    ...(it.url ? { A: { Type: 'Action', S: 'URI', URI: PDFString.of(it.url) } } : { Dest: [dest.ref, 'Fit'] }),
  })));
}
