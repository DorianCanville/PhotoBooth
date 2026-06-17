import { Injectable, signal, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Decoration, CompositingService } from './compositing.service';

export interface CustomSticker {
  id: string;
  label: string;
  dataUrl: string;
  aspect: number;
  // Optional admin-defined default placement on the frame
  defaultX?: number;
  defaultY?: number;
  defaultScale?: number;
  defaultRotate?: number;
  lockedPosition?: boolean;
}

export interface SavedText {
  id: string;
  text: string;
  font: string;
  weight: number;
  color: string;
  bg: string;
  byAdmin?: boolean;
}

export interface OfficialDeco extends Decoration {
  enabled: boolean;
}

/** Admin sticker being placed/edited on the canvas before being saved to the library. */
export interface DraftSticker {
  id: string;
  label: string;
  dataUrl: string;
  aspect: number;
  x: number; y: number; scale: number; rotate: number;
  lockedPosition: boolean;
  editId?: string; // present when editing an existing sticker
}

let _seq = 0;
const newId = (p = 'deco') => `${p}-${Date.now()}-${_seq++}`;

@Injectable({ providedIn: 'root' })
export class DecorationService {
  private storage = inject(StorageService);
  private compositing = inject(CompositingService);

  decorations = signal<Decoration[]>([]);
  customStickers = signal<CustomSticker[]>([]);
  savedTexts = signal<SavedText[]>([]);
  officialDeco = signal<OfficialDeco | null>(null);

  // ── Shared admin state (picker is the admin surface, like the mockup) ──────
  adminUnlocked = signal(false);
  private adminPin = '1234';

  // Sticker placement draft (admin), rendered live on the canvas
  draftSticker = signal<DraftSticker | null>(null);
  updateDraftSticker(patch: Partial<DraftSticker>): void {
    this.draftSticker.update(d => d ? { ...d, ...patch } : d);
  }

  async loadFromStorage(): Promise<void> {
    try {
      const s = await this.storage.getSettings();
      this.customStickers.set((s['customStickers'] as CustomSticker[]) ?? []);
      this.savedTexts.set(this.migrateSavedTexts(s['savedTexts']));
      const od = (s['officialDeco'] as OfficialDeco) ?? null;
      this.officialDeco.set(od);
      // Re-cache the official image so it renders/exports after a reload
      if (od && od.kind === 'image' && od.imageUrl) {
        this.compositing.cacheImage(od.sourceId ?? od.id, od.imageUrl);
      }
      this.adminPin = (s['adminPin'] as string) || '1234';
    } catch { /* backend may not be up yet */ }
  }

  /** Old builds stored savedTexts as string[]; upgrade to rich objects. */
  private migrateSavedTexts(raw: unknown): SavedText[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((t): SavedText => {
      if (typeof t === 'string') {
        return { id: newId('txt'), text: t, font: "'Inter Tight', Helvetica, sans-serif", weight: 700, color: '#ffffff', bg: 'none' };
      }
      return t as SavedText;
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  tryUnlock(pin: string): boolean {
    if (pin === this.adminPin) { this.adminUnlocked.set(true); return true; }
    return false;
  }
  lockAdmin(): void { this.adminUnlocked.set(false); }

  // ── Placed decorations ──────────────────────────────────────────────────────
  add(partial: Omit<Decoration, 'id'>): string {
    const id = newId('d');
    this.decorations.update(list => [...list, { ...partial, id }]);
    return id;
  }

  update(id: string, patch: Partial<Decoration>): void {
    this.decorations.update(list => list.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  remove(id: string): void {
    this.decorations.update(list => list.filter(d => d.id !== id));
  }

  clear(): void {
    this.decorations.set([]);
  }

  getAllDecos(includeOfficial: boolean): Decoration[] {
    const list = [...this.decorations()];
    const official = this.officialDeco();
    if (includeOfficial && official?.enabled) list.push(official);
    return list;
  }

  // ── Custom stickers ─────────────────────────────────────────────────────────
  async addCustomSticker(sticker: Omit<CustomSticker, 'id'> & { id?: string }): Promise<CustomSticker> {
    const full: CustomSticker = { ...sticker, id: sticker.id ?? newId('cs') };
    this.customStickers.update(list => [...list, full]);
    await this.persistStickers();
    return full;
  }

  async updateCustomSticker(id: string, patch: Partial<CustomSticker>): Promise<void> {
    this.customStickers.update(list => list.map(s => s.id === id ? { ...s, ...patch } : s));
    await this.persistStickers();
  }

  async removeCustomSticker(id: string): Promise<void> {
    this.customStickers.update(list => list.filter(s => s.id !== id));
    await this.persistStickers();
  }

  findSticker(id: string): CustomSticker | undefined {
    return this.customStickers().find(s => s.id === id);
  }

  private async persistStickers(): Promise<void> {
    await this.storage.saveSettings({ customStickers: this.customStickers() });
  }

  // ── Saved texts (rich objects) ───────────────────────────────────────────────
  async addSavedText(cfg: Omit<SavedText, 'id'>): Promise<void> {
    const exists = this.savedTexts().some(s =>
      s.text === cfg.text && s.font === cfg.font && s.color === cfg.color && s.bg === cfg.bg);
    if (exists) return;
    this.savedTexts.update(list => [...list, { ...cfg, id: newId('txt') }]);
    await this.persistTexts();
  }

  async updateSavedText(id: string, cfg: Partial<SavedText>): Promise<void> {
    this.savedTexts.update(list => list.map(s => s.id === id ? { ...s, ...cfg } : s));
    await this.persistTexts();
  }

  async removeSavedText(id: string): Promise<void> {
    this.savedTexts.update(list => list.filter(s => {
      if (s.id !== id) return true;
      // Admin-owned texts can only be removed in admin mode
      return !!s.byAdmin && !this.adminUnlocked();
    }));
    await this.persistTexts();
  }

  async clearSavedTexts(): Promise<void> {
    this.savedTexts.set([]);
    await this.persistTexts();
  }

  private async persistTexts(): Promise<void> {
    await this.storage.saveSettings({ savedTexts: this.savedTexts() });
  }

  // ── Official deco ────────────────────────────────────────────────────────────
  async setOfficialDeco(deco: OfficialDeco | null): Promise<void> {
    this.officialDeco.set(deco);
    await this.storage.saveSettings({ officialDeco: deco });
  }

  /** In-memory patch during admin drag; call persistOfficial() on pointer up. */
  patchOfficial(patch: Partial<OfficialDeco>): void {
    this.officialDeco.update(d => d ? { ...d, ...patch } : d);
  }
  async persistOfficial(): Promise<void> {
    await this.storage.saveSettings({ officialDeco: this.officialDeco() });
  }
}
