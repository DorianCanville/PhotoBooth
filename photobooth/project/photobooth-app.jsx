// photobooth-app.jsx — Core : constants, audio, hook caméra, helpers
// Charge AVANT photobooth-deco.jsx

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── Constantes ────────────────────────────────────────────────────────────
const FILTERS = [
  { value: 'none', label: 'Aucun', css: 'none' },
  { value: 'bw', label: 'N&B', css: 'grayscale(1) contrast(1.05)' },
  { value: 'sepia', label: 'Sépia', css: 'sepia(0.85) saturate(1.2)' },
  { value: 'warm', label: 'Chaud', css: 'saturate(1.15) hue-rotate(-8deg) brightness(1.05)' },
  { value: 'cold', label: 'Froid', css: 'saturate(1.05) hue-rotate(12deg) brightness(0.98)' },
];

const TIMER_PRESETS = [3, 5, 10, 15];
const BURST_COUNT = 4;
const BURST_COUNTDOWN_SECONDS = 2;   // 2s entre chaque rafale (au lieu de 1s)
const BOOMERANG_FRAMES = 8;
const BOOMERANG_INTERVAL_MS = 100;
const ADMIN_PIN = '1234';

// ─── Stickers preset ───────────────────────────────────────────────────────
const makeSvgUrl = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

const STICKERS = [];

// Note: les stickers presets sont vides — utilise le mode admin pour importer les tiens.

// Présets pour décoration texte custom
const TEXT_FONTS = [
  { label: 'Élégant (serif)', value: "Georgia, 'Times New Roman', serif", weight: 600 },
  { label: 'Moderne (sans)', value: "'Inter Tight', Helvetica, sans-serif", weight: 700 },
  { label: 'Festif (script)', value: "'Brush Script MT', cursive", weight: 700 },
  { label: 'Bold (Impact)', value: "Impact, 'Arial Black', sans-serif", weight: 900 },
  { label: 'Mono', value: "'JetBrains Mono', monospace", weight: 600 },
];

const TEXT_COLOR_PRESETS = ['#ffffff', '#ffd23f', '#ff3d8b', '#d4a574', '#000000'];
const TEXT_BG_PRESETS = ['none', '#000000aa', '#ffffffcc', '#ff3d8b', '#ffd23f', '#d4a574'];

// ─── Audio ─────────────────────────────────────────────────────────────────
let __audioCtx = null;
function beep(freq = 880, dur = 0.06, vol = 0.15) {
  try {
    if (!__audioCtx) __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = __audioCtx.createOscillator();
    const g = __audioCtx.createGain();
    o.frequency.value = freq;
    o.type = 'sine';
    o.connect(g); g.connect(__audioCtx.destination);
    g.gain.setValueAtTime(vol, __audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, __audioCtx.currentTime + dur);
    o.start(); o.stop(__audioCtx.currentTime + dur);
  } catch (e) { /* noop */ }
}
function shutterClick() {
  try {
    if (!__audioCtx) __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = __audioCtx.currentTime;
    const buf = __audioCtx.createBuffer(1, 44100 * 0.08, 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = __audioCtx.createBufferSource();
    src.buffer = buf;
    const g = __audioCtx.createGain();
    g.gain.value = 0.18;
    const f = __audioCtx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400;
    src.connect(f); f.connect(g); g.connect(__audioCtx.destination);
    src.start(t);
  } catch (e) { /* noop */ }
}

// ─── Hook caméra ───────────────────────────────────────────────────────────
function useCamera(active) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!active) return;
    let stream = null;
    let canceled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia indisponible');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
          audio: false,
        });
        if (canceled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        if (!canceled) setError(e.message || String(e));
      }
    })();
    return () => {
      canceled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [active]);
  return { videoRef, ready, error };
}

// ─── Cache images stickers ─────────────────────────────────────────────────
function preloadStickers() {
  window.__stickerCache = window.__stickerCache || {};
  STICKERS.forEach((s) => {
    if (window.__stickerCache[s.id]) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = makeSvgUrl(s.svg);
    img.onload = () => { window.__stickerCache[s.id] = img; };
  });
}

// Cache pour images uploadées par l'utilisateur
window.__userImageCache = window.__userImageCache || {};

