// Rature · Compte Rature Sync : connexion par un code reçu par e-mail (sans mot de passe), abonnement par Stripe.
// La session (jetons Supabase) est gardée dans ce navigateur. Rien n'est envoyé tant qu'on ne se connecte pas.
// Avant l'ouverture des ventes, le compte n'apparaît qu'en développement ou après une visite avec ?sync=1 (mémorisé).
// Jour du lancement : SYNC_LAUNCHED = true ici ET SALES_OPEN = true dans guides/legal.js (boutons de la page de tarif).
const SYNC_LAUNCHED = true;
const AUTH = SUPA + '/auth/v1', BILLING = SUPA + '/functions/v1/billing', ACTIVE_SUB = ['active', 'trialing', 'past_due'];
const syncOn = SYNC_LAUNCHED || (() => {
  try { if (new URLSearchParams(location.search).has('sync')) localStorage.syncBeta = '1'; return location.hostname === 'localhost' || localStorage.syncBeta === '1'; }
  catch { return location.hostname === 'localhost'; }
})();

// ---------- Session ----------
let session = null, refreshing = null;
try { session = JSON.parse(localStorage.session || 'null'); } catch {}
function saveSession(s) { session = s; try { if (s) localStorage.session = JSON.stringify(s); else localStorage.removeItem('session'); } catch {} }
const keep = j => saveSession({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() / 1000 + j.expires_in, email: j.user?.email ?? session?.email });

async function auth(path, body, bearer) {
  const r = await fetch(AUTH + path, { method: 'POST', body: JSON.stringify(body || {}),
    headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json', ...(bearer && { Authorization: 'Bearer ' + bearer }) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.msg || j.error_description || j.message || r.status), { status: r.status, code: j.error_code || j.code });
  return j;
}
// Jeton valide, rafraîchi s'il expire dans moins d'une minute ; null si déconnecté.
// Un seul rafraîchissement à la fois : le jeton de rafraîchissement ne sert qu'une fois.
async function accessToken() {
  if (!session) return null;
  if (session.exp - Date.now() / 1000 > 60) return session.access;
  try {
    keep(await (refreshing ||= auth('/token?grant_type=refresh_token', { refresh_token: session.refresh }).finally(() => refreshing = null)));
    return session.access;
  } catch (e) {
    if (e.status) saveSession(null); // session refusée par le serveur ; hors ligne, on la garde
    return null;
  }
}
async function mySubscription() {
  const t = await accessToken();
  if (!t) return null;
  const r = await fetch(SUPA + '/rest/v1/subscriptions?select=status,plan,period_end,cancel_at_period_end', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + t } });
  return r.ok ? (await r.json())[0] || null : null;
}
async function billing(route, body) {
  const t = await accessToken();
  if (!t) throw Object.assign(new Error('connexion'), { code: 'connexion' });
  const r = await fetch(BILLING + '/' + route, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, lang }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { code: j.error });
  return j;
}

