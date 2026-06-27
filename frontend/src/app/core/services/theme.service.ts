import { Injectable, signal } from '@angular/core';

export type ThemeName = 'studio';

export interface ThemeTokens {
  label: string;
  fontDisplay: string;
  fontUI: string;
  fontMono: string;
  bg: string;
  bgGrad: string;
  surface: string;
  surfaceStrong: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  danger: string;
  rSm: string;
  rMd: string;
  rLg: string;
  rPill: string;
  shutterBg: string;
  shutterRing: string;
  shutterCore: string;
  shadow: string;
  glass: string;
  glassBlur: string;
  labelTransform: string;
  labelTracking: string;
  labelWeight: number;
}

const THEMES: Record<ThemeName, ThemeTokens> = {
  studio: {
    label: 'Studio Pro',
    fontDisplay: "'Inter Tight', system-ui, sans-serif",
    fontUI:      "'Inter Tight', system-ui, sans-serif",
    fontMono:    "'JetBrains Mono', ui-monospace, monospace",
    bg:          '#0c0c0e',
    bgGrad:      'radial-gradient(120% 80% at 50% 110%, #1a1a1d 0%, #0c0c0e 60%)',
    surface:        'rgba(255,255,255,0.06)',
    surfaceStrong:  'rgba(255,255,255,0.10)',
    surfaceHover:   'rgba(255,255,255,0.14)',
    border:         'rgba(255,255,255,0.10)',
    borderStrong:   'rgba(255,255,255,0.22)',
    text:       '#f5f3ee',
    textMuted:  'rgba(245,243,238,0.62)',
    textFaint:  'rgba(245,243,238,0.38)',
    accent:     '#d4a574',
    accentText: '#0c0c0e',
    danger:     '#e85d5d',
    rSm:   '10px', rMd: '14px', rLg: '20px', rPill: '999px',
    shutterBg:   '#f5f3ee',
    shutterRing: 'rgba(212,165,116,0.4)',
    shutterCore: '#d4a574',
    labelTransform: 'uppercase', labelTracking: '0.14em', labelWeight: 500,
    shadow:    '0 12px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
    glass:     'rgba(20,20,22,0.55)',
    glassBlur: 'blur(28px) saturate(160%)',
  },
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly currentTheme = signal<ThemeName>('studio');

  apply(name: ThemeName, accentOverride?: string): void {
    this.currentTheme.set(name);
    const t = { ...THEMES[name] };
    if (accentOverride) {
      t.accent = accentOverride;
      t.shutterCore = accentOverride;
    }
    const r = document.documentElement;
    r.style.setProperty('--pb-bg',            t.bg);
    r.style.setProperty('--pb-bg-grad',       t.bgGrad);
    r.style.setProperty('--pb-surface',       t.surface);
    r.style.setProperty('--pb-surface-strong',t.surfaceStrong);
    r.style.setProperty('--pb-surface-hover', t.surfaceHover);
    r.style.setProperty('--pb-border',        t.border);
    r.style.setProperty('--pb-border-strong', t.borderStrong);
    r.style.setProperty('--pb-text',          t.text);
    r.style.setProperty('--pb-text-muted',    t.textMuted);
    r.style.setProperty('--pb-text-faint',    t.textFaint);
    r.style.setProperty('--pb-accent',        t.accent);
    r.style.setProperty('--pb-accent-text',   t.accentText);
    r.style.setProperty('--pb-danger',        t.danger);
    r.style.setProperty('--pb-r-sm',          t.rSm);
    r.style.setProperty('--pb-r-md',          t.rMd);
    r.style.setProperty('--pb-r-lg',          t.rLg);
    r.style.setProperty('--pb-r-pill',        t.rPill);
    r.style.setProperty('--pb-shutter-bg',    t.shutterBg);
    r.style.setProperty('--pb-shutter-ring',  t.shutterRing);
    r.style.setProperty('--pb-shutter-core',  t.shutterCore);
    r.style.setProperty('--pb-shadow',        t.shadow);
    r.style.setProperty('--pb-glass',         t.glass);
    r.style.setProperty('--pb-glass-blur',    t.glassBlur);
    r.style.setProperty('--pb-font-display',  t.fontDisplay);
    r.style.setProperty('--pb-font-ui',       t.fontUI);
    r.style.setProperty('--pb-font-mono',     t.fontMono);
    r.style.setProperty('--pb-label-transform', t.labelTransform);
    r.style.setProperty('--pb-label-tracking',  t.labelTracking);
    r.style.setProperty('--pb-label-weight',    String(t.labelWeight));
  }
}
