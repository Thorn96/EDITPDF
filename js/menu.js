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
addEventListener('pointerdown', e => { if (!e.target.closest('#menu, #toolsbtn, #settingsbtn')) closeMenu(); }, true);
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

$('toolsbtn').onclick = () => {
  if (closeMenu()) return;
  const none = !pages.length, pg = visiblePage();
  openMenu(...menuAt($('toolsbtn')), [
    { head: 'Pages' },
    { label: 'Vue en grille des pages', key: 'G', fn: openGrid, disabled: none },
    { label: 'Insérer une page blanche', fn: () => insertBlank(pg), disabled: none },
    { label: 'Recadrer la page affichée', fn: () => startCrop(pg), disabled: none },
    { label: 'Découper le PDF en plusieurs fichiers…', fn: openSplit, disabled: none },
    { head: 'Document' },
    { label: 'Filigrane, numéros de page, en-tête…', fn: openDeco, disabled: none },
    { label: 'Rechercher et remplacer', key: 'Ctrl F', fn: () => openFind(), disabled: none },
    { label: 'Extraire le texte…', fn: openText, disabled: none },
    { label: 'Comparer avec un autre PDF…', fn: openCompare, disabled: none },
    { head: 'Plusieurs fichiers' },
    { label: 'Traitement par lot…', fn: openBatch },
  ]);
};
$('settingsbtn').onclick = () => {
  if (closeMenu()) return;
  openMenu(...menuAt($('settingsbtn')), [
    { head: 'Langue' },
    { label: 'Français', on: lang === 'fr', fn: () => setLang('fr') },
    { label: 'English', on: lang === 'en', fn: () => setLang('en') },
    { head: 'Thème' },
    { label: 'Automatique (comme l\'appareil)', on: prefs.theme === 'auto', fn: () => setTheme('auto') },
    { label: 'Clair', on: prefs.theme === 'light', fn: () => setTheme('light') },
    { label: 'Sombre', on: prefs.theme === 'dark', fn: () => setTheme('dark') },
    '-',
    { label: 'Revoir la visite guidée', fn: () => startTour(true), disabled: !pages.length },
    { label: 'Raccourcis clavier', key: '?', fn: showHelp },
    REPORT_KEY && { label: 'Signaler un problème…', fn: openReport },
    { label: 'Réinitialiser mes préférences', fn: resetPrefs },
  ]);
};