// ---------- Fenêtre « Mon compte » ----------
let codeSent = false, wantPlan = null; // wantPlan : offre choisie avant la connexion (page de tarif), payée juste après
var premium = false; // abonné Rature Sync en règle (connu dès qu'on a vérifié l'abonnement) ; var : lu par app.js au téléchargement
// Avantages de Rature Sync, montrés dans « Mon compte » (non abonné) et dans la proposition après un téléchargement
const PERKS = [
  ['M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z', 'Chiffré de bout en bout', 'Personne d’autre que toi ne peut lire tes fichiers, pas même Rature.'],
  ['M3 17c3-1 4-6 6-6s1 5 3 5 3-3 4-3 1.5 2 5 2', 'Tes signatures et tampons partout', 'Crée-les une fois, retrouve-les sur ton ordinateur, ton portable et ton téléphone.'],
  ['M4 4h10l6 6v10H4zM14 4v6h6', 'Reprends tes documents là où tu t’es arrêté', 'Commencé au bureau, fini à la maison : tes corrections restent modifiables.'],
  ['M12 3v4M12 17v4M3 12h4M17 12h4', 'Tes réglages te suivent', 'Couleurs favorites, police, couleurs du stylo et du surligneur.'],
];
function renderPerks() {
  document.querySelectorAll('[data-perks]').forEach(ul => ul.replaceChildren(...PERKS.map(([d, t, x]) => {
    const li = document.createElement('li');
    li.innerHTML = `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg><span><b></b><small></small></span>`;
    li.querySelector('b').textContent = tr(t);
    li.querySelector('small').textContent = tr(x);
    return li;
  })));
}
function setPremium(on) {
  premium = !!on;
  document.body.classList.toggle('premium', premium);
  $('accountbtn').title = $('accountbtn').ariaLabel = tr(premium ? 'Mon compte · Rature Sync actif' : 'Mon compte');
  $('acctbadge').hidden = !premium;
  $('acctperks').hidden = $('acctpitch').hidden = premium; // l'abonné n'a plus besoin qu'on lui vende Rature Sync
}
// Après un téléchargement : proposition de Rature Sync à qui n'est pas abonné
function showUpsell() {
  if (premium || !syncOn || document.querySelector('dialog[open]')) return;
  $('upselldlg').showModal();
  track('proposition', { etape: 'vue' });
}
$('upselldlg').onclick = e => {
  const p = e.target.closest('[data-plan]')?.dataset.plan;
  if (p) { $('upselldlg').close(); track('proposition', { etape: 'offre', plan: p }); openAccount(p); }
};
$('upsellsignin').onclick = () => { $('upselldlg').close(); openAccount(); };
$('upselllater').onclick = () => $('upselldlg').close();
const acctSay = (t, err) => { $('acctmsg').textContent = t ? tr(t) : ''; $('acctmsg').classList.toggle('err', !!err); };
const fmtDate = iso => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function renderAccount() {
  const logged = !!session;
  if (!logged) $('syncbox').hidden = true;
  $('acctlogin').hidden = logged;
  $('acctinfo').hidden = !logged;
  $('acctlogout').hidden = !logged;
  $('acctcodebox').hidden = !codeSent;
  if (!logged) {
    $('acctgo').hidden = false;
    $('acctgo').textContent = tr(codeSent ? 'Se connecter' : 'Recevoir un code');
    return;
  }
  $('acctwho').textContent = session.email || '';
  $('acctstatus').textContent = tr('Vérification de l’abonnement…');
  $('acctplans').hidden = $('acctgo').hidden = true;
  const sub = await mySubscription().catch(() => null);
  if (!session) return renderAccount(); // session expirée entre-temps
  const active = sub && ACTIVE_SUB.includes(sub.status);
  setPremium(active);
  $('acctplans').hidden = active;
  $('acctgo').hidden = !sub; // un ancien abonné garde l'accès à ses factures
  $('acctgo').textContent = tr('Gérer mon abonnement');
  $('acctstatus').textContent = !active ? tr('Pas d’abonnement Rature Sync pour l’instant.')
    : tr(sub.cancel_at_period_end ? 'Rature Sync actif ({p}) jusqu’au {d}, puis arrêté.' : 'Rature Sync actif ({p}), renouvelé le {d}.',
         { p: tr(sub.plan === 'year' ? 'annuel' : 'mensuel'), d: sub.period_end ? fmtDate(sub.period_end) : '…' });
  if (sub?.status === 'past_due') $('acctstatus').textContent += ' ' + tr('Le dernier paiement a échoué : mets à jour ta carte.');
  renderSync(active);
  return active;
}
async function openAccount(plan) {
  if (plan) wantPlan = plan;
  acctSay('');
  $('accountdlg').showModal();
  const active = await renderAccount();
  if (!session) $('acctemail').focus();
  else if (wantPlan && !active) { const p = wantPlan; wantPlan = null; subscribe(p); }
}

