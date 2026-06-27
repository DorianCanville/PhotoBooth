# CLAUDE.md — Règles de travail sur le projet PhotoBooth

Ce fichier est lu automatiquement à chaque session. **Respecte-le à la lettre.**

## Pourquoi ces règles existent

Des modifications répétées ont provoqué des régressions et des comportements non
voulus (ex. pipeline caméra CSI bloqué jusqu'au reboot). Pour éviter de refaire
les mêmes erreurs, le projet est encadré par trois documents vivants. **Tu dois
les tenir à jour.**

| Fichier | Rôle | Quand le mettre à jour |
|---|---|---|
| [`JOURNAL.md`](JOURNAL.md) | Journal de bord chronologique de **toutes** les modifications | **Après chaque modification de code**, sans exception |
| [`FONCTIONNALITES.md`](FONCTIONNALITES.md) | État des lieux des fonctionnalités existantes | Quand une fonctionnalité est ajoutée / retirée / change de comportement |
| [`SPECIFICATION.md`](SPECIFICATION.md) | Spécification du comportement attendu (contrat) | Avant d'implémenter un nouveau comportement ; sert de garde-fou |

## Règle n°1 — Tenir le journal de bord

**Après toute modification de code**, ajoute une entrée en haut du tableau de
[`JOURNAL.md`](JOURNAL.md) avec : date, fichiers touchés, ce qui change, pourquoi,
et le risque/régression potentielle. Ne reporte jamais cette étape « pour plus
tard » : c'est la dernière action de chaque tâche de code.

## Règle n°2 — Vérifier la spécification avant de coder

Avant de modifier un comportement, lis la section concernée de
[`SPECIFICATION.md`](SPECIFICATION.md). Si ta modification contredit la spéc :
- soit elle est une erreur → ne la fais pas ;
- soit la spéc doit évoluer → propose la mise à jour de la spéc **avant** de coder,
  et fais-la valider.

## Règle n°3 — Zones sensibles (ne pas casser)

- **Pipeline caméra CSI** (`camera.service.ts`) : NE PAS changer la résolution
  en cours de flux (`applyConstraints`), NE PAS stopper/recréer le flux en
  boucle, NE PAS basculer en « still mode ». Cela fige libcamera jusqu'au
  redémarrage du Raspberry. Flux unique, résolution fixe, capture depuis le flux
  live. Voir mémoire `camera-csi-pipeline` et `camera-fov-aspect`.
- **Caméras montées à l'envers** : la 64MP (`normal`) est retournée de 180°
  (aperçu + capture). Conserver ce comportement.
- **Format de sortie 4:3** : l'écran est 16:9, la photo reste 4:3 (bandes noires
  assumées, WYSIWYG voulu). Ne pas « corriger ».

## Démarrage du projet

```bash
./start-photobooth.sh        # ou : cd PhotoBooth && npm run dev
```
Backend Express : http://localhost:3000 · Frontend Angular : servi par Vite (dev).

## Stack

- **Backend** : Node + Express 5 + TypeScript (`PhotoBooth/backend`).
- **Frontend** : Angular 21 standalone + signals (`PhotoBooth/frontend`).
- **Maquette de référence** : `PhotoBooth/photobooth/project/*.jsx` (mockups, non exécutés).
