import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

const router = Router();
const PHOTOS_DIR = path.join(__dirname, '../../photos');
const META_FILE = path.join(PHOTOS_DIR, 'metadata.json');
const PRINTER_NAME = process.env['PRINTER_NAME'] || 'Canon_SELPHY_CP1500';

function readMeta() {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')); } catch { return []; }
}
function writeMeta(meta: unknown[]) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// POST /api/print  { photoId, copies? }
router.post('/', (req: Request, res: Response) => {
  const { photoId, copies = 1 } = req.body;
  if (!photoId) { res.status(400).json({ error: 'photoId required' }); return; }

  const meta = readMeta();
  const photo = meta.find((p: { id: string }) => p.id === photoId);
  if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }

  const filePath = path.join(PHOTOS_DIR, photo.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File missing' }); return; }

  const cmd = `lp -d ${PRINTER_NAME} -n ${copies} "${filePath}"`;
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
