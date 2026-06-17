import { Component, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DecorationService, CustomSticker, SavedText } from '../../core/services/decoration.service';
import { CompositingService } from '../../core/services/compositing.service';

type PickerTab = 'stickers' | 'texte';

const TEXT_FONTS = [
  { label: 'Élégant', value: "Georgia, 'Times New Roman', serif", weight: 600 },
  { label: 'Moderne',  value: "'Inter Tight', Helvetica, sans-serif", weight: 700 },
  { label: 'Festif',   value: "'Brush Script MT', cursive",           weight: 700 },
  { label: 'Bold',     value: "Impact, 'Arial Black', sans-serif",     weight: 900 },
  { label: 'Mono',     value: "'JetBrains Mono', monospace",           weight: 600 },
];

const COLOR_PRESETS = ['#ffffff', '#ffd23f', '#ff3d8b', '#d4a574', '#000000'];
const BG_PRESETS = ['none', '#000000aa', '#ffffffcc', '#ff3d8b', '#ffd23f', '#d4a574'];

@Component({
  selector: 'app-decoration-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './decoration-picker.component.html',
  styleUrl: './decoration-picker.component.scss',
})
export class DecorationPickerComponent {
  decoService = inject(DecorationService);
  compositing = inject(CompositingService);

  close = output<void>();
  importSticker = output<{ label: string; dataUrl: string }>();
  editSticker = output<CustomSticker>();
  openOfficial = output<void>();

  tab = signal<PickerTab>('stickers');
  tabs: PickerTab[] = ['stickers', 'texte'];

  readonly textFonts = TEXT_FONTS;
  readonly colorPresets = COLOR_PRESETS;
  readonly bgPresets = BG_PRESETS;

  // Text form
  textValue = '';
  textFont = TEXT_FONTS[1];
  textColor = '#ffffff';
  textBg = 'none';
  editingTextId = signal<string | null>(null);

  get adminUnlocked(): boolean { return this.decoService.adminUnlocked(); }

  // ── Stickers ────────────────────────────────────────────────────────────────
  addSticker(s: CustomSticker): void {
    this.compositing.cacheImage(s.id, s.dataUrl);
    this.decoService.add({
      kind: 'sticker',
      stickerId: s.id,
      x: s.defaultX ?? 50,
      y: s.defaultY ?? 50,
      scale: s.defaultScale ?? 1,
      rotate: s.defaultRotate ?? 0,
      locked: !!s.lockedPosition,
    });
    this.close.emit();
  }

  onStickerFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const label = file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Custom';
      this.importSticker.emit({ label, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  deleteSticker(id: string): void {
    this.decoService.removeCustomSticker(id);
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  submitText(): void {
    if (!this.textValue.trim()) return;
    const cfg = {
      text: this.textValue.trim(),
      font: this.textFont.value,
      weight: this.textFont.weight,
      color: this.textColor,
      bg: this.textBg,
    };
    const editId = this.editingTextId();
    if (editId) {
      this.decoService.updateSavedText(editId, cfg);
      this.editingTextId.set(null);
    } else {
      this.decoService.add({ kind: 'text', ...cfg, x: 50, y: 50, scale: 1, rotate: 0 });
      this.decoService.addSavedText({ ...cfg, byAdmin: this.adminUnlocked });
      this.close.emit();
    }
    this.resetTextForm();
  }

  addSavedTextToFrame(s: SavedText): void {
    this.decoService.add({
      kind: 'text', text: s.text, font: s.font, weight: s.weight, color: s.color, bg: s.bg,
      x: 50, y: 50, scale: 1, rotate: 0,
    });
    this.close.emit();
  }

  startEditText(s: SavedText): void {
    this.editingTextId.set(s.id);
    this.textValue = s.text;
    this.textColor = s.color;
    this.textBg = s.bg;
    this.textFont = TEXT_FONTS.find(f => f.value === s.font) ?? TEXT_FONTS[1];
  }

  cancelEditText(): void {
    this.editingTextId.set(null);
    this.resetTextForm();
  }

  private resetTextForm(): void {
    this.textValue = '';
    this.textColor = '#ffffff';
    this.textBg = 'none';
  }

  deleteSavedText(id: string): void {
    this.decoService.removeSavedText(id);
  }

  clearAllTexts(): void {
    this.decoService.clearSavedTexts();
  }

  canDeleteText(s: SavedText): boolean {
    return !s.byAdmin || this.adminUnlocked;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  clearAllDecos(): void {
    this.decoService.clear();
  }

  get hasAnyUserDeco(): boolean { return this.decoService.decorations().length > 0; }
}
