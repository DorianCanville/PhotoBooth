# Spécification logicielle — PhotoBooth

> **But** : décrire le comportement *attendu* du logiciel pour servir de contrat
> et éviter les dérives. Avant toute modification de comportement, consulter la
> section concernée (voir [`CLAUDE.md`](CLAUDE.md), règle n°2).
>
> Statut du document : **brouillon — à affiner ensemble**. Les sections marquées
> 🔧 sont à discuter/décider. L'existant est décrit dans [`FONCTIONNALITES.md`](FONCTIONNALITES.md).

## 0. Contexte & matériel

- Borne photo sur **Raspberry Pi** (libcamera / rp1-cfe), écran tactile.
- Deux caméras CSI : **64MP Arducam Hawkeye** (objectif `normal`, par défaut,
  montée à l'envers → rotation 180°) et **imx708** (objectif `wide`).
- Imprimante : Canon SELPHY CP1500 via CUPS (`lp`).
- Usage : événementiel (mariages, fêtes) — utilisateurs non techniques.

## 1. Principes directeurs (invariants)

Ces règles ne doivent pas être violées sans décision explicite :

1. **WYSIWYG 4:3** — la photo finale est en **4:3**. L'écran 16:9 affiche des
   bandes noires : c'est voulu, l'utilisateur voit le cadrage réel.
2. **Stabilité caméra avant tout** — flux caméra **unique**, **résolution fixe**,
   capture depuis le flux live. Interdit : changer la résolution en cours de flux,
   recréer le flux en boucle, basculer en still mode. (Cause de blocage matériel.)
3. **Simplicité d'usage** — parcours sans friction pour un invité : aperçu →
   déclencher → revue → garder/imprimer. Les réglages avancés sont derrière le PIN admin.
4. **Persistance fiable** — une photo « gardée » ne doit jamais être perdue ;
   métadonnées et fichiers cohérents.

## 2. Parcours utilisateur (nominal)

1. **Aperçu** : caméra live, choix objectif / minuteur / mode.
2. **Déclenchement** : décompte sonore → capture (simple ou rafale ×4).
3. **Revue** : aperçu du résultat.
4. **Décision** : *Garder* (sauvegarde deco + brut) ou *Reprendre*.
5. **Galerie** : revoir, ré-éditer, supprimer, imprimer.

## 3. Caméra

| Aspect | Spécifié |
|---|---|
| Objectif par défaut | `normal` (64MP) |
| Choix objectif | **Visible par l'invité** sur l'aperçu (bascule normal/wide libre) |
| Résolution `normal` | 2312×1736 (4:3, plein champ) |
| Résolution `wide` | 2304×1296 (16:9, plein champ) |
| Rotation | `normal` retournée 180° (aperçu + capture) |
| Zoom | **Réglage admin fixe** par objectif (l'invité ne le modifie pas) ; défaut 1:1 |
| Capture | `captureFrame()` depuis le flux live, recadrage centré pour zoom |
| Interdits | applyConstraints en cours, stop/start répétés, still mode |

> 🐞 **Anomalie à traiter — orientation** : l'aperçu/la photo apparaît parfois
> retourné(e) dans le mauvais sens selon l'objectif. La rotation 180° est
> aujourd'hui codée en dur par objectif (`UPSIDE_DOWN`). **Spéc cible** :
> l'orientation doit être correcte (sujet à l'endroit) pour **chaque** objectif
> de façon fiable ; envisager un réglage de rotation par objectif côté admin si
> le montage matériel varie.

## 4. Capture & rafale

- Minuteurs autorisés : **3, 5, 10 s** (15 s retiré).
- Rafale : **4 photos** (figé), intervalle ~2 s, mini-décompte 2 s entre prises.
- Chaque capture produit deux JPEG (qualité 0.95) : avec décorations + brut.

## 5. Filtres

- **Aucun filtre.** La fonctionnalité de filtres a été retirée (décision
  commanditaire). Pas de sélecteur en aperçu, en revue ni à la ré-édition ;
  les photos sont enregistrées telles quelles (décorations uniquement).

## 6. Décorations

- Types : `sticker`, `text`, `image`.
- Position en **% du canvas** (indépendante de la résolution de sortie).
- **Création réservée à l'admin** : l'admin importe/configure stickers et textes ;
  l'invité ne fait que **les utiliser** (placer ceux mis à disposition). L'invité
  n'importe pas ses propres images.
- **Manipulation par l'invité** : libre (déplacer / pivoter / redimensionner /
  supprimer) **sauf** les éléments verrouillés par l'admin.
