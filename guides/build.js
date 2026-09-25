// Rature · fabrique les pages guides (une par besoin) et le sitemap. À relancer après chaque modification :  node guides/build.js
// Chaque page : /<slug>/index.html, servie telle quelle par Vercel.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SITE = 'https://rature.app';

// ---------- Illustrations : une feuille de cahier et ce qu'on y fait ----------
const sheet = inner => `<svg viewBox="0 0 320 380" aria-hidden="true">
<rect x="30" y="22" width="260" height="336" rx="6" fill="#15151f"/><rect x="20" y="12" width="260" height="336" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M48 58h150" stroke="#15151f" stroke-width="7" stroke-linecap="round"/>${inner}</svg>`;
const lines = (ys, w = [200, 180, 205, 150]) => ys.map((y, i) => `<path d="M48 ${y}h${w[i % w.length]}" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>`).join('');
const ART = {
  sign: sheet(lines([98, 120, 142, 164, 186]) + `<path d="M48 290h170" stroke="#15151f" stroke-width="2" stroke-dasharray="5 5"/>
<path d="M58 280c14-40 30-44 26-8-2 20 18-26 30-12 10 12 12 22 24 2 10-16 18 12 30 4 12-10 22-12 30 8 6 14 22-16 40-8" fill="none" stroke="#1c2a8f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<text x="48" y="238" font-family="Nothing You Could Do, cursive" font-size="20" fill="#1c2a8f">Lu et approuvé</text>`),
  fill: sheet(`<text x="48" y="104" font-family="Schibsted Grotesk, sans-serif" font-size="15" fill="#6f6c78">Nom :</text><path d="M96 108h150" stroke="#b3baec" stroke-width="2"/>
<text x="100" y="102" font-family="Schibsted Grotesk, sans-serif" font-size="18" font-weight="600" fill="#1c2a8f">Camille MARTIN</text>
<text x="48" y="146" font-family="Schibsted Grotesk, sans-serif" font-size="15" fill="#6f6c78">Né(e) le :</text><path d="M122 150h124" stroke="#b3baec" stroke-width="2"/>
<text x="126" y="144" font-family="Schibsted Grotesk, sans-serif" font-size="18" font-weight="600" fill="#1c2a8f">12/03/1994</text>
<rect x="48" y="178" width="20" height="20" rx="3" fill="none" stroke="#15151f" stroke-width="2"/><path d="m52 188 5 5 9-11" fill="none" stroke="#e2494f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M80 188h120" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
<rect x="48" y="212" width="20" height="20" rx="3" fill="none" stroke="#15151f" stroke-width="2"/><path d="M80 222h100" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
${lines([266, 288])}`),
  edit: sheet(lines([98, 120]) + `<text x="48" y="176" font-family="Schibsted Grotesk, sans-serif" font-size="19" fill="#15151f">au titre de la</text>
<text x="176" y="176" font-family="Schibsted Grotesk, sans-serif" font-size="19" fill="#15151f">caution</text><path d="M170 170c20-6 40 6 70-4" fill="none" stroke="#e2494f" stroke-width="4" stroke-linecap="round"/>
<text x="172" y="140" font-family="Nothing You Could Do, cursive" font-size="22" fill="#e2494f">garantie</text>
<rect x="42" y="152" width="214" height="34" rx="5" fill="none" stroke="#e2494f" stroke-width="2" stroke-dasharray="6 5"/>${lines([214, 236, 258, 280])}`),
  rent: `<svg viewBox="0 0 320 380" aria-hidden="true"><g transform="rotate(-6 160 190)"><rect x="34" y="30" width="230" height="300" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>${lines([70, 92, 114], [150, 170, 120])}</g>
<g><rect x="54" y="42" width="240" height="316" rx="6" fill="#15151f" transform="translate(8 8)"/><rect x="54" y="42" width="240" height="316" rx="6" fill="#fff" stroke="#15151f" stroke-width="3"/>
<path d="M80 86h140" stroke="#15151f" stroke-width="7" stroke-linecap="round"/>
<text x="80" y="128" font-family="Schibsted Grotesk, sans-serif" font-size="14" fill="#6f6c78">Attestation de caution</text>
<path d="M80 156h180M80 178h160M80 200h170" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>
<text x="174" y="270" font-family="Young Serif, serif" font-size="30" fill="#e2494f" opacity=".22" transform="rotate(-32 174 250)">DOSSIER</text>
<path d="M92 318c12-34 26-38 22-6-2 16 16-22 26-10 8 10 10 18 20 2 8-14 16 10 26 4" fill="none" stroke="#1c2a8f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="M232 26v44a14 14 0 0 1-28 0V34a8 8 0 0 1 16 0v34" fill="none" stroke="#6f6c78" stroke-width="4" stroke-linecap="round"/></svg>`,
  redact: sheet(lines([98, 120]) + `<rect x="46" y="136" width="170" height="20" rx="2" fill="#15151f"/>${lines([176, 198])}
<rect x="46" y="214" width="120" height="20" rx="2" fill="#15151f"/><path d="M180 224h66" stroke="#d9d4c7" stroke-width="6" stroke-linecap="round"/>${lines([254, 276, 298])}
<text x="84" y="334" font-family="Nothing You Could Do, cursive" font-size="20" fill="#e2494f">effacé pour de bon</text>`),
  local: `<svg viewBox="0 0 320 380" aria-hidden="true"><rect x="38" y="96" width="244" height="168" rx="12" fill="#15151f" transform="translate(8 8)"/>
<rect x="38" y="96" width="244" height="168" rx="12" fill="#fff" stroke="#15151f" stroke-width="3"/><path d="M14 280h292l-18 26H32z" fill="#fff" stroke="#15151f" stroke-width="3" stroke-linejoin="round"/>
<rect x="120" y="116" width="80" height="104" rx="4" fill="#fbf8f0" stroke="#15151f" stroke-width="2.5"/><path d="M134 140h52M134 156h40M134 172h48" stroke="#d9d4c7" stroke-width="5" stroke-linecap="round"/>
<path d="M126 196c10-8 30 8 60-6" fill="none" stroke="#e2494f" stroke-width="4" stroke-linecap="round"/>
<g transform="translate(206 20)"><path d="M18 52a18 18 0 0 1 4-35 24 24 0 0 1 45 4 16 16 0 0 1 3 31z" fill="#fff" stroke="#6f6c78" stroke-width="3"/><path d="M8 8l72 58" stroke="#e2494f" stroke-width="5" stroke-linecap="round"/></g>
<text x="40" y="350" font-family="Nothing You Could Do, cursive" font-size="21" fill="#e2494f">rien ne sort d'ici</text></svg>`,
};

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
    faq: [{ q: 'Comment Rature peut-il être gratuit ?', a: 'Le site ne coûte presque rien à faire tourner, puisque c’est ton appareil qui fait le travail. Si Rature te rend service, tu peux <a href="https://buymeacoffee.com/leonardguik">offrir un café</a> à son développeur.' },
      { q: 'Faut-il installer quelque chose ?', a: 'Non. Tu peux quand même l’installer comme une application (bouton « Installer ») pour l’ouvrir hors ligne.' },
      { q: 'Y a-t-il des statistiques de visite ?', a: 'Seulement un comptage anonyme des visites, sans cookie. Le contenu de tes PDF n’est jamais concerné.' },
      { q: 'Et les gros fichiers ?', a: 'Rature ne dessine que les pages affichées : les gros documents restent fluides. La seule limite est la mémoire de ton appareil.' }] },
];