async function sendCode() {
  const email = $('acctemail').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return acctSay('Adresse e-mail invalide.', true);
  $('acctgo').classList.add('busy');
  try {
    await auth('/otp', { email, create_user: true });
    codeSent = true;
    acctSay('Code envoyé : regarde ta boîte mail (et les indésirables).');
    renderAccount();
    $('acctcode').value = '';
    $('acctcode').focus();
  } catch (e) {
    acctSay(e.status === 429 ? 'Patiente une minute avant de demander un nouveau code.' : e.status ? 'Envoi du code impossible. Réessaie dans un instant.' : 'Pas de connexion Internet ?', true);
  } finally { $('acctgo').classList.remove('busy'); }
}
async function verifyCode() {
  const email = $('acctemail').value.trim(), token = $('acctcode').value.replace(/\D/g, '');
  if (token.length < 6) return acctSay('Saisis le code reçu par e-mail.', true);
  $('acctgo').classList.add('busy');
  try {
    keep(await auth('/verify', { type: 'email', email, token }));
    codeSent = false;
    acctSay('');
    track('compte', { etape: 'connecte' });
    const active = await renderAccount();
    if (wantPlan && !active) { const p = wantPlan; wantPlan = null; subscribe(p); }
  } catch (e) {
    acctSay(e.status ? 'Code incorrect ou expiré. Vérifie-le, ou demande un nouveau code.' : 'Pas de connexion Internet ?', true);
  } finally { $('acctgo').classList.remove('busy'); }
}
async function subscribe(plan) {
  acctSay('Ouverture de la page de paiement…');
  try {
    const { url } = await billing('checkout', { plan });
    track('abonnement', { etape: 'paiement', plan });
    location.href = url; // page de paiement Stripe, puis retour sur Rature (?sync=merci)
  } catch (e) {
    acctSay(e.code === 'deja_abonne' ? 'Tu es déjà abonné.' : e.code === 'connexion' ? 'Reconnecte-toi.' : 'Paiement indisponible pour le moment. Réessaie dans un instant.', true);
    renderAccount();
  }
}
async function managePlan() {
  acctSay('Ouverture de la gestion de l’abonnement…');
  try { location.href = (await billing('portal')).url; }
  catch { acctSay('Gestion de l’abonnement indisponible pour le moment.', true); }
}
async function logout() {
  const t = session?.access;
  forgetVault(); // la clé de chiffrement quitte ce navigateur avec la session
  setPremium(false);
  saveSession(null);
  codeSent = false;
  acctSay('Déconnecté.');
  renderAccount();
  if (t) auth('/logout', {}, t).catch(() => {}); // révoque la session côté serveur aussi
}

$('accountbtn').hidden = !syncOn;
renderPerks();
if (session && syncOn) mySubscription().then(s => setPremium(s && ACTIVE_SUB.includes(s.status))).catch(() => {}); // badge dès l'ouverture
$('accountbtn').onclick = () => openAccount();
$('acctgo').onclick = () => !session ? (codeSent ? verifyCode() : sendCode()) : managePlan();
$('acctemail').oninput = () => { if (codeSent) { codeSent = false; acctSay(''); renderAccount(); } }; // autre adresse : nouveau code
$('acctemail').onkeydown = e => { if (e.key === 'Enter') sendCode(); };
$('acctcode').onkeydown = e => { if (e.key === 'Enter') verifyCode(); };
$('acctplans').onclick = e => { const p = e.target.closest('[data-plan]')?.dataset.plan; if (p) subscribe(p); };
$('acctlogout').onclick = logout;
$('acctclose').onclick = () => $('accountdlg').close();

// Retour de la page de paiement (?sync=merci), ou arrivée depuis la page de tarif (?abonnement=month|year)
async function accountFromUrl() {
  const q = new URLSearchParams(location.search), plan = q.get('abonnement');
  if (!syncOn || !(q.get('sync') === 'merci' || plan === 'month' || plan === 'year')) return;
  history.replaceState(null, '', location.pathname);
  if (plan) return openAccount(plan);
  openAccount();
  // Stripe prévient Rature quelques secondes après le paiement : on attend l'activation
  for (let i = 0; i < 10 && !(await renderAccount()); i++) {
    acctSay('Merci ! Activation de ton abonnement…');
    await new Promise(r => setTimeout(r, 1500));
  }
  if (await renderAccount()) { acctSay('Bienvenue dans Rature Sync ✓'); track('abonnement', { etape: 'actif' }); }
  else acctSay('Paiement reçu : l’abonnement s’active dans un instant. Rouvre cette fenêtre dans une minute.');
}
