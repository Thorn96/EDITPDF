// Rature · démarrage (chargé en dernier)
applyPrefs();
translateDOM();
document.documentElement.classList.remove('en-wait');
renderSigs();
renderStamps();
mount();
// arrivée depuis un guide (rature.app/?outil=…) : l'outil voulu est déjà choisi ; « sign » ouvre la signature dès le premier document
const OUTIL = new URLSearchParams(location.search).get('outil');
setTool(HINTS[OUTIL] ? OUTIL : HINTS[prefs.tool] && prefs.tool !== 'crop' ? prefs.tool : 'text');
checkResume();