// ---------- Page ----------
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="5" width="30" height="32" rx="3" fill="#fff" stroke="#15151f" stroke-width="2.4"/><path d="M9 15h18M9 22h13" stroke="#15151f" stroke-width="2.4" stroke-linecap="round"/><path d="M7 23C14 18 24 27 36 16" fill="none" stroke="#e2494f" stroke-width="3.4" stroke-linecap="round"/></svg>';
const page = p => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(p.title)}</title>
<meta name="description" content="${attr(p.desc)}">
<link rel="canonical" href="${SITE}/${p.slug}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Rature">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${SITE}/${p.slug}/">
<meta property="og:title" content="${attr(p.title)}">
<meta property="og:description" content="${attr(p.desc)}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fbf8f0">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/fonts/ui/fonts.css">
<link rel="stylesheet" href="/guides/guide.css">
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="/">${LOGO}Rature</a><a class="btn" href="/">Ouvrir l’éditeur</a></header>
<main>
<section class="hero">
  <div>
    <p class="eyebrow">${p.eyebrow}</p>
    <h1>${p.h1}</h1>
    <p class="lead">${p.lead}</p>
    <a class="cta" href="/${p.q}">${p.cta} <span aria-hidden="true">→</span></a>
    <p class="small">Gratuit · sans inscription · le fichier reste sur ton appareil</p>
  </div>
  <div class="art">${ART[p.art]}</div>
</section>
<section>
  <h2>En 3 étapes</h2>
  <ol class="steps">${p.steps.map(s => `\n    <li><b>${s.t}</b><span>${s.d}</span></li>`).join('')}
  </ol>
</section>
<section>${p.body.map(([h, t]) => `\n  <div class="card"><h2>${h}</h2><p>${t}</p></div>`).join('')}
</section>
<section>
  <h2>Questions fréquentes</h2>${p.faq.map(f => `\n  <details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}
</section>
<section class="end">
  <h2>Prêt ? Ça prend une minute.</h2>
  <a class="cta" href="/${p.q}">${p.cta} <span aria-hidden="true">→</span></a>
</section>
<nav class="more" aria-label="Autres guides">
  <h2>Autres guides</h2>
  <ul>${PAGES.filter(o => o !== p).map(o => `<li><a href="/${o.slug}/">${o.short}</a></li>`).join('')}</ul>
</nav>
</main>
<footer>Rature, éditeur PDF gratuit qui n’envoie pas tes fichiers · <a href="/">Ouvrir l’éditeur</a> · <a href="https://github.com/Thorn96/EDITPDF">Code source</a></footer>
</div>
</body>
</html>
`;

for (const p of PAGES) {
  fs.mkdirSync(path.join(ROOT, p.slug), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p.slug, 'index.html'), page(p));
}
const urls = [['/', '1.0'], ...PAGES.map(p => [`/${p.slug}/`, '0.8'])];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${SITE}${u}</loc><changefreq>weekly</changefreq><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`${PAGES.length} guides + sitemap.xml`);
