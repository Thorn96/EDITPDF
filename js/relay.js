// Rature · Numériser avec le téléphone : l'ordinateur affiche un QR code, le téléphone photographie la feuille, la page arrive sur l'ordinateur.
// Connexion directe entre les deux appareils (WebRTC, chiffrée de bout en bout). Le serveur public PeerJS sert seulement à les mettre
// en relation : il ne voit jamais les documents.
const PEER_LIB = 'lib/peerjs/peerjs.min.js', QR_LIB = 'lib/qrcode/qrcode.js';
// Pour traverser les box. Réseaux qui bloquent la connexion directe (certains opérateurs mobiles, entreprises) : ajouter ici un relais TURN,
// par exemple { urls: 'turn:…', username: '…', credential: '…' } d'un compte gratuit (metered.ca, Cloudflare). Les données y restent chiffrées.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const newPeer = async () => { await loadScript(here(PEER_LIB)); const p = new Peer({ config: { iceServers: ICE } }); await new Promise((ok, ko) => { p.on('open', ok); p.on('error', ko); }); return p; };
const isPdfBytes = b => b.length > 5 && b.length < 60e6 && new TextDecoder().decode(b.slice(0, 5)) === '%PDF-';

// ---------- Ordinateur : QR code, puis réception des pages ----------
let deskPeer = null, phoneConn = null, received = 0;
const deskSay = t => { $('phonestatus').textContent = tr(t); };
async function openPhoneScan() {
  $('phonedlg').showModal();
  if (deskPeer && !deskPeer.destroyed) return; // déjà prêt : même code, le téléphone peut rester connecté
  $('phoneqr').innerHTML = '';
  deskSay('Préparation du code…');
  try {
    const [peer] = await Promise.all([newPeer(), loadScript(here(QR_LIB))]);
    deskPeer = peer;
    const link = new URL(here(lang === 'en' ? 'en/' : ''));
    link.searchParams.set('relais', peer.id);
    const qr = qrcode(0, 'M');
    qr.addData(link.href);
    qr.make();
    $('phoneqr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    deskSay('Scanne ce code avec l’appareil photo de ton téléphone.');
    track('telephone', { etape: 'code' });
    peer.on('connection', conn => {
      if (phoneConn?.open) return conn.close(); // un seul téléphone à la fois
      phoneConn = conn;
      conn.on('open', () => { deskSay('Téléphone connecté : prends la feuille en photo avec le téléphone.'); track('telephone', { etape: 'connecte' }); });
      conn.on('data', receivePage);
      conn.on('close', () => { phoneConn = null; deskSay('Téléphone déconnecté. Scanne à nouveau le code pour le reconnecter.'); });
    });
    peer.on('disconnected', () => peer.reconnect()); // le serveur de mise en relation a coupé : on reste joignable
  } catch (e) {
    console.error(e);
    deskPeer = null;
    deskSay('Impossible de préparer la connexion : vérifie ta connexion Internet, puis réessaie.');
  }
}
async function receivePage(d) {
  const bytes = d instanceof ArrayBuffer ? new Uint8Array(d) : d instanceof Uint8Array ? d : null;
  if (!bytes || !isPdfBytes(bytes)) return; // on n'accepte que des PDF
  received++;
  deskSay(tr('{n} page(s) reçue(s). Tu peux continuer avec le téléphone.', { n: received }));
  $('phonedlg').close();
  await openSources([{ bytes, name: 'Numérisation.pdf', made: true }], pages.length ? 'append' : 'replace', true);
  $('pages').scrollTo({ top: $('pages').scrollHeight, behavior: 'smooth' });
  toast('Page reçue du téléphone ✓', '', { label: 'Afficher le code', fn: openPhoneScan });
  track('telephone', { etape: 'page' });
}
$('phoneclose').onclick = () => $('phonedlg').close();
$('phonebtn').onclick = openPhoneScan;

// ---------- Téléphone : ouvert depuis le QR code (?relais=…), il envoie ses photos à l'ordinateur ----------
let relayConn = null, sent = 0;
const phoneSay = (t, err) => { $('relaystatus').textContent = tr(t, { n: sent }); $('relaystatus').classList.toggle('err', !!err); };
async function startPhoneRelay(id) {
  $('relaydlg').showModal();
  phoneSay('Connexion à l’ordinateur…');
  try {
    const peer = await newPeer();
    relayConn = peer.connect(id, { reliable: true });
    const timer = setTimeout(() => { if (!relayConn.open) phoneSay('La connexion n’aboutit pas. Mets le téléphone et l’ordinateur sur le même Wi-Fi, puis scanne à nouveau le code.', true); }, 15000);
    relayConn.on('open', () => { clearTimeout(timer); phoneSay('Connecté à l’ordinateur ✓ Prends la feuille en photo.'); document.body.classList.add('relay-on'); });
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
