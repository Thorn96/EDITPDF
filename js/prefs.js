// Rature · Préférences mémorisées, thème, couleurs favorites, langue, visite guidée
const PREFS0 = { tool: 'text', font: 'arial', bold: false, italic: false, size: 11, width: 1.5, pen: '#000000', hl: '#ffd84d',
                 theme: 'auto', lang: '', favs: [], tour: false };
let prefs = { ...PREFS0 };
try { prefs = { ...PREFS0, ...JSON.parse(localStorage.prefs || '{}') }; } catch {}
const savePrefs = () => { try { localStorage.prefs = JSON.stringify(prefs); } catch {} };
// Les derniers réglages utilisés deviennent ceux des prochains éléments
let prefsT;
function prefsChanged() {
  clearTimeout(prefsT);
  prefsT = setTimeout(() => {
    const f = $('font').value;
    Object.assign(prefs, { tool: tool === 'crop' ? prefs.tool : tool, size: +$('size').value, width: +$('width').value, pen: penColor, hl: hlColor,
                           bold: $('bold').classList.contains('on'), italic: $('italic').classList.contains('on'), ...(FONTS[f] && { font: f }) });
    savePrefs();
  }, 300);
}
function applyPrefs() {
  lang = prefs.lang || (navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en');
  document.documentElement.lang = lang;
  penColor = prefs.pen; hlColor = prefs.hl;
  $('size').value = prefs.size;
  $('width').value = prefs.width;
  if (FONTS[prefs.font]) $('font').value = prefs.font;
  $('bold').classList.toggle('on', !!prefs.bold);
  $('italic').classList.toggle('on', !!prefs.italic);
  renderFavs();
  setTheme(prefs.theme);
}
async function resetPrefs() {
  const ok = await ask({ title: 'Réinitialiser mes préférences', text: 'Outil, couleurs, police, thème et langue reviennent aux réglages de départ. Tes signatures et tampons sont conservés.',
                         buttons: [{ label: 'Annuler', value: false }, { label: 'Réinitialiser', value: true, primary: true }] });
  if (!ok) return;
  prefs = { ...PREFS0, tour: prefs.tour };
  savePrefs();
  applyPrefs();
  setLang(lang);
  setTool('text');
  toast('Préférences réinitialisées');
}

// ---------- Thème ----------
const THEME_ICON = {
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
};
function setTheme(t) {
  prefs.theme = THEME_ICON[t] ? t : 'auto';
  savePrefs();
  if (prefs.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = prefs.theme;
  $('themebtn').querySelector('svg').innerHTML = THEME_ICON[prefs.theme];
  $('themebtn').title = tr({ auto: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre' }[prefs.theme]);
}
$('themebtn').onclick = () => setTheme({ auto: 'light', light: 'dark', dark: 'auto' }[prefs.theme]);

// ---------- Couleurs favorites (choisies avec la palette libre) ----------
const PRESETS = ['#000000', '#1d3fbf', '#c62828', '#2e7d32', '#ffd84d'];
function renderFavs() {
  $('favs').replaceChildren(...prefs.favs.map(c => {
    const b = Object.assign(document.createElement('button'), { className: 'sw fav', title: tr('Couleur favorite (clic droit : retirer)') });
    b.dataset.c = c;
    b.style.setProperty('--c', c);
    b.oncontextmenu = e => { e.preventDefault(); prefs.favs = prefs.favs.filter(x => x !== c); savePrefs(); renderFavs(); };
    return b;
  }));
  showColor($('color').value);
}
function addFavColor(c) {
  if (PRESETS.includes(c)) return;
  prefs.favs = [c, ...prefs.favs.filter(x => x !== c)].slice(0, 4);
  savePrefs();
  renderFavs();
}

// ---------- Langue ----------
function setLang(l) {
  prefs.lang = lang = l;
  savePrefs();
  document.documentElement.lang = l;
  translateDOM();
  setTool(tool === 'crop' ? 'move' : tool);
  setTheme(prefs.theme);
  renderSigs();
  renderStamps();
  renderFavs();
  mount();
  pages.forEach(p => { const b = p.wrap.querySelector('.ocr'); b.lastChild.textContent = tr('Page scannée · Reconnaître le texte'); });
}

// ---------- Visite guidée ----------
const TOUR = [
  ['#tools', 'Tes outils : texte, correction du texte du PDF, coches, surligneur, formes, champs de formulaire… Survole un bouton pour voir son raccourci clavier.'],
  ['#props', 'Les réglages de l\'outil ou de l\'élément sélectionné : couleur, police, taille, rotation, opacité…'],
  ['.side.left', 'Tes pages : glisse-les pour les réorganiser. Clic droit sur une page pour la dupliquer, la pivoter ou la recadrer.'],
  ['.side.right', 'Tes signatures et tampons : crée-les une fois, puis pose-les d\'un clic ou en les glissant sur la page.'],
  ['#toolsbtn', 'Plus d\'outils : vue en grille, découpage, filigrane, extraction du texte, comparaison, traitement par lot.'],
  ['#settingsbtn', 'Langue, thème clair ou sombre, et cette visite si tu veux la revoir.'],
  ['#save', 'Quand c\'est prêt : télécharge, partage, compresse ou protège ton PDF par mot de passe.'],
];
let tourI = 0, tourSteps = [];
function maybeTour() { if (!prefs.tour && pages.length && !document.querySelector('dialog[open]')) startTour(); }
function startTour() {
  tourSteps = TOUR.filter(([sel]) => { const el = document.querySelector(sel); return el && !el.hidden && el.getClientRects().length && getComputedStyle(el).display !== 'none'; });
  if (!tourSteps.length) return;
  tourI = 0;
  $('tour').hidden = false;
  showTourStep();
}
function showTourStep() {
  const [sel, text] = tourSteps[tourI], r = document.querySelector(sel).getBoundingClientRect(), pad = 6, tip = $('tour').querySelector('.tour-tip');
  Object.assign($('tour').querySelector('.tour-hole').style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
  $('tourtext').textContent = tr(text);
  $('tourstep').textContent = `${tourI + 1} / ${tourSteps.length}`;
  $('tournext').textContent = tr(tourI === tourSteps.length - 1 ? 'Terminer' : 'Suivant');
  const tw = Math.min(320, innerWidth - 24);
  let x = r.right + 16, y = r.top;
  if (x + tw > innerWidth - 12) x = r.left - tw - 16;
  if (x < 12) { x = clamp(r.left, 12, innerWidth - tw - 12); y = r.bottom + 14; }
  Object.assign(tip.style, { left: x + 'px', width: tw + 'px' });
  tip.style.top = clamp(y, 12, innerHeight - tip.offsetHeight - 12) + 'px';
}
function endTour() { $('tour').hidden = true; prefs.tour = true; savePrefs(); }
$('tournext').onclick = () => ++tourI < tourSteps.length ? showTourStep() : endTour();
$('tourskip').onclick = endTour;
addEventListener('resize', () => { if (!$('tour').hidden) showTourStep(); });
addEventListener('keydown', e => { if (!$('tour').hidden && e.key === 'Escape') endTour(); });
