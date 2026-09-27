// Rature · fabrique les pages du site : guides (fr et en), éditeur anglais /en/, sitemap. À relancer après chaque modification :  node guides/build.js
// Chaque page : /<slug>/index.html ou /en/<slug>/index.html, servie telle quelle par Vercel. Contenu anglais des guides : guides/en.js.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SITE = 'https://rature.app';

// ---------- Illustrations : une feuille de cahier et ce qu'on y fait ----------
const sheet = inner => `<svg viewBox="0 0 320 380" aria-hidden="true">
<rect x="30" y="22" width="260" height="336" rx="6" fill="#15151f"/><rect x="20" y="12" width="260" height="336" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M48 58h150" stroke="#15151f" stroke-width="7" stroke-linecap="round"/>${inner}</svg>`;
const lines = (ys, w = [200, 180, 205, 150]) => ys.map((y, i) => `<path d="M48 ${y}h${w[i % w.length]}" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>`).join('');
const ART = T => ({ // T : les quelques mots écrits sur les illustrations, dans la langue de la page
  sign: sheet(lines([98, 120, 142, 164, 186]) + `<path d="M48 290h170" stroke="#15151f" stroke-width="2" stroke-dasharray="5 5"/>
<path d="M58 280c14-40 30-44 26-8-2 20 18-26 30-12 10 12 12 22 24 2 10-16 18 12 30 4 12-10 22-12 30 8 6 14 22-16 40-8" fill="none" stroke="#1c2a8f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<text x="48" y="238" font-family="Nothing You Could Do, cursive" font-size="20" fill="#1c2a8f">${T.approved}</text>`),
  fill: sheet(`<text x="48" y="104" font-family="Schibsted Grotesk, sans-serif" font-size="15" fill="#6f6c78">${T.name}</text><path d="M96 108h150" stroke="#b3baec" stroke-width="2"/>
<text x="100" y="102" font-family="Schibsted Grotesk, sans-serif" font-size="18" font-weight="600" fill="#1c2a8f">Camille MARTIN</text>
<text x="48" y="146" font-family="Schibsted Grotesk, sans-serif" font-size="15" fill="#6f6c78">${T.born}</text><path d="M122 150h124" stroke="#b3baec" stroke-width="2"/>
<text x="126" y="144" font-family="Schibsted Grotesk, sans-serif" font-size="18" font-weight="600" fill="#1c2a8f">12/03/1994</text>
<rect x="48" y="178" width="20" height="20" rx="3" fill="none" stroke="#15151f" stroke-width="2"/><path d="m52 188 5 5 9-11" fill="none" stroke="#e2494f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M80 188h120" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
<rect x="48" y="212" width="20" height="20" rx="3" fill="none" stroke="#15151f" stroke-width="2"/><path d="M80 222h100" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
${lines([266, 288])}`),
  edit: sheet(lines([98, 120]) + `<text x="48" y="176" font-family="Schibsted Grotesk, sans-serif" font-size="19" fill="#15151f">${T.before}</text>
<text x="176" y="176" font-family="Schibsted Grotesk, sans-serif" font-size="19" fill="#15151f">${T.old}</text><path d="M170 170c20-6 40 6 70-4" fill="none" stroke="#e2494f" stroke-width="4" stroke-linecap="round"/>
<text x="172" y="140" font-family="Nothing You Could Do, cursive" font-size="22" fill="#e2494f">${T.new}</text>
<rect x="42" y="152" width="214" height="34" rx="5" fill="none" stroke="#e2494f" stroke-width="2" stroke-dasharray="6 5"/>${lines([214, 236, 258, 280])}`),
  rent: `<svg viewBox="0 0 320 380" aria-hidden="true"><g transform="rotate(-6 160 190)"><rect x="34" y="30" width="230" height="300" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>${lines([70, 92, 114], [150, 170, 120])}</g>
<g><rect x="54" y="42" width="240" height="316" rx="6" fill="#15151f" transform="translate(8 8)"/><rect x="54" y="42" width="240" height="316" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M80 86h140" stroke="#15151f" stroke-width="7" stroke-linecap="round"/>
<text x="80" y="128" font-family="Schibsted Grotesk, sans-serif" font-size="14" fill="#6f6c78">${T.form}</text>
<path d="M80 156h180M80 178h160M80 200h170" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
<text x="174" y="270" font-family="Young Serif, serif" font-size="30" fill="#e2494f" opacity=".22" transform="rotate(-32 174 250)">${T.wm}</text>
<path d="M92 318c12-34 26-38 22-6-2 16 16-22 26-10 8 10 10 18 20 2 8-14 16 10 26 4" fill="none" stroke="#1c2a8f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="M232 26v44a14 14 0 0 1-28 0V34a8 8 0 0 1 16 0v34" fill="none" stroke="#6f6c78" stroke-width="4" stroke-linecap="round"/></svg>`,
  redact: sheet(lines([98, 120]) + `<rect x="46" y="136" width="170" height="20" rx="2" fill="#15151f"/>${lines([176, 198])}
<rect x="46" y="214" width="120" height="20" rx="2" fill="#15151f"/><path d="M180 224h66" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>${lines([254, 276, 298])}
<text x="84" y="334" font-family="Nothing You Could Do, cursive" font-size="20" fill="#e2494f">${T.erased}</text>`),
  local: `<svg viewBox="0 0 320 380" aria-hidden="true"><rect x="38" y="96" width="244" height="168" rx="12" fill="#15151f" transform="translate(8 8)"/>
<rect x="38" y="96" width="244" height="168" rx="12" fill="#fff" stroke="#15151f" stroke-width="3"/><path d="M14 280h292l-18 26H32z" fill="#fff" stroke="#15151f" stroke-width="3" stroke-linejoin="round"/>
<rect x="120" y="116" width="80" height="104" rx="4" fill="#fbf8f0" stroke="#15151f" stroke-width="2.5"/><path d="M134 140h52M134 156h40M134 172h48" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/>
<path d="M126 196c10-8 30 8 60-6" fill="none" stroke="#e2494f" stroke-width="4" stroke-linecap="round"/>
<g transform="translate(206 20)"><path d="M18 52a18 18 0 0 1 4-35 24 24 0 0 1 45 4 16 16 0 0 1 3 31z" fill="#fff" stroke="#6f6c78" stroke-width="3"/><path d="M8 8l72 58" stroke="#e2494f" stroke-width="5" stroke-linecap="round"/></g>
<text x="40" y="350" font-family="Nothing You Could Do, cursive" font-size="21" fill="#e2494f">${T.local}</text></svg>`,
  merge: `<svg viewBox="0 0 320 380" aria-hidden="true">
<g transform="rotate(-8 90 115)"><rect x="30" y="40" width="120" height="150" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/><path d="M50 70h70M50 88h80M50 106h60" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/></g>
<g transform="rotate(7 230 115)"><rect x="170" y="40" width="120" height="150" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/><path d="M190 70h70M190 88h80M190 106h60" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/></g>
<path d="M160 96v40M140 116h40" stroke="#e2494f" stroke-width="6" stroke-linecap="round"/>
<path d="M100 204v36m-14-14 14 14 14-14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="48" y="264" width="120" height="100" rx="5" fill="#15151f"/><rect x="40" y="256" width="120" height="100" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M58 282h80M58 298h70M58 314h84M58 330h50" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/>
<text x="178" y="318" font-family="Nothing You Could Do, cursive" font-size="22" fill="#e2494f">${T.merged}</text></svg>`,
  compress: sheet(lines([98, 120, 142, 164, 186, 208]) + `<path d="M110 240l40 28 40-28M110 274l40 28 40-28" fill="none" stroke="#e2494f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<text x="150" y="336" text-anchor="middle" font-family="Nothing You Could Do, cursive" font-size="22" fill="#e2494f">${T.lighter}</text>`),
  photos: `<svg viewBox="0 0 320 380" aria-hidden="true">
<rect x="24" y="70" width="104" height="196" rx="16" fill="#fff" stroke="#15151f" stroke-width="3"/><rect x="36" y="98" width="80" height="120" rx="4" fill="#fbf8f0" stroke="#15151f" stroke-width="2"/>
<path d="M40 204l24-30 18 20 12-12 18 22z" fill="#b3baec"/><circle cx="96" cy="120" r="8" fill="#e2494f"/><circle cx="76" cy="246" r="8" fill="none" stroke="#15151f" stroke-width="2.5"/>
<path d="M140 150h30m-12-12 12 12-12 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="190" y="62" width="112" height="150" rx="5" fill="#15151f"/><rect x="182" y="54" width="112" height="150" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/>
<rect x="196" y="70" width="84" height="100" rx="3" fill="#fbf8f0" stroke="#15151f" stroke-width="1.5"/><path d="M200 162l22-26 16 18 10-10 16 18z" fill="#b3baec"/><circle cx="264" cy="88" r="6" fill="#e2494f"/>
<rect x="196" y="178" width="40" height="16" rx="3" fill="#e2494f"/><text x="216" y="190" text-anchor="middle" font-family="Schibsted Grotesk, sans-serif" font-weight="700" font-size="11" fill="#fff">PDF</text>
<text x="160" y="320" text-anchor="middle" font-family="Nothing You Could Do, cursive" font-size="24" fill="#e2494f">${T.photos}</text></svg>`,
  word: `<svg viewBox="0 0 320 380" aria-hidden="true">
<rect x="20" y="70" width="120" height="160" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/><path d="M38 100h80M38 118h70M38 136h84M38 154h60" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/>
<rect x="38" y="190" width="44" height="20" rx="4" fill="#e2494f"/><text x="60" y="204" text-anchor="middle" font-family="Schibsted Grotesk, sans-serif" font-weight="700" font-size="12" fill="#fff">PDF</text>
<path d="M148 150h26m-10-10 10 10-10 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="190" y="78" width="120" height="160" rx="5" fill="#15151f"/><rect x="182" y="70" width="120" height="160" rx="5" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M200 100h80M200 118h70M200 136h84M200 154h60" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/>
<rect x="200" y="188" width="30" height="24" rx="4" fill="#1c2a8f"/><text x="215" y="205" text-anchor="middle" font-family="Schibsted Grotesk, sans-serif" font-weight="700" font-size="15" fill="#fff">W</text>
<text x="160" y="300" text-anchor="middle" font-family="Nothing You Could Do, cursive" font-size="23" fill="#e2494f">${T.word}</text></svg>`,
  ocr: sheet(`<g opacity=".55">${lines([98, 120, 142])}</g><path d="M36 152v-14h14M264 138h14v14M278 204v14h-14M50 218H36v-14" fill="none" stroke="#e2494f" stroke-width="4" stroke-linecap="round"/>
<text x="50" y="185" font-family="Schibsted Grotesk, sans-serif" font-size="18" fill="#15151f">${T.ocrLine}</text><g opacity=".55">${lines([246, 268, 290])}</g>
<text x="60" y="334" font-family="Nothing You Could Do, cursive" font-size="21" fill="#e2494f">${T.ocrLbl}</text>`),
});

