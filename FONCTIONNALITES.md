# État des lieux des fonctionnalités — PhotoBooth

> Photographie de l'existant au **2026-06-25**. À mettre à jour à chaque
> ajout/retrait/changement de comportement (voir [`CLAUDE.md`](CLAUDE.md)).
> Légende statut : ✅ fonctionne · ⚠️ fonctionne avec réserve / fragile · 🐞 anomalie connue.

## 1. Capture photo (`features/capture`)

| Fonction | Statut | Détails |
|---|---|---|
| Aperçu caméra live | ✅ | Flux unique, résolution fixe par objectif. Aperçu plein écran. |
| Choix d'objectif `normal` / `wide` | ✅ | `normal` = 64MP Arducam (par défaut) · `wide` = imx708. Détection par libellé puis par ordre d'énumération. |
| Orientation par objectif | ✅ | Rotation 0/180° **configurable en admin** (`lensRotation`), défaut normal=180 / wide=0. Aperçu + capture. |
| Minuteur 3 / 5 / 10 / 15 s | ✅ | Bips de décompte (`AudioService`). |
| Mode rafale (burst) | ✅ | 4 photos, intervalle ~2 s, mini-décompte entre les prises. |
| Filtres | ❌ | Retirés (décision commanditaire) — plus de sélecteur ni de traitement. |
| Flash visuel + son d'obturateur | ✅ | Overlay blanc + `shutterClick()`. |
| Écran de revue (review) avant sauvegarde | ✅ | Aperçu du résultat avant de garder. |
| Garder / reprendre | ✅ | « Garder » sauvegarde toutes les photos ; « Reprendre » repart en aperçu. |
| Double export deco + brut | ✅ | À la sauvegarde : `<id>.jpg` (avec décorations) et `<id>_raw.jpg` (sans). |

## 2. Décorations (`decoration-*`, `DecorationService`, `CompositingService`)

| Fonction | Statut | Détails |
|---|---|---|
| Stickers personnalisés | ✅ | Import image, placement (x, y, échelle, rotation), persistés dans `settings.json`. |
| Textes enregistrés | ✅ | Objets riches : police, graisse, couleur, fond. Migration depuis ancien format `string[]`. |
| Couche de manipulation tactile | ✅ | `decoration-layer.component` : déplacer / pivoter / redimensionner. |
| Décoration « officielle » | ✅ | Sticker/texte/image imposé sur toutes les photos, activable, position verrouillable. Protégée par PIN. |
| Verrouillage de position (admin) | ✅ | Une déco peut être figée (non déplaçable/supprimable par l'utilisateur). |

## 3. Galerie (`features/gallery`)

| Fonction | Statut | Détails |
|---|---|---|
| Liste des photos | ✅ | Triées du plus récent au plus ancien. |
| Visualisation deco / brut | ✅ | Onglets `deco` / `raw`. |
| Suppression | ✅ | Supprime fichiers + métadonnées. |
| Compteur de photos (badge) | ✅ | Synchronisé avec la capture. |
| Impression | ✅ | Chemin partagé corrigé (`backend/src/config.ts`). Choix version décorée/brute (suit l'onglet) + 1 copie fixe. |

## 4. Éditeur photo (`features/editor`)

| Fonction | Statut | Détails |
|---|---|---|
| Ré-édition d'une photo existante | ✅ | Repart de l'image brute (`_raw`), ré-applique les décorations. |
| Ajout de décorations | ✅ | Réutilise `decoration-layer` + `decoration-picker`. |

## 5. Administration (`features/admin`, `pin-modal`)

| Fonction | Statut | Détails |
|---|---|---|
| Verrouillage par PIN | ✅ | PIN par défaut `1234`, stocké dans `settings.json`. |
| Thème | ✅ | `studio` uniquement (tokens CSS appliqués à la racine). Festif/Minimal et le sélecteur retirés (spéc §7). |
| Couleur d'accent personnalisée | ✅ | `accentOverride`. |
| Taille des boutons | ✅ | `buttonSize` → `--pb-btn-scale`. |
| Gestion stickers / textes / déco officielle | ✅ | Onglets dédiés. |

## 6. Backend (`backend/src`)

| Endpoint | Statut | Détails |
|---|---|---|
| `GET /api/photos` | ✅ | Liste des métadonnées. |
| `POST /api/photos` | ✅ | Sauvegarde deco + brut. |
| `GET /api/photos/:id/file` | ✅ | Fichier d'une photo. |
| `DELETE /api/photos/:id` | ✅ | Supprime fichiers + métadonnées. |
| `GET/PUT /api/settings` | ✅ | Lecture/écriture `settings.json` (merge avec défauts). |
| `POST /api/print` | 🐞 | Voir bug impression ci-dessus ; utilise `lp -d <PRINTER_NAME>`. |
| Service du build Angular en prod | ✅ | Sert `frontend/dist/...` si présent. |

## 7. Points de fragilité transverses

- **Pipeline caméra CSI** : voir mémoire `camera-csi-pipeline`. Toute manipulation
  de résolution/flux peut figer la caméra jusqu'au reboot.
- **Chemins de stockage** : `photos.ts` (absolu) et `print.ts` (relatif) divergent → bug impression.
- **Pas de tests automatisés** : aucune couverture de test à ce jour.
