import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';

import photosRouter from './routes/photos';
import printRouter from './routes/print';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env['PORT'] || 3000;
const PHOTOS_DIR = path.join(__dirname, '../photos');

// Ensure photos dir exists
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

app.use(cors());
// 50mb limit for photo dataUrls
app.use(express.json({ limit: '50mb' }));

app.use('/api/photos', photosRouter);
app.use('/api/print', printRouter);
app.use('/api/settings', settingsRouter);

// Serve photo files directly by filename
app.use('/api/photos/file', express.static(PHOTOS_DIR));

// Serve Angular build in production
const angularDist = path.join(__dirname, '../../frontend/dist/frontend/browser');
if (fs.existsSync(angularDist)) {
  app.use(express.static(angularDist));
  // Express 5 requires named wildcard — use regex instead
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(angularDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Photobooth backend running on http://localhost:${PORT}`);
});
