// Rature · démarrage (chargé en dernier)
applyPrefs();
translateDOM();
renderSigs();
renderStamps();
mount();
setTool(HINTS[prefs.tool] && prefs.tool !== 'crop' ? prefs.tool : 'text');
checkResume();
