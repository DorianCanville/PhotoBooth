import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { PHOTOS_DIR, META_FILE, PRINTER_NAME } from '../config';

const router = Router();

function readMeta() {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')); } catch { return []; }
}
function writeMeta(meta: unknown[]) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// POST /api/print  { photoId, variant? }  variant: 'deco' (défaut) | 'raw'
router.post('/', (req: Request, res: Response) => {
  const { photoId, variant = 'deco' } = req.body;
  if (!photoId) { res.status(400).json({ error: 'photoId required' }); return; }

  const meta = readMeta();
  const photo = meta.find((p: { id: string }) => p.id === photoId);
  if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }

  // Choix de la version à imprimer : décorée (défaut) ou brute. On retombe sur
  // la version décorée si la brute n'existe pas.
  const filename = variant === 'raw' && photo.filenameRaw ? photo.filenameRaw : photo.filename;
  const filePath = path.join(PHOTOS_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File missing' }); return; }

  // Toujours 1 copie (décision produit).
  const cmd = `lp -d ${PRINTER_NAME} -n 1 "${filePath}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      res.status(500).json({ error: 'Print failed', detail: stderr });
      return;
    }
    photo.printed = true;
    writeMeta(meta);
    res.json({ ok: true, jobInfo: stdout.trim() });
  });
});

export default router;
