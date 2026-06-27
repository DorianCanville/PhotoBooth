import * as path from 'path';

// Source de vérité UNIQUE pour le stockage, partagée par tous les modules
// backend (photos, print, server). Auparavant `print.ts` pointait sur un dossier
// différent (`backend/../photos`) de celui où `photos.ts` écrivait réellement,
// si bien que l'impression ne retrouvait jamais les fichiers. Tout passe
// désormais par ces constantes. Surchargable via la variable d'env PHOTOS_DIR.
export const PHOTOS_DIR = process.env['PHOTOS_DIR'] || '/home/raspberry/Documents/photobooth/Application';
export const META_FILE = path.join(PHOTOS_DIR, 'metadata.json');
export const PRINTER_NAME = process.env['PRINTER_NAME'] || 'Canon_SELPHY_CP1500';
