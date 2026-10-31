/* Rature · avant le premier affichage : thème choisi, et page dans la bonne langue.
   Fichier à part (chargé de façon bloquante dans <head>) : la politique de sécurité (_headers) interdit le code écrit dans la page.
   Langue voulue : celle choisie avec le bouton FR/EN, sinon celle du navigateur. Les robots des moteurs de recherche ne sont jamais
   redirigés : chacun des deux adresses (/ en français, /en/ en anglais) doit pouvoir être lue et indexée telle quelle. */
try { var P = JSON.parse(localStorage.prefs || '{}'); } catch (e) { P = {}; }
if (P.theme === 'light' || P.theme === 'dark') document.documentElement.dataset.theme = P.theme;
var PAGE = document.documentElement.lang, NAV = /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
var BOT = /bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent);
var WANT = P.lang || (BOT ? PAGE : NAV);
if (WANT !== PAGE) location.replace((WANT === 'en' ? 'en/' : document.documentElement.dataset.root || './') + location.search);
