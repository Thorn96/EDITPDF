// Rature · démarrage (chargé en dernier)
applyPrefs();
translateDOM();
renderSigs();
renderStamps();
mount();
// arrivée depuis un guide (rature.app/?outil=…) : l'outil voulu est déjà choisi ; « sign » ouvre la signature dès le premier document
const Q = new URLSearchParams(location.search), OUTIL = Q.get('outil');
setTool(HINTS[OUTIL] ? OUTIL : HINTS[prefs.tool] && prefs.tool !== 'crop' ? prefs.tool : 'text');
if (OUTIL) track('guide', { outil: OUTIL }); // arrivée depuis un guide
// ?reprendre : on vient de changer de langue, le travail en cours est rouvert tout de suite
checkResume().then(() => { if (Q.has('reprendre') && !$('resume').hidden) $('resumego').click(); });
if (Q.has('reprendre')) history.replaceState(null, '', location.pathname); // adresse propre une fois le travail repris
if (Q.get('relais')) startPhoneRelay(Q.get('relais')); // téléphone ouvert depuis le QR code affiché sur un ordinateur
