# Plume · Éditeur PDF

Outil gratuit pour remplir, signer et corriger des PDF directement dans le navigateur, sur ordinateur comme sur téléphone.

**Utiliser l'outil :** https://thorn96.github.io/EDITPDF/

## Ce qu'on peut faire

- **Remplir les formulaires PDF** : les champs prévus dans le document (texte, cases, boutons radio, listes) deviennent remplissables, et restent modifiables dans le PDF téléchargé.
- **Ajouter du texte**, sur une ou plusieurs lignes, avec retour à la ligne automatique (poignée bleue), en Helvetica, Times ou Courier, gras ou italique.
- **Corriger le texte existant** : l'ancien texte est réellement supprimé du fichier, le nouveau reprend la police d'origine si elle est installée sur l'ordinateur (Chrome, Edge).
- **Rechercher / remplacer** (Ctrl+F, Ctrl+H) dans tout le document, avec la même suppression réelle de l'ancien texte.
- **Pages scannées** : reconnaissance du texte (OCR) pour corriger une ligne d'un scan ; le PDF devient aussi sélectionnable et cherchable.
- **Cocher, dater, mentions** : ✓, ✗, ●, date du jour, « Lu et approuvé », « Bon pour accord », « Fait à … le … » en un clic.
- **Surligner, dessiner à main levée**, rectangles et cercles (vides ou remplis), traits, flèches, **notes façon post-it**.
- **Caviarder** : ce qui est sous la zone est effacé définitivement (texte, images, dessins).
- **Signatures** tracées à la souris, au pavé tactile ou au stylet, ou **importées depuis une photo** (le papier devient transparent). Mémorisées dans le navigateur.
- **Paraphe sur toutes les pages** : n'importe quel élément se copie au même endroit sur chaque page en un clic.
- **Filigrane** (« COPIE », « Uniquement pour dossier de location »…), **numéros de page**, **en-tête et pied de page**.
- **Images** : insertion depuis un fichier ou par Ctrl+V ; des **photos deviennent un PDF** ; une page s'enregistre en **image PNG**.
- **Numériser avec le téléphone** : photo d'une feuille, coins détectés automatiquement, feuille redressée, rendu couleur, gris ou noir et blanc.
- **Pages** : réorganiser par glisser-déposer, pivoter, supprimer, fusionner plusieurs PDF, extraire des pages.
- **Téléchargement** : choix des pages, réduction de la taille (photos allégées), protection par mot de passe, **partage direct** (e-mail, messagerie…). Les PDF protégés s'ouvrent aussi (avec leur mot de passe).
- **Confort** : zoom, annuler / rétablir, sélection multiple (Maj+clic ou cadre), alignement magnétique, copier-coller entre pages, flèches pour ajuster au point près, sauvegarde automatique du travail en cours, raccourcis clavier (touche `?`).
- **Application installable** et utilisable hors ligne (bouton « Installer » dans Chrome ou Edge).

Tout se passe dans le navigateur : les PDF ne sont envoyés sur aucun serveur.

## Bibliothèques utilisées

[pdf.js](https://mozilla.github.io/pdf.js/) (affichage), [pdf-lib](https://pdf-lib.js.org/) (écriture), [MuPDF.js](https://mupdf.readthedocs.io/) (suppression réelle du texte, mots de passe, compression, redressement des photos), [Tesseract.js](https://tesseract.projectnaptha.com/) (reconnaissance de texte).
