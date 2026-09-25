// Rature · Signaler un problème : message envoyé par e-mail via Web3Forms.
// La clé ci-dessous est liée à l'adresse de réception, qui n'apparaît jamais dans le site.
// Tant qu'elle est vide, l'entrée « Signaler un problème » n'est pas proposée.
const REPORT_KEY = 'c08dd81e-4270-4727-a2da-339f62a4150c';

function openReport() {
  $('repmsgbox').textContent = '';
  $('reportdlg').showModal();
  $('repmsg').focus();
}
$('repcancel').onclick = () => $('reportdlg').close();
$('repgo').onclick = async () => {
  const message = $('repmsg').value.trim(), mail = $('repmail').value.trim(), btn = $('repgo');
  if (message.length < 5) return $('repmsgbox').textContent = tr('Écris quelques mots pour décrire le problème.');
  const infos = $('repinfo').checked ? `\n\n— ${navigator.userAgent}\n— ${screen.width}×${screen.height}, ${navigator.language}, ${pages.length} page(s)` : '';
  btn.classList.add('busy');
  try {
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: REPORT_KEY, subject: 'Rature : signalement', from_name: 'Rature', message: message + infos, ...(mail && { email: mail }) }),
    });
    if (!(await r.json()).success) throw new Error('refusé');
    $('reportdlg').close();
    $('repmsg').value = '';
    toast('Merci ! Ton message a bien été envoyé.');
  } catch { $('repmsgbox').textContent = tr('Envoi impossible pour le moment. Vérifie ta connexion et réessaie.'); }
  finally { btn.classList.remove('busy'); }
};
