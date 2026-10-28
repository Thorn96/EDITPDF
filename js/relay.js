// Rature · Numériser avec le téléphone : l'ordinateur affiche un QR code, le téléphone photographie la feuille (ou une signature, un tampon),
// le résultat arrive sur l'ordinateur. Connexion directe entre les deux appareils (WebRTC, chiffrée de bout en bout). Le serveur public PeerJS
// sert seulement à les mettre en relation : il ne voit jamais les documents.
const PEER_LIB = 'lib/peerjs/peerjs.min.js', QR_LIB = 'lib/qrcode/qrcode.js';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
// Réseaux qui bloquent la liaison directe (box qui isolent les appareils du Wi-Fi, opérateurs mobiles, entreprises) : relais TURN Cloudflare,
// dont /api/turn fournit des accès temporaires (api/turn.js). Les données y passent chiffrées. Sans relais configuré : liaison directe seule.
let iceP = null;
const iceServers = () => iceP ??= Promise.race([fetch('/api/turn').then(r => r.ok ? r.json() : null), new Promise(ok => setTimeout(ok, 3000))])
  .then(j => Array.isArray(j?.iceServers) && j.iceServers.length ? [...ICE, ...j.iceServers] : ICE).catch(() => ICE);
const newPeer = async () => {
  const [config] = await Promise.all([iceServers().then(iceServers => ({ iceServers })), loadScript(here(PEER_LIB))]);
  const p = new Peer({ config });
  await new Promise((ok, ko) => { p.on('open', ok); p.on('error', ko); });
  return p;
};
const isPdfBytes = b => b.length > 5 && b.length < 60e6 && new TextDecoder().decode(b.slice(0, 5)) === '%PDF-';
const isPngBytes = b => b.length > 8 && b.length < 8e6 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const asBytes = d => d instanceof ArrayBuffer ? new Uint8Array(d) : d instanceof Uint8Array ? d : null;
const NO_LINK = 'La connexion n’aboutit pas : le réseau bloque la liaison directe entre le téléphone et l’ordinateur. Réessaie, ou passe le téléphone en 4G.';

