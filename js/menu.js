// Plume · Menus : clic droit sur un élément ou une page, menus « Plus d'outils » et « Réglages »
// entries : { label, fn, key, danger, on, disabled } | '-' (séparateur) | { head } (titre de section)
function openMenu(x, y, entries) {
  const m = $('menu');
  m.innerHTML = '';
  for (const e of entries) {
    if (!e) continue;
    if (e === '-') { m.append(document.createElement('hr')); continue; }
    if (e.head) { m.append(Object.assign(document.createElement('div'), { className: 'mhead', textContent: tr(e.head) })); continue; }
    const b = document.createElement('button');
    b.innerHTML = `<span>${esc(tr(e.label))}</span>${e.key ? `<kbd>${esc(tr(e.key))}</kbd>` : ''}`;
    b.classList.toggle('danger', !!e.danger);
    b.classList.toggle('on', !!e.on);
    b.classList.toggle('undone', !!e.undone);
    b.disabled = !!e.disabled;
    b.onclick = () => { closeMenu(); e.fn(); };
    m.append(b);
  }
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
  m.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
}
function closeMenu() { if ($('menu').hidden) return false; $('menu').hidden = true; return true; }
addEventListener('pointerdown', e => { if (!e.target.closest('#menu, #toolsbtn, #settingsbtn, #histbtn')) closeMenu(); }, true);
addEventListener('resize', () => closeMenu());
$('pages').addEventListener('scroll', () => closeMenu());
const menuAt = btn => { const r = btn.getBoundingClientRect(); return [r.right - 250, r.bottom + 6]; };

function rotateItems(list, d) {
  group(() => list.filter(PROP_OK.rot).forEach(it => {
    const b = snap(it);
    it.rot = (((it.rot || 0) + d) % 360 + 540) % 360 - 180;
    draw(it);
    const a = snap(it);
    record(() => restoreProps(it, b), () => restoreProps(it, a));
  }));
  reflect();
}

function openItemMenu(e, it) {
  if (!selection.includes(it)) select(it);
  const list = [...selection], locked = list.every(i => i.lock), canRot = list.some(PROP_OK.rot);
  openMenu(e.clientX, e.clientY, [
    { label: 'Dupliquer', key: 'Ctrl D', fn: () => duplicate(list) },
    { label: 'Copier', key: 'Ctrl C', fn: () => { clip = list.map(i => cloneItem(i)); navigator.clipboard?.writeText(`[Plume] ${clip.length}`).catch(() => {}); toast('Copié'); } },
    { label: 'Sur toutes les pages', fn: () => copyToAllPages(list), disabled: pages.length < 2 },
    '-',
    { label: 'Premier plan', fn: () => userReorder(list, true) },
    { label: 'Arrière-plan', fn: () => userReorder(list, false) },
    canRot && { label: 'Pivoter de 15° à droite', fn: () => rotateItems(list, 15) },
    canRot && { label: 'Pivoter de 15° à gauche', fn: () => rotateItems(list, -15) },
    { label: locked ? 'Déverrouiller' : 'Verrouiller', fn: () => setLock(list, !locked) },
    '-',
    { label: 'Supprimer', key: 'Suppr', danger: true, fn: () => delMany(list), disabled: locked },
  ]);
}

function openPageMenu(e, pg) {
  const i = pages.indexOf(pg);
  openMenu(e.clientX, e.clientY, [
    { head: tr('Page {n}', { n: i + 1 }) },
    { label: 'Coller', key: 'Ctrl V', fn: () => pasteItems(pg), disabled: !clip.length },
    { label: 'Tout sélectionner', key: 'Ctrl A', fn: () => { select(null); items.filter(x => x.pg === pg && !x.lock).forEach(x => select(x, true)); } },
    '-',
    { label: 'Insérer une page blanche après', fn: () => insertBlank(pg) },
    { label: 'Dupliquer la page', fn: () => duplicatePage(pg) },
    { label: 'Pivoter à gauche', fn: () => userRotate(pg, -90) },
    { label: 'Pivoter à droite', fn: () => userRotate(pg, 90) },
    pg.crop ? { label: 'Annuler le recadrage', fn: () => userCrop(pg, null) } : { label: 'Recadrer la page', fn: () => startCrop(pg) },
    '-',
    { label: 'Télécharger cette page (PDF)', fn: () => openExport([pg]) },
    { label: 'Enregistrer cette page en image', fn: () => pageToImage(pg) },
    { label: 'Vue en grille des pages', key: 'G', fn: openGrid },
    '-',
    { label: 'Supprimer la page', danger: true, fn: () => userDeletePage(pg), disabled: pages.length < 2 },
  ]);
}