// ---------- Contenu ----------
const OPEN = { t: 'Ouvre ton PDF', d: "Glisse-le sur la page de Rature ou clique sur « Choisir un fichier ». Il s'ouvre dans ton navigateur : rien n'est envoyé." };
const FREE = { q: 'Est-ce vraiment gratuit ?', a: 'Oui : sans inscription, sans limite de documents et sans filigrane ajouté.' };
const LOCAL = { q: 'Mon document est-il envoyé sur Internet ?', a: "Non. Tout se passe dans ton navigateur : le fichier ne quitte pas ton appareil, et Rature fonctionne même hors ligne une fois ouvert." };
const SIGNED = { q: 'Et si le PDF est déjà signé électroniquement ?', a: 'Rature te prévient : modifier le fichier rend la signature électronique existante invalide.' };

const PAGES = [
  { slug: 'signer-un-pdf', art: 'sign', q: '?outil=sign', short: 'Signer un PDF',
    title: "Signer un PDF gratuitement, sans l'imprimer · Rature",
    desc: "Signe un PDF à la souris, au doigt ou au stylet, gratuitement et sans inscription. Le fichier ne quitte pas ton appareil. Signature gardée pour la prochaine fois, paraphe sur chaque page.",
    eyebrow: 'Plus besoin d’imprimer, signer, scanner', h1: "Signer un PDF sans l'imprimer",
    lead: 'Trace ta signature une fois, pose-la sur le document, télécharge. Sur ordinateur comme sur téléphone, sans créer de compte.', cta: 'Signer mon PDF',
    steps: [OPEN,
      { t: 'Crée ta signature', d: 'Clique sur « Signer » dans la barre d’outils, puis signe à la souris, au doigt ou au stylet. Tu peux aussi prendre en photo ta signature sur une feuille blanche : le fond est retiré.' },
      { t: 'Place-la et télécharge', d: 'Glisse la signature à l’endroit voulu, ajuste sa taille, puis clique sur « Télécharger ».' }],
    body: [
      ['Ta signature est gardée pour la prochaine fois', 'Elle est enregistrée dans ton navigateur, sur ton appareil uniquement. La prochaine fois, un clic suffit. Pour un paraphe en bas de chaque page, pose-le une fois puis choisis « Toutes les pages ».'],
      ['Ajouter « Lu et approuvé », la date ou « Fait à… le… »', 'L’outil « Cocher » propose les mentions courantes : coche, croix, date du jour, « Lu et approuvé », « Bon pour accord », « Fait à … le … ». Pour écrire autre chose, l’outil « Écrire » pose du texte où tu veux.'],
      ['Quelle valeur a une signature posée sur un PDF ?', 'Pour la plupart des documents du quotidien (attestation, dossier de location, bon de commande, autorisation), une signature manuscrite ajoutée au PDF est généralement acceptée. Pour un contrat important signé à distance, comme un contrat de travail ou un bail, une signature électronique avancée, avec vérification d’identité et certificat, apporte une preuve bien plus solide : elle passe par un service spécialisé. En cas de doute, demande à ton interlocuteur ce qu’il accepte.']],
    faq: [FREE, LOCAL, { q: 'Ça marche sur téléphone ?', a: 'Oui. Tu signes directement au doigt sur l’écran, puis tu télécharges ou partages le PDF signé.' }, SIGNED] },

  { slug: 'remplir-un-pdf', art: 'fill', q: '?outil=text', short: 'Remplir un PDF',
    title: 'Remplir un formulaire PDF en ligne, gratuitement · Rature',
    desc: "Remplis un formulaire PDF, même non modifiable : écris n'importe où, coche les cases, date et signe. Gratuit, sans inscription, sans envoyer le fichier.",
    eyebrow: 'Même quand le PDF n’est pas « remplissable »', h1: 'Remplir un PDF, case par case',
    lead: 'Écris directement sur le document, coche les cases, ajoute la date et ta signature, puis télécharge un PDF propre.', cta: 'Remplir mon PDF',
    steps: [OPEN,
      { t: 'Écris où tu veux', d: 'Avec l’outil « Écrire », clique à l’endroit voulu et tape. Si le PDF contient de vrais champs de formulaire, ils sont déjà remplissables : clique simplement dedans.' },
      { t: 'Coche, date, signe', d: 'L’outil « Cocher » pose ✓, ✗ ou la date du jour. Termine avec ta signature, puis clique sur « Télécharger ».' }],
    body: [
      ['Remplir avec ton profil, en un clic', 'Nom, adresse, date de naissance : enregistre-les une fois dans « Mon profil ». Rature les propose ensuite dans les champs du formulaire, ou juste après les libellés imprimés comme « Nom : ……… ». Le profil reste dans ton navigateur.'],
      ['Un formulaire que tu remplis souvent ?', 'Enregistre-le comme modèle : tu le retrouves prêt à compléter au prochain besoin.'],
      ['Une photo ou un scan de la feuille ?', 'Ouvre directement les photos : elles deviennent des pages PDF. Avec « Numériser », Rature redresse la feuille et la met en noir et blanc, comme un scanner.']],
    faq: [{ q: 'Le PDF n’a pas de champs, je peux quand même écrire ?', a: 'Oui : l’outil « Écrire » pose du texte n’importe où sur la page, à la taille et dans la police de ton choix.' },
      { q: 'Le PDF téléchargé reste-t-il remplissable ?', a: 'Les champs de formulaire d’origine restent des champs. Tu peux aussi en créer avec l’outil « Champ » pour qu’un autre puisse remplir le PDF.' },
      { q: 'Mes données sont-elles envoyées ?', a: 'Non. Le document et ton profil restent sur ton appareil.' }, FREE] },

  { slug: 'modifier-texte-pdf', art: 'edit', q: '?outil=edit', short: 'Modifier le texte',
    title: "Modifier le texte d'un PDF gratuitement · Rature",
    desc: "Corrige une faute, change une date ou un montant directement dans le texte d'un PDF, dans sa police d'origine. Gratuit, sans inscription, sans envoi du fichier.",
    eyebrow: 'Pas un cache blanc par-dessus : le vrai texte', h1: "Modifier le texte d'un PDF",
    lead: 'Clique dans une ligne, corrige, c’est fait. L’ancien texte est vraiment remplacé, dans la police du document.', cta: 'Corriger mon PDF',
    steps: [OPEN,
      { t: 'Choisis « Corriger »', d: 'Dans la barre d’outils, clique sur « Corriger » : les lignes de texte du document deviennent cliquables.' },
      { t: 'Réécris et télécharge', d: 'Clique dans le paragraphe, modifie le texte comme dans un traitement de texte, puis télécharge.' }],
    body: [
      ['Pourquoi c’est différent', 'Beaucoup d’outils gratuits posent un rectangle blanc sur l’ancien texte et écrivent par-dessus : l’ancien texte reste dans le fichier et réapparaît si on le sélectionne. Rature le supprime vraiment et écrit le nouveau avec la police intégrée au PDF, au même endroit et avec le même espacement. Ce que tu ne touches pas reste identique.'],
      ['Rechercher et remplacer dans tout le document', 'Un nom ou une date à changer partout ? « Rechercher et remplacer » (Ctrl+F) le fait sur toutes les pages, avec la même suppression réelle.'],
      ['Et un PDF scanné ?', 'Sur une page scannée, le texte est une image. Rature reconnaît le texte (en français et en anglais), retrouve la police et la taille les plus proches, et te laisse corriger la ligne.']],
    faq: [{ q: 'Le texte modifié garde-t-il la même police ?', a: 'Oui quand le PDF contient la police, ce qui est le cas le plus courant. Sinon, Rature choisit la police libre la plus proche.' },
      { q: 'Et un PDF protégé par mot de passe ?', a: 'Il s’ouvre si tu connais son mot de passe.' }, SIGNED, FREE] },

  { slug: 'ocr-pdf', art: 'ocr', q: '?outil=ocr', short: 'OCR : lire un scan',
    title: 'OCR gratuit : rendre un PDF scanné modifiable · Rature',
    desc: "Reconnais le texte d'un PDF scanné ou d'une photo de document (OCR), en français et en anglais, pour le corriger, le rechercher ou le copier. Gratuit, rien n'est envoyé.",
    eyebrow: 'Un scan n’est qu’une image… pour l’instant', h1: 'Rendre un PDF scanné modifiable (OCR)',
    lead: 'Le bouton « OCR » lit le texte de chaque page scannée. Tu peux ensuite le corriger comme un vrai texte, le rechercher et le copier.', cta: 'Lire mon scan',
    steps: [OPEN,
      { t: 'Clique sur « OCR »', d: 'Dans la barre d’outils. Rature lit toutes les pages scannées d’un coup. La première fois, le moteur de lecture se télécharge en quelques secondes, puis il reste sur ton appareil.' },
      { t: 'Corrige et télécharge', d: 'Clique sur une ligne pour la réécrire, dans une police proche de l’originale, puis télécharge.' }],
    body: [
      ['Ce que l’OCR permet', 'Corriger une date, un nom ou un montant sur un document scanné ; rechercher un mot dans tout le document ; copier le texte ou l’exporter en Word. Le PDF téléchargé devient aussi cherchable.'],
      ['Pour une bonne lecture', 'Un scan net et droit donne les meilleurs résultats. Pour une feuille prise en photo, passe par « Numériser » : la feuille est redressée et contrastée avant la lecture.'],
      ['Tout se passe sur ton appareil', 'La lecture du texte se fait dans ton navigateur : tes documents ne sont envoyés à aucun service en ligne. Une fois le moteur téléchargé, ça marche même hors ligne.']],
    faq: [{ q: 'Quelles langues sont reconnues ?', a: 'Le français et l’anglais, accents compris.' },
      { q: 'Et l’écriture manuscrite ?', a: 'Elle est mal reconnue : l’OCR est fait pour le texte imprimé.' },
      { q: 'Combien de temps ça prend ?', a: 'Quelques secondes par page sur un ordinateur récent, un peu plus sur un téléphone.' }, FREE] },

  { slug: 'fusionner-pdf', art: 'merge', q: '', short: 'Fusionner des PDF',
    title: 'Fusionner des PDF gratuitement, sans les envoyer · Rature',
    desc: "Réunis plusieurs PDF (et des photos) en un seul fichier, remets les pages dans l'ordre, supprime celles en trop. Gratuit, sans inscription, rien n'est envoyé.",
    eyebrow: 'Plusieurs fichiers, un seul PDF', h1: 'Fusionner des PDF en un seul',
    lead: 'Ouvre tes PDF d’un coup, range les pages dans le bon ordre, télécharge un seul fichier.', cta: 'Fusionner mes PDF',
    steps: [{ t: 'Ouvre tous tes fichiers', d: 'Sélectionne plusieurs PDF à la fois (Ctrl ou Maj + clic), ou glisse-les ensemble sur la page. Les photos sont acceptées aussi : elles deviennent des pages.' },
      { t: 'Range les pages', d: 'Dans le panneau des pages, glisse une page pour la déplacer. La vue en grille (touche G) montre tout le document : pivoter, dupliquer, supprimer.' },
      { t: 'Télécharge', d: 'Clique sur « Télécharger » : un seul PDF, avec toutes tes pages.' }],
    body: [
      ['Ajouter un fichier en cours de route', 'Un document est déjà ouvert ? « PDF ou images », en bas du panneau des pages, ajoute d’autres fichiers à la suite. Tu peux aussi en glisser un sur la page : Rature te demande s’il faut remplacer, ajouter à la suite ou ouvrir un nouvel onglet.'],
      ['Garder seulement certaines pages', 'Au téléchargement, choisis « Seulement » et indique les pages voulues (par exemple 1-3, 5). Pour faire l’inverse et couper un PDF en plusieurs fichiers : « Découper le PDF », dans « Plus d’outils ».'],
      ['Tout reste sur ton appareil', 'Les fichiers ne sont envoyés nulle part : pratique pour réunir des pièces sensibles, comme un dossier de location ou des justificatifs.']],
    faq: [{ q: 'Combien de fichiers puis-je réunir ?', a: 'Autant que tu veux : la seule limite est la mémoire de ton appareil.' },
      { q: 'Puis-je mélanger PDF et photos ?', a: 'Oui : chaque photo devient une page, dans le sens de l’image.' },
      { q: 'Et un document Word ?', a: 'Les fichiers .docx sont convertis en PDF à l’ouverture, puis réunis avec les autres.' }, FREE] },

  { slug: 'compresser-pdf', art: 'compress', q: '?outil=compress', short: 'Compresser un PDF',
    title: "Compresser un PDF gratuitement, sans l'envoyer · Rature",
    desc: "Réduis le poids d'un PDF trop lourd pour un e-mail ou un formulaire en ligne : photos allégées, fichier nettoyé. Gratuit, sans inscription, rien n'est envoyé.",
    eyebrow: 'Trop lourd pour l’envoyer ?', h1: 'Compresser un PDF',
    lead: 'Allège les photos et nettoie le fichier pour passer sous la limite d’un e-mail ou d’un site administratif.', cta: 'Compresser mon PDF',
    steps: [OPEN,
      { t: 'Coche « Réduire la taille »', d: 'Clique sur « Télécharger », puis coche « Réduire la taille du fichier ». Depuis ce guide, la case est déjà cochée.' },
      { t: 'Télécharge', d: 'Le PDF allégé est enregistré sur ton appareil. Ton fichier d’origine n’est pas modifié.' }],
    body: [
      ['Ce qui est allégé', 'Les photos et les scans sont recompressés, et le fichier est nettoyé des éléments inutiles. Le texte reste net : il n’est pas transformé en image.'],
      ['Encore trop lourd ?', 'Supprime les pages inutiles (vue en grille, touche G), ou télécharge seulement les pages demandées avec « Seulement ».'],
      ['Un document à numériser ?', 'Au moment de la numérisation, choisis « Noir et blanc » : c’est le rendu le plus léger, et le plus lisible pour du texte.']],
    faq: [{ q: 'De combien le fichier est-il réduit ?', a: 'Ça dépend de son contenu : un PDF plein de photos s’allège beaucoup, un PDF fait surtout de texte est souvent déjà léger.' },
      { q: 'La qualité baisse-t-elle ?', a: 'Les photos sont un peu moins détaillées, sans différence visible à l’écran dans la plupart des cas. Le texte, lui, reste identique.' }, LOCAL, FREE] },

  { slug: 'photos-en-pdf', art: 'photos', q: '', short: 'Photos en PDF',
    title: 'Photos en PDF : transformer des images en PDF · Rature',
    desc: "Transforme des photos ou des images (JPG, PNG) en un seul PDF, une page par image, depuis ton téléphone ou ton ordinateur. Gratuit, sans inscription, rien n'est envoyé.",
    eyebrow: 'JPG, PNG, photos du téléphone', h1: 'Transformer des photos en PDF',
    lead: 'Choisis tes photos : chacune devient une page, et tu télécharges un seul PDF. Sur téléphone, prends directement la feuille en photo.', cta: 'Choisir mes photos',
    steps: [{ t: 'Choisis tes photos', d: 'Clique sur « Choisir un fichier » et sélectionne une ou plusieurs images. Chaque image devient une page A4, dans son sens.' },
      { t: 'Range et complète', d: 'Remets les pages dans l’ordre, ajoute du texte ou ta signature si besoin.' },
      { t: 'Télécharge', d: 'Un seul PDF, prêt à envoyer.' }],
    body: [
      ['Une feuille prise en photo ? Numérise-la', '« Numériser un document » ouvre l’appareil photo du téléphone : place les 4 coins sur les bords de la feuille, Rature la redresse et la met en noir et blanc, comme un scanner.'],
      ['Rendre le texte de la photo modifiable', 'Une photo de document ne contient qu’une image. Le bouton « OCR » lit son texte : tu peux ensuite le corriger, le rechercher ou le copier.'],
      ['Ajouter des photos à un PDF existant', 'Document déjà ouvert ? « PDF ou images », dans le panneau des pages, ajoute les photos comme nouvelles pages, ou pose-les sur la page affichée.']],
    faq: [{ q: 'Quels formats d’image ?', a: 'JPG, PNG, WebP et les autres formats d’image que ton navigateur sait afficher.' },
      { q: 'Les photos sont-elles envoyées ?', a: 'Non : la conversion se fait sur ton appareil.' }, FREE] },

  { slug: 'pdf-en-word', art: 'word', q: '?outil=word', short: 'PDF en Word',
    title: 'Convertir un PDF en Word (.docx) gratuitement · Rature',
    desc: "Convertis un PDF en document Word modifiable, paragraphes et titres compris, même un scan grâce à l'OCR. Gratuit, sans inscription, le fichier n'est pas envoyé.",
    eyebrow: 'Pour retravailler le texte dans Word', h1: 'Convertir un PDF en Word',
    lead: 'Récupère le texte d’un PDF dans un fichier Word, avec ses paragraphes, ses titres, le gras et l’italique.', cta: 'Convertir mon PDF',
    steps: [OPEN,
      { t: 'Exporte en Word', d: 'Dans « Plus d’outils », choisis « Exporter en Word (.docx) ». Depuis ce guide, un bouton « Exporter en Word » apparaît dès l’ouverture.' },
      { t: 'Ouvre-le dans Word', d: 'Le fichier .docx s’ouvre dans Word, LibreOffice ou Google Docs.' }],
    body: [
      ['Ce qui est gardé', 'Le texte, ses paragraphes, les titres, le gras, l’italique et la taille des caractères. Les images, les tableaux complexes et les mises en page en colonnes ne sont pas repris : pour garder l’apparence exacte, modifie plutôt le PDF directement avec « Corriger ».'],
      ['Un PDF scanné ?', 'Lance d’abord le bouton « OCR » : le texte reconnu passe ensuite dans le fichier Word.'],
      ['Et dans l’autre sens ?', 'Ouvre un document Word (.docx) dans Rature : il est converti en PDF, prêt à être rempli, signé ou envoyé.']],
    faq: [{ q: 'Mes corrections sont-elles incluses ?', a: 'Oui : le fichier Word reprend le document avec tes modifications.' }, LOCAL, FREE] },

  { slug: 'dossier-de-location-pdf', art: 'rent', q: '?outil=text', short: 'Dossier de location',
    title: 'Dossier de location en PDF : remplir, signer, protéger · Rature',
    desc: "Remplis et signe les pièces de ton dossier de location (attestation de caution solidaire, fiche de renseignements), ajoute un filigrane et réunis tout en un seul PDF. Gratuit.",
    eyebrow: 'Pour le propriétaire ou l’agence', h1: 'Préparer ton dossier de location en PDF',
    lead: 'Remplis et signe chaque pièce, ajoute un filigrane contre la fraude, réunis le tout en un seul fichier léger.', cta: 'Préparer mon dossier',
    steps: [{ t: 'Ouvre les documents', d: 'Glisse tous tes PDF et photos d’un coup : pièce d’identité, justificatifs, attestation de caution. Les photos deviennent des pages.' },
      { t: 'Remplis et signe', d: 'Complète les formulaires avec « Écrire », ajoute « Lu et approuvé » et ta signature.' },
      { t: 'Protège et télécharge', d: 'Ajoute un filigrane, réduis la taille si l’agence limite le poids des fichiers, puis télécharge un seul PDF.' }],
    body: [
      ['Le filigrane, une protection simple', 'Un filigrane comme « Uniquement pour dossier de location » sur chaque page rend tes pièces bien moins réutilisables par un fraudeur. Dans Rature : « Plus d’outils », puis « Filigrane, numéros de page, en-tête ».'],
      ['L’attestation de caution solidaire', 'Ton garant peut remplir et signer l’attestation directement sur le PDF. Vérifie avec le propriétaire ou l’agence si une mention doit être écrite par le garant lui-même : il peut alors l’écrire au doigt ou au stylet sur un téléphone ou une tablette.'],
      ['Cacher ce qui ne regarde pas l’agence', 'Sur un relevé ou un justificatif, tu peux masquer certaines informations avec « Caviarder » : elles sont effacées pour de bon du fichier, pas seulement recouvertes. Ne masque pas ce que l’agence a besoin de vérifier.'],
      ['Et DossierFacile ?', 'Le service public <a href="https://www.dossierfacile.logement.gouv.fr/">DossierFacile</a> permet de constituer un dossier vérifié à partager. Rature t’aide à préparer, signer et alléger les pièces que tu y déposes.']],
    faq: [{ q: 'Comment réduire la taille du dossier ?', a: 'Au téléchargement, coche « Réduire la taille du fichier » : les photos sont allégées. Tu peux aussi mettre toutes les pages au format A4.' },
      { q: 'Puis-je réunir plusieurs PDF en un seul ?', a: 'Oui : ouvre-les ensemble, ou ajoute-les avec « PDF ou images » dans le panneau des pages, puis réorganise les pages en les glissant.' },
      { q: 'Mes documents sont-ils envoyés ?', a: 'Non, tout reste sur ton appareil. C’est important pour des pièces aussi sensibles.' }, FREE] },

  { slug: 'caviarder-un-pdf', art: 'redact', q: '?outil=redact', short: 'Caviarder un PDF',
    title: 'Caviarder un PDF : masquer définitivement des informations · Rature',
    desc: "Masque définitivement un nom, un numéro ou un IBAN dans un PDF : ce qui est sous la zone est vraiment effacé du fichier. Caviardage automatique des données sensibles. Gratuit.",
    eyebrow: 'Un rectangle noir ne suffit pas toujours', h1: 'Caviarder un PDF pour de bon',
    lead: 'Masque un nom, une adresse, un numéro : ce qui est sous la zone est effacé du fichier, impossible à retrouver par copier-coller.', cta: 'Caviarder mon PDF',
    steps: [OPEN,
      { t: 'Trace les zones', d: 'Choisis « Caviarder » et fais glisser sur ce qui doit disparaître. Tu peux déplacer ou retirer une zone tant que tu n’as pas téléchargé.' },
      { t: 'Télécharge', d: 'Au téléchargement, le texte et les images sous chaque zone sont supprimés du fichier.' }],
    body: [
      ['Pourquoi un simple rectangle noir est risqué', 'Un rectangle posé par-dessus dans un logiciel de dessin ou de traitement de texte cache le texte à l’écran, mais le texte reste souvent dans le fichier : on peut le sélectionner, le copier ou le retrouver avec une recherche. Rature retire réellement ce qui est sous la zone.'],
      ['Caviardage automatique', '« Plus d’outils », puis « Caviarder automatiquement » repère dans le texte les e-mails, numéros de téléphone, IBAN, numéros de sécurité sociale et de carte bancaire. Tu coches ce qui doit disparaître, Rature pose les zones.'],
      ['Pour quels documents ?', 'Relevés bancaires, avis d’imposition, bulletins de salaire, pièces jointes à un dossier, documents partagés en ligne : tout ce que tu veux transmettre sans tout dévoiler.']],
    faq: [{ q: 'Le texte caviardé peut-il être récupéré ?', a: 'Non : il est retiré du fichier téléchargé, pas seulement recouvert. Garde l’original si tu en as encore besoin.' },
      { q: 'Ça marche sur un PDF scanné ?', a: 'Oui : la partie de l’image recouverte par la zone est effacée elle aussi.' }, LOCAL, FREE] },

  { slug: 'editeur-pdf-sans-envoi', art: 'local', q: '', short: 'Sans envoyer tes fichiers',
    title: "Éditeur PDF qui n'envoie pas tes fichiers · Rature",
    desc: "Une alternative à iLovePDF et Smallpdf où tout se passe dans ton navigateur : remplir, signer, corriger, caviarder, fusionner un PDF sans jamais l'envoyer sur un serveur.",
    eyebrow: 'Tes documents ne quittent pas ton appareil', h1: 'Un éditeur PDF qui n’envoie rien',
    lead: 'Remplir, signer, corriger, caviarder, fusionner : tout se fait dans ton navigateur. Aucun fichier n’est envoyé, même pas temporairement.', cta: 'Ouvrir Rature',
    steps: [{ t: 'Ouvre ton PDF', d: 'Le fichier est lu par ton navigateur, sur ton appareil.' },
      { t: 'Modifie-le', d: 'Tous les outils travaillent sur place : aucun serveur ne voit ton document.' },
      { t: 'Télécharge', d: 'Le PDF modifié est fabriqué par ton navigateur et enregistré directement sur ton appareil.' }],
    body: [
      ['Pourquoi c’est important', 'Beaucoup de services PDF en ligne traitent les fichiers sur leurs serveurs, même s’ils les suppriment ensuite. Pour une pièce d’identité, un avis d’imposition ou un contrat, tu préfères sans doute qu’ils ne partent nulle part. Avec Rature, ils ne partent nulle part.'],
      ['Comment le vérifier', 'Ouvre Rature, puis coupe ta connexion Internet : tout continue de fonctionner. Et le <a href="https://github.com/Thorn96/EDITPDF">code est public</a> : n’importe qui peut vérifier ce qu’il fait.'],
      ['Tout ce qu’il faut, gratuitement', 'Remplir des formulaires, signer, corriger le texte d’origine, caviarder, réunir et réorganiser les pages, réduire la taille, protéger par mot de passe, convertir en Word, reconnaître le texte d’un scan.']],
    faq: [{ q: 'Comment Rature peut-il être gratuit ?', a: 'Le site ne coûte presque rien à faire tourner, puisque c’est ton appareil qui fait le travail. Si Rature te rend service, tu peux <a href="https://buymeacoffee.com/leonardguido">offrir un café</a> à son développeur.' },
      { q: 'Faut-il installer quelque chose ?', a: 'Non. Tu peux quand même l’installer comme une application (bouton « Installer ») pour l’ouvrir hors ligne.' },
      { q: 'Y a-t-il des statistiques de visite ?', a: 'Seulement un comptage anonyme des visites, sans cookie. Le contenu de tes PDF n’est jamais concerné.' },
      { q: 'Et la numérisation avec le téléphone ?', a: 'La page photographiée passe directement du téléphone à ton ordinateur, chiffrée. Un service de mise en relation (PeerJS) aide seulement les deux appareils à se trouver : il ne voit jamais le document.' },
      { q: 'Et les gros fichiers ?', a: 'Rature ne dessine que les pages affichées : les gros documents restent fluides. La seule limite est la mémoire de ton appareil.' }] },
];

