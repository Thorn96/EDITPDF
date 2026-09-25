// Rature · Onglets : plusieurs documents ouverts à la fois.
// L'onglet affiché vit dans les variables globales (pages, items…) ; les autres gardent leur état de côté.
const tabs = [null]; // état des onglets en arrière-plan (celui de l'onglet affiché : null)
let tabAt = 0, openInNewTab = false;
const tabState = () => ({ sources, pages, items, past, future, deco, bookmarks, expname: $('expname').value, Z, scroll: $('pages').scrollTop });
function applyTab(s) {
  select(null);
  closeFind();
  closeGrid?.();
  closeMenu();
  ({ sources, pages, items, past, future, deco, bookmarks } = s);
  $('expname').value = s.expname || '';
  mount();
  setZoom(s.Z);
  $('pages').scrollTop = s.scroll;
  $('undo').disabled = !past.length;
  $('redo').disabled = !future.length;
  renderTabs();
  changed(); // la sauvegarde automatique suit l'onglet affiché
}
function switchTab(i) {
  if (i === tabAt || !tabs[i]) return;
  tabs[tabAt] = tabState();
  tabAt = i;
  const s = tabs[i];
  tabs[i] = null;
  applyTab(s);
}
// Nouvel onglet vide : le document ouvert juste après s'y charge
function newTab() {
  if (!pages.length) return;
  tabs[tabAt] = tabState();
  tabs.push(null);
  tabAt = tabs.length - 1;
  resetDoc();
  deco = { ...DECO0 };
  $('expname').value = '';
  renderTabs();
}
async function closeTab(i) {
  const s = i === tabAt ? tabState() : tabs[i];
  if (s.past.length && !await ask({ title: 'Fermer l\'onglet', text: tr('Les modifications de « {name} » seront perdues si tu ne l\'as pas téléchargé.', { name: tabName(s) }),
                                    buttons: [{ label: 'Annuler', value: false }, { label: 'Fermer', value: true, danger: true }] })) return;
  if (tabs.length === 1) { resetDoc(); return renderTabs(); }
  tabs.splice(i, 1);
  if (i === tabAt) { tabAt = Math.min(i, tabs.length - 1); const n = tabs[tabAt]; tabs[tabAt] = null; applyTab(n); }
  else { if (i < tabAt) tabAt--; renderTabs(); }
}
const tabName = s => [...new Set(s.pages.map(p => p.src.name))].join(' + ') || tr('Nouvel onglet');
function renderTabs() {
  const many = tabs.length > 1;
  $('tabbar').hidden = !many;
  $('fname').hidden = many;
  if (!many) return;
  $('tabbar').replaceChildren(...tabs.map((s, i) => {
    const b = document.createElement('div'), name = i === tabAt ? tabName({ pages }) : tabName(s);
    b.className = 'tab' + (i === tabAt ? ' on' : '');
    b.innerHTML = `<span></span><button title="${esc(tr('Fermer l\'onglet'))}">✕</button>`;
    b.firstChild.textContent = name;
    b.title = name;
    b.onclick = e => e.target.closest('button') ? closeTab(i) : switchTab(i);
    return b;
  }), Object.assign(document.createElement('button'), { className: 'tab add', textContent: '+', title: tr('Ouvrir un PDF dans un nouvel onglet'), onclick: () => { openInNewTab = true; $('file').click(); } }));
}