function toolsEntries() {
  const none = !pages.length, pg = visiblePage();
  return [
    { head: 'Pages' },
    { label: 'Vue en grille des pages', key: 'G', fn: openGrid, disabled: none },
    { label: 'Insérer une page blanche', fn: () => insertBlank(pg), disabled: none },
    { label: 'Recadrer la page affichée', fn: () => startCrop(pg), disabled: none },
    { label: 'Découper le PDF en plusieurs fichiers…', fn: openSplit, disabled: none },
    { head: 'Remplir' },
    { label: 'Remplir avec mon profil…', fn: openFill, disabled: none },
    { label: 'Mes modèles…', fn: openTemplates },
    { head: 'Document' },
    { label: 'Filigrane, numéros de page, en-tête…', fn: openDeco, disabled: none },
    { label: 'Rechercher et remplacer', key: 'Ctrl F', fn: () => openFind(), disabled: none },
    { label: 'Caviarder automatiquement…', fn: openAutoRedact, disabled: none },
    { label: 'Ajouter un lien', key: 'K', fn: () => setTool('link'), disabled: none },
    { label: 'Signets (table des matières)…', fn: openBookmarks, disabled: none },
    { label: 'Comparer avec un autre PDF…', fn: openCompare, disabled: none },
    { head: 'Convertir' },
    { label: 'Exporter en Word (.docx)', fn: exportDocx, disabled: none },
    { label: 'Extraire le texte…', fn: openText, disabled: none },
    { label: 'Ouvrir un document Word (.docx)…', fn: () => $('file').click() },
    { head: 'Plusieurs fichiers' },
    { label: 'Traitement par lot…', fn: openBatch },
  ];
}
function settingsEntries() {
  return [
    { head: 'Langue' },
    { label: 'Français', on: lang === 'fr', fn: () => setLang('fr') },
    { label: 'English', on: lang === 'en', fn: () => setLang('en') },
    { head: 'Thème' },
    { label: 'Automatique (comme l\'appareil)', on: prefs.theme === 'auto', fn: () => setTheme('auto') },
    { label: 'Clair', on: prefs.theme === 'light', fn: () => setTheme('light') },
    { label: 'Sombre', on: prefs.theme === 'dark', fn: () => setTheme('dark') },
    '-',
    { label: 'Mon profil (remplissage)…', fn: () => openProfile() },
    { label: 'Revoir la visite guidée', fn: () => startTour(true), disabled: !pages.length },
    { label: 'Raccourcis clavier', key: '?', fn: showHelp },
    REPORT_KEY && { label: 'Signaler un problème…', fn: openReport },
    { label: 'Réinitialiser mes préférences', fn: resetPrefs },
  ];
}
$('toolsbtn').onclick = () => { if (!closeMenu()) openMenu(...menuAt($('toolsbtn')), toolsEntries()); };
$('settingsbtn').onclick = () => { if (!closeMenu()) openMenu(...menuAt($('settingsbtn')), settingsEntries()); };

// ---------- Historique : chaque étape, du plus récent au plus ancien ; un clic y revient ----------
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return !t ? '' : m < 1 ? tr("à l'instant") : m < 60 ? tr('il y a {n} min', { n: m }) : new Date(t).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }); };
function goToStep(n) { // n : nombre d'étapes à garder faites
  while (past.length > n && past.length) undo();
  while (past.length < n && future.length) redo();
}
function openHistory() {
  if (closeMenu()) return;
  const steps = [...past.map((a, i) => ({ a, n: i + 1, done: true })), ...[...future].reverse().map((a, i) => ({ a, n: past.length + i + 1, done: false }))];
  openMenu(...menuAt($('histbtn')), [
    { head: steps.length ? 'Historique' : "Aucune modification pour l'instant" },
    ...steps.slice(-40).reverse().map(({ a, n, done }) => ({ label: a.label || tr('Modification'), key: ago(a.t), on: n === past.length, undone: !done, fn: () => goToStep(n) })),
    steps.length && '-',
    steps.length && { label: "Revenir au document d'origine", fn: () => goToStep(0), disabled: !past.length },
  ]);
}
$('histbtn').onclick = openHistory;