- Décoration **officielle** : configurée par l'admin (protégée par PIN), position
  **verrouillée**. Particularité : l'**invité peut choisir de l'afficher ou non**
  sur sa photo (visibilité à sa main, mais pas le positionnement).
- Persistance : stickers, textes et déco officielle dans `settings.json`.

## 7. Stockage & format de sortie

| Élément | Spécifié | État actuel |
|---|---|---|
| Dossier photos | unique, **configurable depuis l'admin**, source de vérité partagée par tout le backend | ⚠️ divergent + codé en dur (voir §10) |
| Nommage | `<uuid>.jpg` (deco) + `<uuid>_raw.jpg` (brut) | ✅ |
| Métadonnées | `metadata.json` : id, filename, filenameRaw, createdAt, printed | ✅ |
| Sortie | 4:3, largeur bornée à [2400, 4000] px | ✅ |
| **Rétention** | Pas de limite auto. **Purge manuelle en admin** : « tout effacer » et/ou « effacer avant une date ». | 🔧 à implémenter |

## 7bis. Galerie & ré-édition

- **Suppression** : réservée à l'**admin** (PIN requis). L'invité ne peut pas
  supprimer une photo. *(Divergence avec l'actuel : aujourd'hui n'importe qui peut
  supprimer — à corriger.)*
- **Ré-édition** d'une photo sauvegardée (filtre/déco) : **non destructive**.
  L'original (brut `_raw`) est conservé ; l'édition produit une **nouvelle photo**
  ajoutée à la galerie. *(Divergence possible avec l'actuel — à vérifier/corriger.)*
- Visualisation deco / brut conservée (onglets).

## 8. Impression

- Via `lp -d <PRINTER_NAME> -n <copies> <fichier>`.
- **Choix de la version à imprimer** : décorée (`<id>.jpg`) **ou** brute (`<id>_raw.jpg`).
- **Copies** : **toujours 1** (pas de sélecteur de copies).
- Au succès : marquer `printed = true` dans les métadonnées.
- 🐞 **Anomalie connue à corriger** : `print.ts` lit un `metadata.json` différent
  de celui écrit par `photos.ts` (chemin relatif `backend/../../photos` vs chemin
  absolu `Application/`). **Spéc cible** : un seul `PHOTOS_DIR` partagé par tous
  les modules backend (constante/variable d'env commune).

## 9. Administration

- Accès par **PIN** (défaut `1234`, modifiable, stocké côté backend en clair —
  acceptable pour une borne locale hors-ligne). **Changement du PIN imposé à la
  première configuration.**
- **Thème** : on conserve **uniquement `studio`**. Festif et Minimal sont retirés
  (plus de sélecteur de thème). *(Divergence avec l'actuel — à nettoyer.)*
- Réglages : accent, taille boutons, **zoom par objectif**, **dossier de
  stockage des photos**, gestion stickers/textes/déco officielle.
- **Purge des photos** : « tout effacer » et/ou « effacer avant une date ».

## 10. Écarts spéc ↔ existant à résorber

Issus de la revue du 2026-06-25 (par ordre suggéré de priorité) :

1. ✅ **Chemin photos divergent** (`photos.ts` vs `print.ts`) → corrigé : module
   `backend/src/config.ts` partagé. *(Reste à faire : rendre `PHOTOS_DIR` réglable en admin — #8.)*
2. ✅ **Orientation caméra** : rotation configurable par objectif (0/180°) en admin
   (`lensRotation`). À valider sur le matériel.
3. ✅ **Impression** : choix décorée/brute (suit l'onglet galerie) + 1 copie fixe.
4. **Suppression galerie** : restreindre à l'admin (PIN).
5. **Ré-édition non destructive** : créer une nouvelle photo, conserver l'original.
6. ✅ **Rotation/zoom admin** : rotation faite (#2). *Zoom admin fixe* encore à faire.
7. **Thèmes** : ne garder que `studio`, retirer Festif/Minimal et le sélecteur.
8. **Dossier de stockage configurable** en admin (au lieu du chemin en dur).
9. **Purge admin** des photos (tout / avant date).
10. **Minuteurs** : retirer 15 s (garder 3/5/10).
11. **Forcer le changement de PIN** à la première configuration.
12. **Aucun test automatisé** (dette transverse).

## 11. Hors périmètre (non-objectifs)

- Pas de cloud / pas d'upload externe (borne locale).
- Pas de gestion multi-utilisateurs / comptes.
- 🔧 *À confirmer avec le commanditaire.*
