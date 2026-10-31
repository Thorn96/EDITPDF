// Rature · Synchronisation chiffrée de bout en bout (Rature Sync) : signatures, tampons, réglages et documents en cours.
// Clé : tirée d'un code de récupération de 24 caractères (PBKDF2-SHA256, 300 000 tours, sel = identifiant du compte), créé sur le
// premier appareil et jamais envoyé. Chiffrement AES-GCM 256, lié à la place de chaque élément ; le serveur (table vault) ne
// garde que des données illisibles. Nouvel appareil : on saisit le code, ou on scanne le QR code d'un appareil déjà relié
// (le code voyage dans le fragment #cle=…, que le navigateur n'envoie jamais au serveur).
const CODE_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base 32 de Crockford : ni I, ni L, ni O, ni U
const newCode = () => [...crypto.getRandomValues(new Uint8Array(24))].map(x => CODE_ABC[x & 31]).join('').match(/.{4}/g).join('-'); // 120 bits
const normCode = s => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const PREF_SYNC = ['favs', 'font', 'pen', 'hl']; // réglages qui suivent le compte (pas le thème ni la langue, propres à chaque appareil)
const DOCS_MAX = 20; // documents gardés en ligne : les plus récents
const uidOf = () => { try { return JSON.parse(atob(session.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch { return null; } };

// ---------- Chiffrement ----------
var vaultKeys = null; // { aes, mac } du compte connecté, en mémoire seulement (var : lue par syncSoon, appelable avant ce fichier)
async function deriveKeys(code, uid) {
  const enc = new TextEncoder(), base = await crypto.subtle.importKey('raw', enc.encode(normCode(code)), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('rature-sync:' + uid), iterations: 300000 }, base, 512));
  return { aes: await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
           mac: await crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) };
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
// ad : la place de l'élément (« sig:g12 ») ; un serveur qui échangerait deux éléments serait détecté au déchiffrement
async function seal(bytes, ad, keys = vaultKeys) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ad) }, keys.aes, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function unseal(s, ad, keys = vaultKeys) {
  const u = unb64(s);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12), additionalData: new TextEncoder().encode(ad) }, keys.aes, u.subarray(12)));
}
// JSON avec tableaux d'octets (polices, champs de formulaire…)
const toJ = (k, v) => ArrayBuffer.isView(v) ? { $u8: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) } : v;
const fromJ = (k, v) => v && typeof v.$u8 === 'string' ? unb64(v.$u8) : v;
const sealJson = (o, ad, keys) => seal(new TextEncoder().encode(JSON.stringify(o, toJ)), ad, keys);
const openJson = async (s, ad, keys) => JSON.parse(new TextDecoder().decode(await unseal(s, ad, keys)), fromJ);
const hashStr = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
// nom d'un PDF d'origine en ligne : empreinte secrète (HMAC) de son contenu, le même fichier n'est envoyé qu'une fois
const srcId = async bytes => [...new Uint8Array(await crypto.subtle.sign('HMAC', vaultKeys.mac, bytes))].slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join('');