// ---------- Palette de commandes (Ctrl K) : n'importe quelle action en tapant quelques lettres ----------
function commands() {
  const out = [], put = (label, fn, key, group) => out.push({ label: tr(label), fn, key: key ? tr(key) : '', group: tr(group), find: plainText(`${label} ${tr(label)} ${group} ${tr(group)}`) }); // cherché dans les deux langues
  for (const b of document.querySelectorAll('#tools button[data-tip], #tools .flyout button[data-tip]')) {
    const [label, key] = b.dataset.tip.split(' · ');
    put(label, () => b.dataset.t ? setTool(b.dataset.t) : b.click(), key, 'Outil');
  }
  const add = (list, group) => { let g = group; for (const e of list) { if (!e || e === '-') continue; if (e.head) { g = e.head; continue; } if (!e.disabled) put(e.label, e.fn, e.key, g); } };
  add([
    { head: 'Fichier' }, { label: 'Ouvrir un fichier…', key: 'Ctrl O', fn: () => $('file').click() },
    pages.length && { label: 'Télécharger le PDF…', key: 'Ctrl S', fn: () => openExport() },
    pages.length && { label: 'Ouvrir un PDF dans un nouvel onglet…', fn: () => { openInNewTab = true; $('file').click(); } },
    { head: 'Édition' }, past.length && { label: 'Annuler la dernière modification', key: 'Ctrl Z', fn: undo }, future.length && { label: 'Rétablir', key: 'Ctrl Y', fn: redo },
    { label: 'Historique des modifications', fn: openHistory },
    pages.length && { head: 'Affichage' }, pages.length && { label: 'Ajuster à la largeur', key: 'Ctrl 0', fn: () => fitWidth() },
    pages.length && { label: 'Agrandir (zoom)', key: 'Ctrl +', fn: () => zoomBy(1.2) }, pages.length && { label: 'Réduire (zoom)', key: 'Ctrl −', fn: () => zoomBy(1 / 1.2) },
    ...pages.map((p, i) => ({ label: tr('Aller à la page {n}', { n: i + 1 }), fn: () => p.wrap.scrollIntoView({ block: 'start' }) })),
  ], 'Fichier');
  add(toolsEntries(), 'Outils');
  add(settingsEntries(), 'Réglages');
  return out;
}
let palCmds = [], palAt = 0;
function openPalette() {
  closeMenu();
  palCmds = commands();
  $('palette').hidden = false;
  $('palq').value = '';
  renderPalette();
  $('palq').focus();
}
const closePalette = () => { $('palette').hidden = true; };
function renderPalette() {
  const words = plainText($('palq').value).split(/\s+/).filter(Boolean);
  const list = palCmds.filter(c => words.every(w => c.find.includes(w))).slice(0, 60);
  palAt = clamp(palAt, 0, Math.max(0, list.length - 1));
  $('pallist').replaceChildren(...(list.length ? list.map((c, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = c.label;
    b.lastChild.textContent = c.key || c.group;
    b.classList.toggle('on', i === palAt);
    b.onclick = () => { closePalette(); c.fn(); };
    return b;
  }) : [Object.assign(document.createElement('div'), { className: 'none', textContent: tr('Aucune action ne correspond.') })]));
  $('pallist').children[palAt]?.scrollIntoView?.({ block: 'nearest' });
}
$('palq').oninput = () => { palAt = 0; renderPalette(); };
$('palq').onkeydown = e => {
  const n = $('pallist').querySelectorAll('button').length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); palAt = (palAt + (e.key === 'ArrowDown' ? 1 : -1) + n) % Math.max(1, n); renderPalette(); }
  if (e.key === 'Enter') { e.preventDefault(); $('pallist').querySelectorAll('button')[palAt]?.click(); }
  if (e.key === 'Escape') { e.stopPropagation(); closePalette(); }
};
$('palette').onpointerdown = e => { if (e.target === $('palette')) closePalette(); };
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('palette').hidden ? openPalette() : closePalette(); } }, true);
