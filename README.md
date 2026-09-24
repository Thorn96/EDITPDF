# Plume · Éditeur PDF

Outil gratuit pour remplir, signer et corriger des PDF directement dans le navigateur.

**Utiliser l'outil :** https://thorn96.github.io/EDITPDF/

## Ce qu'on peut faire

- **Remplir les formulaires PDF** : les champs prévus dans le document (texte, cases, boutons radio, listes) deviennent remplissables, et restent modifiables dans le PDF téléchargé.
- **Ajouter du texte**, sur une ou plusieurs lignes, avec retour à la ligne automatique (poignée bleue), en Helvetica, Times ou Courier, gras ou italique.
- **Corriger le texte existant** : l'ancien texte est réellement supprimé du fichier, le nouveau reprend la police d'origine si elle est installée sur l'ordinateur (Chrome, Edge).
- **Pages scannées** : reconnaissance du texte (OCR) pour corriger une ligne d'un scan ; le PDF devient aussi sélectionnable et cherchable.
- **Cocher, dater** : ✓, ✗, ● et date du jour en un clic.
- **Surligner, dessiner à main levée**, rectangles, cercles, traits.
- **Caviarder** : ce qui est sous la zone est effacé définitivement (texte, images, dessins).
- **Signatures** tracées à la souris, au pavé tactile ou au stylet, mémorisées dans le navigateur.
- **Images** : insertion depuis un fichier ou par Ctrl+V.
- **Pages** : réorganiser par glisser-déposer, pivoter, supprimer, fusionner plusieurs PDF, extraire des pages.
- **Téléchargement** : choix des pages, réduction de la taille, protection par mot de passe. Les PDF protégés s'ouvrent aussi (avec leur mot de passe).
- **Confort** : zoom, annuler / rétablir, flèches pour ajuster au point près, Ctrl+D pour dupliquer, sauvegarde automatique du travail en cours, raccourcis clavier (touche `?`).
- **Application installable** et utilisable hors ligne (bouton « Installer » dans Chrome ou Edge).

Tout se passe dans le navigateur : les PDF ne sont envoyés sur aucun serveur.

## Bibliothèques utilisées

[pdf.js](https://mozilla.github.io/pdf.js/) (affichage), [pdf-lib](https://pdf-lib.js.org/) (écriture), [MuPDF.js](https://mupdf.readthedocs.io/) (suppression réelle du texte, mots de passe, compression), [Tesseract.js](https://tesseract.projectnaptha.com/) (reconnaissance de texte).
