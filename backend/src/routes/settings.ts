import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const SETTINGS_FILE = path.join(__dirname, '../../settings.json');

const DEFAULTS = {
  theme: 'studio',
  accentOverride: '#d4a574',
  buttonSize: 1,
  adminPin: '1234',
  officialDeco: null as unknown,
  customStickers: [] as unknown[],
  savedTexts: [] as string[],
};

function readSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }; }
  catch { return { ...DEFAULTS }; }
}

function writeSettings(data: unknown) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

router.get('/', (_req: Request, res: Response) => {
  res.json(readSettings());
});

router.put('/', (req: Request, res: Response) => {
  const current = readSettings();
  const updated = { ...current, ...req.body };
  writeSettings(updated);
  res.json(updated);
});

export default router;
