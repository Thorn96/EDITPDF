# Plume · Éditeur PDF

Outil gratuit pour remplir, signer et corriger des PDF directement dans le navigateur, sur ordinateur comme sur téléphone. En français et en anglais.

**Utiliser l'outil :** https://editpdf-tau.vercel.app/

## Ce qu'on peut faire

**Remplir et écrire**
- **Formulaires PDF** : les champs prévus dans le document deviennent remplissables et le restent dans le PDF téléchargé.
- **Rendre un PDF remplissable** : dessine des champs (texte, texte sur plusieurs lignes, case à cocher, liste de choix).
- **Texte** sur une ou plusieurs lignes, retour à la ligne automatique, 8 polices (Arial / Helvetica, Times New Roman, Courier New, Calibri, Cambria, Segoe UI, Verdana, Lato), gras, italique.
- **Corriger le texte existant, comme dans Acrobat** : un clic dans un paragraphe l'édite en entier, et le texte se redistribue sur ses lignes (justifié si l'original l'était). L'ancien texte est réellement supprimé du fichier ; le nouveau est écrit avec la police intégrée au PDF lui-même, ligatures comprises, au même endroit et avec le même espacement. Seul ce qui change est réécrit : un texte non retouché reste identique au pixel près. Une ligne qui mêle normal et **gras** garde ses styles (gras / italique applicables à une sélection).
- **Remplir avec mon profil** : nom, adresse, date de naissance… gardés dans le navigateur, placés d'un clic dans les champs du formulaire ou après les libellés imprimés (« Nom : ……… »).
- **Modèles** : un document prêt à resservir, rouvert en un clic.
- **Textes illisibles réparés** : les ligatures mal déclarées par Word (« cau�on », « atestons ») sont retrouvées à l'ouverture, pour l'édition, la recherche et le copier-coller.
- **Rechercher / remplacer** dans tout le document, avec la même suppression réelle.
- **Pages scannées** : reconnaissance du texte (OCR, français et anglais) pour corriger une ligne ou un paragraphe d'un scan ; la police, la taille et l'espacement sont retrouvés d'après l'image. Le PDF devient aussi cherchable.
- **Orthographe** : correcteur dans la langue du document, apostrophe typographique (’) si le document l'emploie.
- **Cocher, dater, mentions** : ✓, ✗, ●, date du jour, « Lu et approuvé », « Bon pour accord », « Fait à … le … ».

**Signer, annoter**
- **Signatures** tracées à la souris, au pavé tactile ou au stylet, ou importées depuis une photo.
- **Tampons personnalisés** : « PAYÉ », « REÇU LE {date} », « COPIE CONFORME »… (encadré, arrondi, double), ou tampon d'entreprise depuis une image.
- **Paraphe sur toutes les pages** en un clic.
- **Surligner, dessiner**, rectangles et cercles (vides ou remplis), traits, flèches, notes façon post-it, images.
- **Caviarder** : ce qui est sous la zone est effacé définitivement ; **caviardage automatique** des e-mails, téléphones, IBAN, n° de sécurité sociale, cartes bancaires.
- **Liens cliquables** (adresse web, e-mail, page du document) et **signets** (table des matières, proposés d'après les titres).
- **Réglages de chaque élément** (clic droit) : premier plan / arrière-plan, rotation, opacité, verrouillage, dupliquer, copier sur toutes les pages.

**Pages et document**
- **Vue en grille** : réorganiser, pivoter, dupliquer, supprimer, insérer une page blanche, extraire.
- **Recadrer** une page, **découper** le PDF en plusieurs fichiers (ZIP), **fusionner** plusieurs PDF, **photos → PDF**, **page → image**.
- **Numériser avec le téléphone** : coins détectés, feuille redressée, couleur / gris / noir et blanc.
- **Filigrane**, **numéros de page**, **en-tête et pied de page**.
- **Extraire le texte**, **comparer deux PDF** (texte et image, page par page).
- **Convertir** : PDF → Word (.docx) avec paragraphes et titres ; document Word (.docx) → PDF.
- **Traitement par lot** : filigrane, compression, format A4, mot de passe sur plusieurs PDF d'un coup.
- **Téléchargement** : aperçu avant / après, choix des pages, format A4, réduction de la taille, mot de passe, partage direct. Les PDF protégés s'ouvrent aussi ; un PDF signé électroniquement est signalé.

**Confort**
- **Onglets** : plusieurs documents ouverts à la fois.
- **Palette de commandes** (`Ctrl K`) : n'importe quelle action en tapant quelques lettres.
- **Historique** des modifications : un clic revient à n'importe quelle étape.
- Zoom (aussi à deux doigts), annuler / rétablir, sélection multiple, alignement magnétique, copier-coller entre pages, sauvegarde automatique, raccourcis clavier (touche `?`), visite guidée.
- Tablette et stylet : paume ignorée pendant l'écriture au stylet, commandes agrandies sur écran tactile.
- Thème clair, sombre ou automatique ; couleurs favorites ; derniers réglages mémorisés.
- Gros documents fluides : seules les pages affichées sont dessinées.
- Application installable et utilisable hors ligne.

Tout se passe dans le navigateur : les PDF ne sont envoyés sur aucun serveur, et toutes les bibliothèques et polices sont hébergées sur le site lui-même.

## Organisation du code

- `index.html` : la page ; `css/plume.css` : l'apparence.
- `js/` : le code, par domaine (`core` utilitaires et historique, `document` pages et rendu, `items` éléments posés, `app` fabrication du PDF, `assist` profil, modèles, caviardage auto, liens et signets, `convert` Word, `tabs` onglets, `i18n` traduction anglaise…).
- `lib/` : pdf.js, pdf-lib, fontkit, MuPDF.js, Tesseract.js ; `fonts/` : polices de l'interface et polices embarquées dans les PDF.

## Bibliothèques et polices

[pdf.js](https://mozilla.github.io/pdf.js/) (Apache 2.0), [pdf-lib](https://pdf-lib.js.org/) et fontkit (MIT), [MuPDF.js](https://mupdf.readthedocs.io/) (AGPL 3.0), [Tesseract.js](https://tesseract.projectnaptha.com/) (Apache 2.0).
Polices libres : Liberation, Carlito, Caladea, Selawik, Lato (SIL OFL), DejaVu (licence libre DejaVu), Bricolage Grotesque et Fraunces (SIL OFL). Les licences sont dans les dossiers `lib/` et `fonts/`.