// ---------- Deux langues : textes de l'interface des guides, liens entre traductions ----------
const EN_PAGES = require('./en.js');
const L = {
  fr: { lang: 'fr', root: '/', locale: 'fr_FR', steps: 'En 3 étapes', faq: 'Questions fréquentes', ready: 'Prêt ? Ça prend une minute.', more: 'Autres guides',
        open: 'Ouvrir l’éditeur', small: 'Gratuit · sans inscription · le fichier reste sur ton appareil', source: 'Code source', other: 'Read in English',
        footer: 'Rature, éditeur PDF gratuit qui n’envoie pas tes fichiers', coffee: 'Offrir un café ☕', coffeeTitle: 'Soutenir Rature',
        art: { approved: 'Lu et approuvé', name: 'Nom :', born: 'Né(e) le :', before: 'au titre de la', old: 'caution', new: 'garantie', form: 'Attestation de caution', wm: 'DOSSIER', erased: 'effacé pour de bon', local: 'rien ne sort d’ici',
               merged: 'un seul PDF', lighter: 'plus léger', photos: 'photos → PDF', word: 'modifiable dans Word', ocrLine: 'Fait à Lyon, le 14 mars', ocrLbl: 'texte reconnu !' } },
  en: { lang: 'en', root: '/en/', locale: 'en_GB', steps: 'In 3 steps', faq: 'Questions', ready: 'Ready? It takes a minute.', more: 'Other guides',
        open: 'Open the editor', small: 'Free · no sign-up · the file stays on your device', source: 'Source code', other: 'Lire en français',
        footer: 'Rature, the free PDF editor that doesn’t upload your files · cross it out, fill it in, sign it', coffee: 'Buy me a coffee ☕', coffeeTitle: 'Support Rature',
        art: { approved: 'Read and approved', name: 'Name:', born: 'Born:', before: 'paid as a', old: 'deposit', new: 'guarantee', form: 'Guarantor form', wm: 'RENTAL', erased: 'erased for good', local: 'nothing leaves here',
               merged: 'one PDF', lighter: 'lighter', photos: 'photos → PDF', word: 'editable in Word', ocrLine: 'Signed on 14 March 2026', ocrLbl: 'text recognised!' } },
};
PAGES.forEach((p, i) => { p.L = L.fr; p.twin = EN_PAGES[i]; EN_PAGES[i].L = L.en; EN_PAGES[i].twin = p; });
const url = p => `${p.L.root}${p.slug}/`;
const alternates = p => [p.L.lang === 'fr' ? p : p.twin, p.L.lang === 'en' ? p : p.twin]
  .map(x => `<link rel="alternate" hreflang="${x.L.lang}" href="${SITE}${url(x)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${SITE}${url(p.L.lang === 'fr' ? p : p.twin)}">`;

// ---------- Page guide ----------
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="5" width="30" height="32" rx="3" fill="#fff" stroke="#15151f" stroke-width="2.4"/><path d="M9 15h18M9 22h13" stroke="#15151f" stroke-width="2.4" stroke-linecap="round"/><path d="M7 23C14 18 24 27 36 16" fill="none" stroke="#e2494f" stroke-width="3.4" stroke-linecap="round"/></svg>';
const page = (p, all) => { const t = p.L; return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(p.title)}</title>
<meta name="description" content="${attr(p.desc)}">
<link rel="canonical" href="${SITE}${url(p)}">
${alternates(p)}
<meta property="og:type" content="article">
<meta property="og:site_name" content="Rature">
<meta property="og:locale" content="${t.locale}">
<meta property="og:url" content="${SITE}${url(p)}">
<meta property="og:title" content="${attr(p.title)}">
<meta property="og:description" content="${attr(p.desc)}">
<meta property="og:image" content="${SITE}/${t.lang === 'en' ? 'og-image-en.jpg' : 'og-image.jpg'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fbf8f0">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon-96.png" type="image/png" sizes="96x96">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/fonts/ui/fonts.css">
<link rel="stylesheet" href="/guides/guide.css">
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="${t.root}">${LOGO}Rature</a><a class="btn" href="${t.root}">${t.open}</a></header>
<main>
<section class="hero">
  <div>
    <p class="eyebrow">${p.eyebrow}</p>
    <h1>${p.h1}</h1>
    <p class="lead">${p.lead}</p>
    <a class="cta" href="${t.root}${p.q}">${p.cta} <span aria-hidden="true">→</span></a>
    <p class="small">${t.small}</p>
  </div>
  <div class="art">${ART(t.art)[p.art]}</div>
</section>
<section>
  <h2>${t.steps}</h2>
  <ol class="steps">${p.steps.map(s => `\n    <li><b>${s.t}</b><span>${s.d}</span></li>`).join('')}
  </ol>
</section>
<section>${p.body.map(([h, x]) => `\n  <div class="card"><h2>${h}</h2><p>${x}</p></div>`).join('')}
</section>
<section>
  <h2>${t.faq}</h2>${p.faq.map(f => `\n  <details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}
</section>
<section class="end">
  <h2>${t.ready}</h2>
  <a class="cta" href="${t.root}${p.q}">${p.cta} <span aria-hidden="true">→</span></a>
</section>
<nav class="more" aria-label="${t.more}">
  <h2>${t.more}</h2>
  <ul>${all.filter(o => o !== p).map(o => `<li><a href="${url(o)}">${o.short}</a></li>`).join('')}</ul>
</nav>
</main>
<footer>${t.footer} · <a href="${t.root}">${t.open}</a> · <a href="${url(p.twin)}" hreflang="${p.twin.L.lang}">${t.other}</a> · <a href="https://github.com/Thorn96/EDITPDF">${t.source}</a></footer>
</div>
<a class="coffee" href="https://buymeacoffee.com/leonardguido" target="_blank" rel="noopener" title="${t.coffeeTitle}">${t.coffee}</a>
</body>
</html>
`; };

// ---------- Éditeur en anglais (/en/) : la page française traduite avec le dictionnaire de l'appli (js/i18n.js) ----------
// Chaque langue a ainsi sa propre adresse, lisible par les moteurs de recherche sans exécuter le JavaScript.
function buildEnglishEditor() {
  const src = fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'), start = src.indexOf('Object.assign(EN, ') + 'Object.assign(EN, '.length;
  const EN = new Function(`return ${src.slice(start, src.indexOf('\n});', start) + 2)}`)();
  const dec = s => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const encText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;'), encAttr = s => encText(s).replace(/"/g, '&quot;');
  const missing = new Set(), SAME = new Set(['Rature', 'B', 'I', 'Rectangle']), hasLetters = s => /\p{L}/u.test(s); // SAME : identiques dans les deux langues
  const swap = (s, enc) => { const raw = dec(s), t = raw.trim(); if (!t) return s; if (EN[t] === undefined) { if (hasLetters(t) && !SAME.has(t)) missing.add(t); return s; } return enc(raw.replace(t, EN[t])); };

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n'); // fins de ligne Windows ou Unix
  const once = (from, to) => { if (!html.includes(from)) throw new Error(`index.html : introuvable « ${from.slice(0, 60)} »`); html = html.replace(from, to); };
  // en-tête : adresse, textes de partage, données structurées (tout le reste est traduit plus bas)
  once('<html lang="fr">', '<html lang="en" data-root="../">');
  html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Fill in, sign, edit the text, redact, merge and convert your PDFs for free, without signing up. Everything happens in your browser: your files are never uploaded.">')
    .replace(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="free PDF editor, edit PDF, fill in PDF, sign PDF, edit PDF text, redact PDF, merge PDF, PDF to Word, OCR, no upload">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Rature","alternateName":"Rature · PDF editor","url":"${SITE}/en/","image":"${SITE}/og-image-en.jpg",
 "description":"Free PDF editor in your browser: fill in forms, sign, edit the existing text, redact, merge, convert to Word, text recognition (OCR). Cross it out, fill it in, sign it.",
 "applicationCategory":"BusinessApplication","operatingSystem":"Windows, macOS, Linux, Android, iOS","browserRequirements":"A recent browser (Chrome, Edge, Firefox, Safari)",
 "inLanguage":"en","isAccessibleForFree":true,"offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},
 "featureList":["Fill in a PDF form","Sign a PDF","Edit the text of a PDF","Redact","Merge and reorder pages","Convert a PDF to Word","Text recognition (OCR)","No file ever uploaded"]}
</script>`);
  once(`<link rel="canonical" href="${SITE}/">`, `<link rel="canonical" href="${SITE}/en/">`);
  once('<meta property="og:locale" content="fr_FR">\n<meta property="og:locale:alternate" content="en_GB">', '<meta property="og:locale" content="en_GB">\n<meta property="og:locale:alternate" content="fr_FR">');
  once(`<meta property="og:url" content="${SITE}/">`, `<meta property="og:url" content="${SITE}/en/">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Rature · Free PDF editor: cross it out, fill it in, sign it">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Fill in, sign and fix your PDFs for free, without signing up. Everything happens in your browser.">')
    .replace(/<meta property="og:image:alt" content="[^"]*">/, '<meta property="og:image:alt" content="Rature, free PDF editor: fill in, sign and fix your PDFs">')
    .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="Rature · Free PDF editor">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="Fill in, sign and fix your PDFs for free, right in your browser.">')
    .replaceAll(`${SITE}/og-image.jpg`, `${SITE}/og-image-en.jpg`);
  once('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="manifest-en.webmanifest">');
  once('aria-label="English version" lang="en">', 'aria-label="English version" lang="fr">'); // bouton de langue : il propose le français ici
  // chemins relatifs : la page est un dossier plus bas
  html = html.replace(/ (src|href)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, ' $1="../$2"');
  // traduction : textes entre les balises et attributs lisibles, hors scripts, styles et dessins
  html = html.replace(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>)|(<[^>]+>)|([^<]+)/g, (m, skip, tag, text) => {
    if (skip) return skip;
    if (tag) return tag.replace(/ (title|placeholder|aria-label|data-tip|alt|data-wm|data-s)="([^"]*)"/g, (_, a, v) => ` ${a}="${swap(v, encAttr)}"`);
    return swap(text, encText);
  });
  // liens vers les guides (après la traduction : ils sont déjà en anglais)
  html = html.replace(/<p class="guides">[\s\S]*?<\/p>/, guideLinks(EN_PAGES, 'Guides:'));
  fs.mkdirSync(path.join(ROOT, 'en'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'en', 'index.html'), html);

  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  Object.assign(man, { name: 'Rature · PDF editor', description: 'Fill in, sign and fix PDFs for free, right in your browser.', lang: 'en', start_url: './en/' });
  man.file_handlers = man.file_handlers?.map(h => ({ ...h, action: './en/' }));
  fs.writeFileSync(path.join(ROOT, 'manifest-en.webmanifest'), JSON.stringify(man, null, 2) + '\n');
  return [...missing].filter(t => html.includes(encText(t))); // seulement ce qui reste réellement en français
}

// ---------- Scripts et styles de l'éditeur : un seul fichier minifié chacun (moins d'octets, moins de requêtes) ----------
// Les sources restent dans js/*.js et css/rature.css ; la page charge js/rature.min.js et css/rature.min.css (esbuild, via npx).
// Ordre = ordre de chargement : les fichiers partagent leurs variables globales, comme des scripts séparés.
const JS = ['core', 'fonts', 'ui', 'document', 'items', 'text', 'media', 'app', 'menu', 'pagetools', 'stamps', 'tools', 'assist', 'convert', 'tabs', 'report', 'relay', 'prefs', 'i18n', 'init'];
function minifyAssets() {
  const { execSync } = require('child_process');
  const esbuild = (input, args) => execSync(`npx -y esbuild@0.24.2 --minify --legal-comments=none --log-level=error ${args}`, { input, cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  const js = JS.map(n => `// ${n}.js\n${fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8')}`).join('\n;\n');
  fs.writeFileSync(path.join(ROOT, 'js', 'rature.min.js'), esbuild(js, '--loader=js'));
  fs.writeFileSync(path.join(ROOT, 'css', 'rature.min.css'), esbuild(fs.readFileSync(path.join(ROOT, 'css', 'rature.css'), 'utf8'), '--loader=css'));
  const kb = f => Math.round(fs.statSync(path.join(ROOT, f)).size / 1024);
  console.log(`js/rature.min.js ${kb('js/rature.min.js')} Ko (sources ${Math.round(js.length / 1024)} Ko), css/rature.min.css ${kb('css/rature.min.css')} Ko (source ${kb('css/rature.css')} Ko)`);
}

// ---------- Fabrication ----------
minifyAssets();
for (const [list, dir] of [[PAGES, ''], [EN_PAGES, 'en']]) for (const p of list) {
  if ([...p.title].length > 70) throw new Error(`Titre trop long (${[...p.title].length} > 70) : ${p.title}`); // tronqué par les moteurs de recherche
  fs.mkdirSync(path.join(ROOT, dir, p.slug), { recursive: true });
  fs.writeFileSync(path.join(ROOT, dir, p.slug, 'index.html'), page(p, list));
}
// liens vers les guides sur l'accueil français (index.html), tenus à jour ici
const lowerFirst = s => /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); // « PDF en Word », « OCR » gardent leurs majuscules
const guideLinks = (list, label) => `<p class="guides">${label} ${list.filter(p => p.art !== 'local').map(p => `<a href="${url(p)}">${lowerFirst(p.short)}</a>`).join(' · ')}</p>`;
{
  const f = path.join(ROOT, 'index.html'), src = fs.readFileSync(f, 'utf8'), out = src.replace(/<p class="guides">[\s\S]*?<\/p>/, guideLinks(PAGES, 'Guides :'));
  if (out !== src) fs.writeFileSync(f, out);
}
const missing = buildEnglishEditor();
const urls = [['/', '1.0'], ['/en/', '1.0'], ...[...PAGES, ...EN_PAGES].map(p => [url(p), '0.8'])];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${SITE}${u}</loc><changefreq>weekly</changefreq><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`${PAGES.length} guides fr + ${EN_PAGES.length} guides en + /en/ + sitemap.xml (${urls.length} adresses)`);
if (missing.length) console.log(`Textes de l'éditeur sans traduction anglaise (restés en français dans /en/) :\n  ${missing.join('\n  ')}`);
