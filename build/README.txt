Icône FindX (electron-builder)
================================

Chaîne : pnpm run icons  →  icon.png + icon.ico (générés en local, puis
commitez-les : dist:publish / CI n’exécute pas le script, ils doivent être
présents dans le dépôt pour electron-builder.

Sources (ordre de priorité dans scripts/app-icon.mjs) :

1) build/source.png
   Export carré (idéalement 1024×1024) depuis Figma, Penpot, Photoshop, etc.
   Idéal si le logo n’est pas du vectoriel simple.

2) build/icon-text.svg
   Texte / mot-symbole en SVG. Éditez ce fichier (texte, couleurs, font-size).
   Le script le rasterise en PNG/ICO. Polices : privilégier des polices système
   (Segoe UI, etc.) ou convertir le texte en chemins dans Figma / Illustrator
   (Outline / Create outlines) puis coller le SVG exporté ici pour éviter les
   soucis de police sur la CI.

3) public/favicon.svg
   Utilisé si (1) et (2) ne conviennent pas (renommez ou supprimez icon-text.svg).

---

Texte → PNG / ICO “à la main” (sans le script) :

- Figma : cadre 1024×1024, texte, Export PNG (ou SVG avec texte vectorisé).
- Windows : .ico = format d’icône (ce n’est pas le format .iso qui sert aux images disque).
- En ligne : recherche « png to ico » ; ou ImageMagick :
  magick in.png -define icon:auto-resize=256,128,64,48,32,16 out.ico

---

electron-builder (package.json) : les chemins icon.png / icon.ico sont relatifs
au dossier build (buildResources), pas "build/icon.ico" — ne pas dupliquer "build/".
Après pnpm run icons, lancer pnpm run build:win (pas seulement build:vite + electron-builder
sans générer les icônes). Si l’icône de l’exe ne change pas : supprimer le dossier
findx-app/release et reconstruire ; Windows met souvent l’icône .exe en cache
(recharger l’Explorateur ou vérifier le fichier dans un autre répertoire).