function cacheUserImage(id, dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { window.__userImageCache[id] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Cache custom stickers (importés par admin)
window.__stickerCache = window.__stickerCache || {};
window.__customStickers = window.__customStickers || [];

function addCustomSticker(id, label, dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      window.__stickerCache[id] = img;
      const aspect = img.naturalWidth / img.naturalHeight;
      const sticker = { id, label, aspect, imageUrl: dataUrl, custom: true };
      // Pas de mutation de window.__customStickers ici ;
      // la source de vérité est l'état React (sync via useEffect côté App).
      resolve(sticker);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function findSticker(id) {
  return STICKERS.find((s) => s.id === id)
      || (window.__customStickers || []).find((s) => s.id === id);
}

// ─── Dessin d'une décoration sur canvas ───────────────────────────────────
function drawDecorationOnCanvas(ctx, deco, W, H) {
  const cx = (deco.x / 100) * W;
  const cy = (deco.y / 100) * H;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deco.rotate * Math.PI) / 180);

  if (deco.kind === 'sticker') {
    const tpl = findSticker(deco.stickerId);
    const img = window.__stickerCache?.[deco.stickerId];
    if (tpl && img) {
      if (tpl.full) {
        ctx.drawImage(img, -W / 2, -H / 2, W, H);
      } else {
        const dw = W * 0.22 * deco.scale;
        const dh = dw / tpl.aspect;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      }
    }
  } else if (deco.kind === 'image') {
    const cacheKey = deco.sourceId || deco.id;
    const img = window.__userImageCache?.[cacheKey];
    if (img) {
      const baseW = W * 0.22 * deco.scale;
      const aspect = img.naturalWidth / img.naturalHeight;
      const dw = baseW;
      const dh = baseW / aspect;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    }
  } else if (deco.kind === 'text') {
    const fontSize = 60 * deco.scale * (W / 1920);
    const font = deco.font || TEXT_FONTS[1].value;
    const weight = deco.weight || 700;
    ctx.font = `${weight} ${fontSize}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const m = ctx.measureText(deco.text || '');
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.3;
    if (deco.bg && deco.bg !== 'none') {
      const w = m.width + padX * 2;
      const h = fontSize + padY * 2;
      const r = h / 2;
      ctx.fillStyle = deco.bg;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.fill();
      } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
    } else {
      // shadow pour lisibilité
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 4;
    }
    ctx.fillStyle = deco.color || '#ffffff';
    ctx.fillText(deco.text || '', 0, 0);
  }

  ctx.restore();
}

// ─── Composition partagée (capture + éditeur) ──────────────────────────────
const PHOTO_W = 1600;
const PHOTO_H = 1200; // 4:3

// baseSource : HTMLImageElement OU HTMLCanvasElement (caméra pure, sans filtre ni déco)
function composePhoto(baseSource, filterCss, decoList, withDeco, W = PHOTO_W, H = PHOTO_H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.filter = filterCss || 'none';
  ctx.drawImage(baseSource, 0, 0, W, H);
  ctx.filter = 'none';
  if (withDeco && decoList) decoList.forEach((d) => drawDecorationOnCanvas(ctx, d, W, H));
  return c.toDataURL('image/jpeg', 0.92);
}

// Cache de chargement des images de base (par dataURL)
window.__baseImgCache = window.__baseImgCache || {};
function loadImageCached(url) {
  return new Promise((resolve, reject) => {
    if (window.__baseImgCache[url]) { resolve(window.__baseImgCache[url]); return; }
    const img = new Image();
    img.onload = () => { window.__baseImgCache[url] = img; resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

Object.assign(window, {
  FILTERS, TIMER_PRESETS, BURST_COUNT, BURST_COUNTDOWN_SECONDS,
  BOOMERANG_FRAMES, BOOMERANG_INTERVAL_MS, ADMIN_PIN,
  STICKERS, TEXT_FONTS, TEXT_COLOR_PRESETS, TEXT_BG_PRESETS,
  makeSvgUrl, beep, shutterClick, useCamera,
  preloadStickers, cacheUserImage, drawDecorationOnCanvas,
  findSticker, addCustomSticker,
  composePhoto, loadImageCached, PHOTO_W, PHOTO_H,
  idbGet, idbSet, idbDel,
});

// ─── Persistance IndexedDB (photos, stickers, textes, déco officielle) ─────
const __DB_NAME = 'photobooth-db';
const __DB_STORE = 'kv';
let __dbPromise = null;
function idbOpen() {
  if (__dbPromise) return __dbPromise;
  __dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(__DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(__DB_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return __dbPromise;
}
async function idbSet(key, val) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(__DB_STORE, 'readwrite');
      tx.objectStore(__DB_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('idbSet échoué', key, e); }
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(__DB_STORE, 'readonly');
      const r = tx.objectStore(__DB_STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch (e) { console.warn('idbGet échoué', key, e); return undefined; }
}
async function idbDel(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(__DB_STORE, 'readwrite');
      tx.objectStore(__DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('idbDel échoué', key, e); }
}
