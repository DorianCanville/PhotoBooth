import { Injectable } from '@angular/core';

export type FilterValue = 'none' | 'bw' | 'sepia' | 'warm' | 'cold';

export const FILTERS: { value: FilterValue; label: string; css: string }[] = [
  { value: 'none',  label: 'Aucun', css: 'none' },
  { value: 'bw',    label: 'N&B',   css: 'grayscale(1) contrast(1.05)' },
  { value: 'sepia', label: 'Sépia', css: 'sepia(0.85) saturate(1.2)' },
  { value: 'warm',  label: 'Chaud', css: 'saturate(1.15) hue-rotate(-8deg) brightness(1.05)' },
  { value: 'cold',  label: 'Froid', css: 'saturate(1.05) hue-rotate(12deg) brightness(0.98)' },
];

export interface Decoration {
  id: string;
  kind: 'sticker' | 'text' | 'image';
  x: number; // % of canvas width
  y: number; // % of canvas height
  scale: number;
  rotate: number;
  // admin-locked position (cannot be moved/deleted by users)
  locked?: boolean;
  // sticker
  stickerId?: string;
  // text
  text?: string;
  font?: string;
  weight?: number;
  color?: string;
  bg?: string;
  // image
  sourceId?: string;
  imageUrl?: string; // raw data URL, kept so image decos survive a reload
}

export const PHOTO_W = 1600;
export const PHOTO_H = 1200;

const TEXT_FONTS: { label: string; value: string; weight: number }[] = [
  { label: 'Élégant (serif)', value: "Georgia, 'Times New Roman', serif", weight: 600 },
  { label: 'Moderne (sans)', value: "'Inter Tight', Helvetica, sans-serif", weight: 700 },
  { label: 'Festif (script)', value: "'Brush Script MT', cursive", weight: 700 },
  { label: 'Bold (Impact)', value: "Impact, 'Arial Black', sans-serif", weight: 900 },
  { label: 'Mono', value: "'JetBrains Mono', monospace", weight: 600 },
];

@Injectable({ providedIn: 'root' })
export class CompositingService {
  private imageCache = new Map<string, HTMLImageElement>();

  async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) return this.imageCache.get(url)!;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this.imageCache.set(url, img); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  cacheImage(id: string, dataUrl: string): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { this.imageCache.set(id, img); resolve(img); };
      img.onerror = () => resolve(new Image());
      img.src = dataUrl;
    });
  }

  getCached(id: string): HTMLImageElement | undefined {
    return this.imageCache.get(id);
  }

  async composePhoto(
    source: HTMLCanvasElement | HTMLImageElement,
    filter: FilterValue,
    decos: Decoration[],
    withDeco: boolean,
    W = PHOTO_W,
    H = PHOTO_H,
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const filterCss = FILTERS.find(f => f.value === filter)?.css ?? 'none';
    ctx.filter = filterCss;
    ctx.drawImage(source, 0, 0, W, H);
    ctx.filter = 'none';

    if (withDeco) {
      for (const d of decos) {
        this.drawDecoration(ctx, d, W, H);
      }
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  private drawDecoration(ctx: CanvasRenderingContext2D, deco: Decoration, W: number, H: number): void {
    const cx = (deco.x / 100) * W;
    const cy = (deco.y / 100) * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deco.rotate * Math.PI) / 180);

    if (deco.kind === 'sticker' || deco.kind === 'image') {
      const cacheKey = deco.sourceId ?? deco.stickerId ?? deco.id;
      const img = this.imageCache.get(cacheKey);
      if (img) {
        const dw = W * 0.22 * deco.scale;
        const aspect = img.naturalWidth / img.naturalHeight;
        const dh = dw / aspect;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      }
    } else if (deco.kind === 'text') {
      const fontSize = 60 * deco.scale * (W / 1920);
      const fontDef = TEXT_FONTS[1];
      const font = deco.font ?? fontDef.value;
      const weight = deco.weight ?? 700;
      ctx.font = `${weight} ${fontSize}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const m = ctx.measureText(deco.text ?? '');
      const padX = fontSize * 0.5;
      const padY = fontSize * 0.3;
      if (deco.bg && deco.bg !== 'none') {
        const w = m.width + padX * 2;
        const h = fontSize + padY * 2;
        const r = h / 2;
        ctx.fillStyle = deco.bg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r);
        else ctx.rect(-w / 2, -h / 2, w, h);
        ctx.fill();
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
      }
      ctx.fillStyle = deco.color ?? '#ffffff';
      ctx.fillText(deco.text ?? '', 0, 0);
    }

    ctx.restore();
  }
}