// ---------- Ordinateur : QR code, puis réception ----------
// purpose : 'page' (feuille numérisée), 'sig' (signature) ou 'stamp' (tampon) ; seuls changent les textes et le bouton mis en avant sur le téléphone
const PHONE_TEXT = {
  page: ['Numériser avec ton téléphone', 'Prends la feuille en photo : elle est redressée toute seule', "La page apparaît ici, sur l'ordinateur", 'Téléphone connecté : prends la feuille en photo avec le téléphone.'],
  sig: ['Ta signature avec le téléphone', 'Signe sur une feuille blanche et prends-la en photo', 'Elle apparaît ici, dans « Mes signatures »', 'Téléphone connecté : photographie ta signature avec le téléphone.'],
  stamp: ['Un tampon avec le téléphone', 'Prends le tampon en photo, sur une feuille blanche', 'Il apparaît ici, dans « Mes tampons »', 'Téléphone connecté : photographie le tampon avec le téléphone.'],
};
let deskPeer = null, phoneConn = null, received = 0, deskPurpose = 'page';
const deskSay = t => { $('phonestatus').textContent = tr(t); };
async function openPhoneScan(purpose = 'page') {
  deskPurpose = PHONE_TEXT[purpose] ? purpose : 'page';
  const [title, step2, step3, ready] = PHONE_TEXT[deskPurpose];
  $('phonetitle').textContent = tr(title); $('phonestep2').textContent = tr(step2); $('phonestep3').textContent = tr(step3);
  $('phonedlg').showModal();
  // déjà prêt et toujours joignable : même code ; le téléphone resté connecté continue
  if (deskPeer && !deskPeer.destroyed && !deskPeer.disconnected) { showQr(); if (phoneConn?.open) deskSay(ready); return; }
  deskPeer?.destroy();
  deskPeer = null;
  $('phoneqr').innerHTML = '';
  deskSay('Préparation du code…');
  try {
    const [peer] = await Promise.all([newPeer(), loadScript(here(QR_LIB))]);
    deskPeer = peer;
    showQr();
    track('telephone', { etape: 'code', pour: deskPurpose });
    peer.on('connection', conn => {
      phoneConn?.close(); // un seul téléphone à la fois : le dernier arrivé remplace l'ancien (parti sans prévenir, écran éteint…)
      phoneConn = conn;
      deskSay('Téléphone trouvé, connexion…');
      const slow = setTimeout(() => { if (phoneConn === conn && !conn.open) deskSay(NO_LINK); }, 15000);
      conn.on('open', () => { clearTimeout(slow); deskSay(PHONE_TEXT[deskPurpose][3]); track('telephone', { etape: 'connecte' }); });
      conn.on('data', receive);
      conn.on('close', () => { if (phoneConn !== conn) return; phoneConn = null; deskSay('Téléphone déconnecté. Scanne à nouveau le code pour le reconnecter.'); });
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); }); // le serveur de mise en relation a coupé : on reste joignable
    peer.on('error', e => { console.error(e); if (peer.destroyed && deskPeer === peer) deskPeer = null; });
  } catch (e) {
    console.error(e);
    deskPeer = null;
    deskSay('Impossible de préparer la connexion : vérifie ta connexion Internet, puis réessaie.');
  }
}
function showQr() {
  const link = new URL(here(lang === 'en' ? 'en/' : ''));
  link.searchParams.set('relais', deskPeer.id);
  if (deskPurpose !== 'page') link.searchParams.set('pour', deskPurpose);
  const qr = qrcode(0, 'M');
  qr.addData(link.href);
  qr.make();
  $('phoneqr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  if (!phoneConn?.open) deskSay('Scanne ce code avec l’appareil photo de ton téléphone.');
}
// Reçu du téléphone : un PDF (page numérisée, fichier) ou { t: 'sig' | 'stamp', png } ; tout le reste est ignoré
async function receive(d) {
  if (d?.t === 'sig' || d?.t === 'stamp') return receiveMark(d.t, asBytes(d.png));
  const bytes = asBytes(d);
  if (!bytes || !isPdfBytes(bytes)) return;
  received++;
  deskSay(tr('{n} page(s) reçue(s). Tu peux continuer avec le téléphone.', { n: received }));
  $('phonedlg').close();
  await openSources([{ bytes, name: 'Numérisation.pdf', made: true }], pages.length ? 'append' : 'replace', true);
  $('pages').scrollTo({ top: $('pages').scrollHeight, behavior: 'smooth' });
  toast('Page reçue du téléphone ✓', '', { label: 'Afficher le code', fn: openPhoneScan });
  track('telephone', { etape: 'page' });
}
async function receiveMark(kind, bytes) {
  if (!bytes || !isPngBytes(bytes)) return;
  let img;
  try { img = await createImageBitmap(new Blob([bytes], { type: 'image/png' })); } catch { return; }
  // redessinée ici (et limitée à 1600 px) : on ne garde jamais tel quel un fichier venu d'ailleurs
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  $('phonedlg').close();
  $('stampdlg').close();
  document.body.classList.add('show-right');
  if (kind === 'stamp') saveImageStamp(c);
  else if (addSig(c)) toast('Signature reçue du téléphone ✓ Glisse-la sur le document.');
  track('telephone', { etape: kind });
}
$('phoneclose').onclick = () => $('phonedlg').close();
$('phonebtn').onclick = () => openPhoneScan('page');
$('sigphonebtn').onclick = () => openPhoneScan('sig');
$('stampphonebtn').onclick = () => { $('stampdlg').close(); openPhoneScan('stamp'); };

// ---------- Téléphone : ouvert depuis le QR code (?relais=…&pour=…), il envoie ses photos à l'ordinateur ----------
let relayConn = null, sent = 0;
const phoneSay = (t, err) => { $('relaystatus').textContent = tr(t, { n: sent }); $('relaystatus').classList.toggle('err', !!err); };
async function startPhoneRelay(id, purpose) {
  // le bouton de ce que l'ordinateur attend passe en premier, en grand
  const want = PHONE_TEXT[purpose] ? purpose : 'page';
  document.querySelectorAll('.relayacts label[data-for]').forEach(l => {
    const on = l.dataset.for === want;
    l.classList.toggle('primary', on); l.classList.toggle('relaybig', on);
    if (on) l.parentNode.prepend(l);
  });
  $('relaydlg').showModal();
  phoneSay('Connexion à l’ordinateur…');
  try {
    const peer = await newPeer();
    relayConn = peer.connect(id, { reliable: true });
    const timer = setTimeout(() => { if (!relayConn.open) phoneSay(NO_LINK, true); }, 15000);
    relayConn.on('open', () => { clearTimeout(timer); phoneSay('Connecté à l’ordinateur ✓ Prends la photo.'); document.body.classList.add('relay-on'); });
    relayConn.on('close', () => { document.body.classList.remove('relay-on'); phoneSay('L’ordinateur s’est déconnecté. Scanne à nouveau le code affiché sur l’ordinateur.', true); });
    peer.on('error', e => { console.error(e); phoneSay('La connexion a échoué. Vérifie que la page Rature est toujours ouverte sur l’ordinateur, puis scanne à nouveau le code.', true); });
  } catch (e) {
    console.error(e);
    phoneSay('Impossible de se connecter : vérifie la connexion Internet du téléphone.', true);
  }
}
// Envoie un PDF à l'ordinateur (appelé après une numérisation, ou pour un fichier choisi) ; false si pas connecté
function sendToDesk(bytes) {
  if (!relayConn?.open) return false;
  relayConn.send(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  sent++;
  phoneSay('{n} page(s) envoyée(s) à l’ordinateur ✓ Tu peux en prendre une autre.');
  return true;
}
// Signature ou tampon détouré (canvas transparent) : part dans les listes de l'ordinateur ; false si pas connecté
function sendMarkToDesk(kind, canvas) {
  if (!relayConn?.open) return false;
  canvas.toBlob(async b => {
    relayConn.send({ t: kind, png: await b.arrayBuffer() });
    phoneSay(kind === 'sig' ? 'Signature envoyée à l’ordinateur ✓' : 'Tampon envoyé à l’ordinateur ✓');
  }, 'image/png');
  return true;
}
$('relayfile').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  try {
    await libsReady();
    const pdfs = files.filter(isPdf), imgs = files.filter(isImg);
    for (const f of pdfs) sendToDesk(new Uint8Array(await f.arrayBuffer()));
    if (imgs.length) sendToDesk(await imagesToPdf(imgs));
  } catch (err) { console.error(err); phoneSay('Impossible d’envoyer ce fichier.', true); }
};
$('relayclose').onclick = () => $('relaydlg').close();