// ---------- Serveur (table vault, protégée par les règles d'accès) ----------
async function vaultApi(query, opts = {}) {
  const t = await accessToken();
  if (!t) throw Object.assign(new Error('connexion'), { code: 'connexion' });
  const r = await fetch(SUPA + '/rest/v1/vault' + query, { ...opts, headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...opts.headers } });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.message || r.status), { status: r.status, code: j.message === 'quota' ? 'quota' : j.code }); }
  const text = await r.text(); // réponse vide quand on écrit (mise à jour d'un élément existant : 200 sans contenu)
  return text ? JSON.parse(text) : null;
}
const vaultPut = rows => vaultApi('?on_conflict=user_id,kind,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows.map(r => ({ user_id: uidOf(), deleted: false, ...r }))) });
const vaultDel = query => vaultApi(query, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

// ---------- État de la synchronisation (ce navigateur) ----------
// pull : date du dernier élément reçu ; seen : empreinte de chaque élément tel qu'il est en ligne ; docs : fiches des documents
let syncSt = null, syncing = null, lastSync = 0;
function loadSyncState() {
  const uid = uidOf();
  try { syncSt = JSON.parse(localStorage.vaultState || 'null'); } catch { syncSt = null; }
  if (syncSt?.uid !== uid) syncSt = { uid, pull: null, seen: {}, docs: {} };
}
const saveSyncState = () => { try { localStorage.vaultState = JSON.stringify(syncSt); } catch {} };
function savedCode() { try { const v = JSON.parse(localStorage.vaultCode || 'null'); return v && v.uid === uidOf() ? v.code : null; } catch { return null; } }
function forgetVault() { // déconnexion ou données effacées : la clé et l'état quittent ce navigateur (signatures et tampons restent)
  vaultKeys = syncSt = null;
  try { localStorage.removeItem('vaultCode'); localStorage.removeItem('vaultState'); } catch {}
  renderCloudDocs();
}

// Éléments de ce navigateur, sous la forme où ils sont synchronisés
function localItems() {
  let fixed = false;
  for (const s of sigs) if (!s.id) { s.id = newId('g'); fixed = true; }
  if (fixed) saveSigs();
  const m = new Map();
  for (const s of sigs) m.set('sig:' + s.id, { src: s.src, ratio: s.ratio });
  for (const s of stamps) m.set('stamp:' + s.id, { ...s });
  m.set('prefs:main', Object.fromEntries(PREF_SYNC.map(k => [k, prefs[k]])));
  return m;
}
function applyRemote(kind, id, val) {
  const list = kind === 'sig' ? sigs : kind === 'stamp' ? stamps : null;
  if (kind === 'prefs') { if (val) Object.assign(prefs, val); return; }
  if (!list) return;
  const i = list.findIndex(s => s.id === id);
  if (!val) { if (i >= 0) list.splice(i, 1); }
  else if (i >= 0) list[i] = { ...val, id };
  else list.push({ ...val, id });
}

async function syncNow() {
  if (!vaultKeys || !session) return;
  return syncing ||= syncRun().catch(syncError).finally(() => syncing = null);
}
async function syncRun() {
  // 0. La clé de ce navigateur est-elle toujours celle du compte ? (données effacées puis réactivées ailleurs avec un autre code)
  const [check] = await vaultApi('?select=data&kind=eq.check&id=eq.key');
  if (!check || await openJson(check.data, 'check:key').catch(() => null) !== 'rature-ok') {
    forgetVault();
    if ($('accountdlg').open) renderSync(true);
    return toast('La synchronisation a été réinitialisée depuis un autre appareil : relie celui-ci avec le nouveau code.', '', null, 8000);
  }
  // 1. Ce qui a changé sur les autres appareils (avec une minute de recouvrement : écritures simultanées)
  const since = syncSt.pull ? new Date(Date.parse(syncSt.pull) - 60000).toISOString() : '1970-01-01T00:00:00Z';
  const rows = await vaultApi(`?select=kind,id,data,deleted,updated_at&kind=in.(sig,stamp,prefs,doc)&updated_at=gt.${encodeURIComponent(since)}&order=updated_at`);
  const touched = new Set();
  for (const r of rows) {
    const key = r.kind + ':' + r.id;
    try {
      if (r.kind === 'doc') {
        if (r.deleted) delete syncSt.docs[r.id]; else syncSt.docs[r.id] = await openJson(r.data, key);
      } else if (r.deleted) {
        if (key in syncSt.seen) { applyRemote(r.kind, r.id, null); delete syncSt.seen[key]; touched.add(r.kind); }
      } else {
        const val = await openJson(r.data, key), h = hashStr(JSON.stringify(val));
        if (syncSt.seen[key] !== h) { applyRemote(r.kind, r.id, val); syncSt.seen[key] = h; touched.add(r.kind); }
      }
    } catch (e) { console.warn('Élément illisible ignoré', key, e); } // un élément abîmé ne bloque pas les autres
    syncSt.pull = r.updated_at;
  }
  if (touched.has('sig')) { saveSigs(); renderSigs(); }
  if (touched.has('stamp')) { saveStamps(); renderStamps(); }
  if (touched.has('prefs')) { savePrefs(); applyPrefs(); }
  saveSyncState();
  // 2. Ce qui a changé ici : ajouts, modifications, suppressions
  const local = localItems(), seen = { ...syncSt.seen }, out = [];
  for (const [key, val] of local) {
    const h = hashStr(JSON.stringify(val));
    if (seen[key] === h) continue;
    const [kind, id] = key.split(/:(.*)/s);
    out.push({ kind, id, data: await sealJson(val, key) });
    seen[key] = h;
  }
  for (const key of Object.keys(seen)) if (!local.has(key)) { const [kind, id] = key.split(/:(.*)/s); out.push({ kind, id, data: '', deleted: true }); delete seen[key]; }
  if (out.length) await vaultPut(out);
  syncSt.seen = seen;
  saveSyncState();
  lastSync = Date.now();
  renderCloudDocs();
  if ($('accountdlg').open) renderSyncState();
}
function syncError(e) {
  if (e.code === 'quota') toast('Espace Rature Sync plein (200 Mo) : supprime d’anciens documents synchronisés.', 'error', null, 8000);
  else if (e.status === 401 || e.status === 403 || e.code === 'connexion' || e.code === '42501') console.info('Synchronisation suspendue (connexion ou abonnement)');
  else console.warn('Synchronisation impossible', e);
}
// Après une modification locale (signature, tampon, réglage) : envoi groupé quelques secondes plus tard
var syncSoonT;
function syncSoon() { if (!vaultKeys) return; clearTimeout(syncSoonT); syncSoonT = setTimeout(syncNow, 3000); }
addEventListener('focus', () => { if (vaultKeys && Date.now() - lastSync > 30000) syncNow(); }); // retour sur l'onglet : on se met à jour

// ---------- Documents en cours ----------
// La sauvegarde automatique envoie aussi le document (au plus toutes les 8 s) : son état chiffré, et ses PDF d'origine
// une seule fois chacun. Les plus anciens au-delà de DOCS_MAX sont retirés.
var docPushT;
function docChanged() { if (!vaultKeys || !pages.length) return; clearTimeout(docPushT); docPushT = setTimeout(() => pushDoc().catch(syncError), 8000); }
addEventListener('visibilitychange', () => { if (document.hidden && docPushT) { clearTimeout(docPushT); docPushT = null; pushDoc().catch(syncError); } });
async function pushDoc() {
  docPushT = null;
  if (!vaultKeys || !pages.length) return;
  const s = snapshot(), refs = [];
  for (const src of s.sources) {
    const id = await srcId(src.bytes);
    refs.push(id);
    if (!(await vaultApi(`?select=id&kind=eq.src&id=eq.${id}`)).length) await vaultPut([{ kind: 'src', id, data: await seal(src.bytes, 'src:' + id) }]);
  }
  const state = { ...s, sources: s.sources.map(({ bytes, ...x }, i) => ({ ...x, ref: refs[i] })) };
  const meta = { name: s.name, t: s.t, pages: s.pages.length, refs };
  await vaultPut([{ kind: 'docstate', id: s.id, data: await sealJson(state, 'docstate:' + s.id) }, { kind: 'doc', id: s.id, data: await sealJson(meta, 'doc:' + s.id) }]);
  syncSt.docs[s.id] = meta;
  saveSyncState();
  const old = Object.entries(syncSt.docs).sort((a, b) => b[1].t - a[1].t).slice(DOCS_MAX).map(([id]) => id);
  if (old.length) await removeCloudDocs(old);
  else renderCloudDocs();
}
async function removeCloudDocs(ids) {
  await vaultPut(ids.map(id => ({ kind: 'doc', id, data: '', deleted: true }))); // les autres appareils les retirent aussi
  await vaultDel(`?kind=eq.docstate&id=in.(${ids.join(',')})`);
  ids.forEach(id => delete syncSt.docs[id]);
  saveSyncState();
  // PDF d'origine qui ne servent plus à aucun document
  const used = new Set(Object.values(syncSt.docs).flatMap(d => d.refs || []));
  const orphans = (await vaultApi('?select=id&kind=eq.src')).map(r => r.id).filter(id => !used.has(id));
  if (orphans.length) await vaultDel(`?kind=eq.src&id=in.(${orphans.join(',')})`);
  renderCloudDocs();
}
async function openCloudDoc(id) {
  const [row] = await vaultApi(`?select=data&kind=eq.docstate&id=eq.${id}`);
  if (!row) throw new Error('document absent');
  const state = await openJson(row.data, 'docstate:' + id), refs = [...new Set(state.sources.map(x => x.ref))];
  const bytes = {};
  for (const r of await vaultApi(`?select=id,data&kind=eq.src&id=in.(${refs.join(',')})`)) bytes[r.id] = await unseal(r.data, 'src:' + r.id);
  if (refs.some(r => !bytes[r])) throw new Error('PDF d’origine absent');
  state.sources = state.sources.map(({ ref, ...x }) => ({ ...x, bytes: bytes[ref] }));
  if (pages.length) newTab(); // le document affiché reste dans son onglet
  await restore(state);
}
function renderCloudDocs() {
  const docs = vaultKeys && syncSt ? Object.entries(syncSt.docs).sort((a, b) => b[1].t - a[1].t).slice(0, 8) : [];
  $('clouddocs').hidden = !docs.length;
  $('clouddoclist').replaceChildren(...docs.map(([id, d]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span><b></b><small></small></span><button class="btn">${esc(tr('Ouvrir'))}</button><button class="btn icon ghost" title="${esc(tr('Retirer de la synchronisation'))}"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    li.querySelector('b').textContent = d.name || tr('Document');
    li.querySelector('small').textContent = `${plural(d.pages, '{n} page', '{n} pages')} · ${new Date(d.t).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
    const [open, del] = li.querySelectorAll('button');
    open.onclick = async () => {
      open.classList.add('busy');
      try { await openCloudDoc(id); toast('Document repris là où tu l’avais laissé'); track('sync', { etape: 'document' }); }
      catch (e) { console.error(e); toast('Impossible d’ouvrir ce document synchronisé.', 'error'); }
      finally { open.classList.remove('busy'); }
    };
    del.onclick = async () => {
      if (!await ask({ title: 'Retirer ce document', text: 'Il ne sera plus synchronisé, sur aucun de tes appareils. Les fichiers déjà téléchargés ne changent pas.',
                       buttons: [{ label: 'Annuler', value: false }, { label: 'Retirer', value: true, danger: true }] })) return;
      removeCloudDocs([id]).catch(syncError);
    };
    return li;
  }));
}

// ---------- Mise en route (fenêtre « Mon compte ») ----------
let draftCode = null; // code affiché pendant l'activation, pas encore confirmé
const syncView = v => ['syncsetup', 'synccodebox', 'syncunlock', 'syncon'].forEach(id => $(id).hidden = id !== v);
function renderSyncState() {
  $('syncstate').textContent = lastSync ? tr('active · à jour à {h}', { h: new Date(lastSync).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) }) : tr('active');
}
async function renderSync(active) {
  $('syncbox').hidden = !active;
  if (!active) return;
  if (vaultKeys) { syncView('syncon'); renderSyncState(); return; }
  if (draftCode) return syncView('synccodebox');
  $('syncstate').textContent = '';
  let exists;
  try { exists = (await vaultApi('?select=id&kind=eq.check&id=eq.key')).length > 0; } catch { return; }
  syncView(exists ? 'syncunlock' : 'syncsetup');
  const pending = sessionStorage.pendingCode;
  if (exists && pending) { $('synccodein').value = pending; unlockVault(); }
}
// Premier appareil : un code est créé et montré ; il ne sert qu'une fois noté
$('syncenable').onclick = () => {
  draftCode = newCode();
  $('syncdraft').textContent = draftCode;
  syncView('synccodebox');
};
$('synccopy').onclick = () => navigator.clipboard?.writeText(draftCode || savedCode() || '').then(() => toast('Code copié'));
$('syncnoted').onclick = async () => {
  const b = $('syncnoted'), uid = uidOf();
  b.classList.add('busy');
  try {
    const keys = await deriveKeys(draftCode, uid);
    // insertion simple : si un autre appareil a activé entre-temps, le serveur refuse et on passe au déverrouillage
    await vaultApi('', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: uid, kind: 'check', id: 'key', data: await sealJson('rature-ok', 'check:key', keys) }]) });
    startVault(draftCode, keys);
    draftCode = null;
    acctSay('Synchronisation activée ✓');
    track('sync', { etape: 'active' });
  } catch (e) {
    draftCode = null;
    acctSay(e.status === 409 ? 'Ce compte a déjà un code : saisis-le.' : 'Activation impossible pour le moment. Réessaie.', true);
    renderSync(true);
  } finally { b.classList.remove('busy'); }
};
async function unlockVault() {
  const code = $('synccodein').value, uid = uidOf(), b = $('syncunlockgo');
  if (normCode(code).length !== 24) return acctSay('Le code fait 24 caractères (6 groupes de 4).', true);
  b.classList.add('busy');
  try {
    const keys = await deriveKeys(code, uid), [row] = await vaultApi('?select=data&kind=eq.check&id=eq.key');
    if ((await openJson(row.data, 'check:key', keys)) !== 'rature-ok') throw new Error('code');
    sessionStorage.removeItem('pendingCode');
    startVault(normCode(code).match(/.{4}/g).join('-'), keys);
    acctSay('Appareil relié ✓ Tes signatures et documents arrivent.');
    track('sync', { etape: 'appareil' });
  } catch (e) {
    acctSay(e.code === 'connexion' ? 'Reconnecte-toi.' : 'Code incorrect. Vérifie-le (6 groupes de 4 caractères).', true);
  } finally { b.classList.remove('busy'); }
}
$('syncunlockgo').onclick = unlockVault;
$('synccodein').onkeydown = e => { if (e.key === 'Enter') unlockVault(); };
function startVault(code, keys) {
  try { localStorage.vaultCode = JSON.stringify({ uid: uidOf(), code }); } catch {}
  vaultKeys = keys;
  loadSyncState();
  syncView('syncon');
  renderSyncState();
  syncNow().then(docChanged);
}
$('syncnow').onclick = async () => { const b = $('syncnow'); b.classList.add('busy'); await syncNow(); await (docPushT ? pushDoc().catch(syncError) : null); b.classList.remove('busy'); };
// Ajouter un appareil : le code, et son QR code à scanner avec un téléphone
$('syncshow').onclick = async () => {
  const code = savedCode();
  if (!code) return;
  await loadScript(here(QR_LIB));
  const qr = qrcode(0, 'M');
  qr.addData(`${location.origin}${lang === 'en' ? '/en/' : '/'}?sync=1#cle=${code}`);
  qr.make();
  ask({ title: 'Ton code de récupération', text: 'Saisis-le sur ton autre appareil (Mon compte), ou scanne ce QR code avec ton téléphone. Garde-le pour toi : il ouvre tes données.',
        html: `<div class="synccodeshow"><code>${esc(code)}</code>${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>`,
        buttons: [{ label: 'Fermer', value: true, primary: true }] });
};
$('syncwipe').onclick = async () => {
  if (!await ask({ title: 'Effacer mes données en ligne', text: 'Tes signatures, tampons et documents synchronisés sont effacés du serveur. Ils restent dans ce navigateur. Il faudra réactiver la synchronisation, avec un nouveau code.',
                   buttons: [{ label: 'Annuler', value: false }, { label: 'Tout effacer', value: true, danger: true }] })) return;
  try { await vaultDel(`?user_id=eq.${uidOf()}`); forgetVault(); acctSay('Données en ligne effacées.'); renderSync(true); }
  catch { acctSay('Effacement impossible pour le moment. Réessaie.', true); }
};

// Démarrage : clé déjà connue ici, ou code arrivé par le QR code (#cle=…)
function codeFromUrl() {
  const m = location.hash.match(/cle=([0-9A-Za-z-]+)/);
  if (!m) return;
  sessionStorage.pendingCode = m[1];
  history.replaceState(null, '', location.pathname + location.search); // le code ne reste pas dans l'adresse
  if (syncOn && !vaultKeys) openAccount(); // connexion si besoin, puis l'appareil se relie tout seul
}
addEventListener('hashchange', codeFromUrl); // QR code ouvert dans un onglet déjà ouvert sur Rature
async function startSync() {
  codeFromUrl();
  const code = session && savedCode();
  if (!code) return;
  try { vaultKeys = await deriveKeys(code, uidOf()); loadSyncState(); renderCloudDocs(); syncNow(); } catch (e) { console.warn(e); }
}
