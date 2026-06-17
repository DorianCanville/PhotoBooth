import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const PHOTOS_DIR = path.join(__dirname, '../../photos');
const META_FILE = path.join(PHOTOS_DIR, 'metadata.json');

interface PhotoMeta {
  id: string;
  filename: string;
  filenameRaw?: string;
  createdAt: string;
  filter: string;
  printed: boolean;
}

function readMeta(): PhotoMeta[] {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeMeta(meta: PhotoMeta[]): void {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

// GET /api/photos
router.get('/', (_req: Request, res: Response) => {
  const meta = readMeta();
  res.json(meta);
});

// GET /api/photos/:id/file
router.get('/:id/file', (req: Request, res: Response) => {
  const meta = readMeta();
  const photo = meta.find(p => p.id === req.params['id']);
  if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }
  const filePath = path.join(PHOTOS_DIR, photo.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File missing' }); return; }
  res.sendFile(filePath);
});

// POST /api/photos  { dataUrl, dataUrlRaw?, filter }
router.post('/', (req: Request, res: Response) => {
  const { dataUrl, dataUrlRaw, filter = 'none' } = req.body;
  if (!dataUrl) { res.status(400).json({ error: 'dataUrl required' }); return; }

  const id = uuidv4();
  const filename = `${id}.jpg`;
  fs.writeFileSync(path.join(PHOTOS_DIR, filename), dataUrlToBuffer(dataUrl));

  let filenameRaw: string | undefined;
  if (dataUrlRaw) {
    filenameRaw = `${id}_raw.jpg`;
    fs.writeFileSync(path.join(PHOTOS_DIR, filenameRaw), dataUrlToBuffer(dataUrlRaw));
  }

  const photo: PhotoMeta = { id, filename, filenameRaw, createdAt: new Date().toISOString(), filter, printed: false };
  const meta = readMeta();
  meta.push(photo);
  writeMeta(meta);

  res.status(201).json(photo);
});

// DELETE /api/photos/:id
router.delete('/:id', (req: Request, res: Response) => {
  const meta = readMeta();
  const idx = meta.findIndex(p => p.id === req.params['id']);
  if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
  const [photo] = meta.splice(idx, 1);
  [photo.filename, photo.filenameRaw].filter(Boolean).forEach(f => {
    const fp = path.join(PHOTOS_DIR, f!);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  writeMeta(meta);
  res.status(204).send();
});

export default router;
