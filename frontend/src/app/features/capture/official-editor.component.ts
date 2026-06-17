import { Component, inject, signal, input, output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DecorationService, OfficialDeco } from '../../core/services/decoration.service';
import { CompositingService, Decoration } from '../../core/services/compositing.service';

const TEXT_FONTS = [
  { label: 'Élégant', value: "Georgia, 'Times New Roman', serif", weight: 600 },
  { label: 'Moderne',  value: "'Inter Tight', Helvetica, sans-serif", weight: 700 },
  { label: 'Festif',   value: "'Brush Script MT', cursive",           weight: 700 },
  { label: 'Bold',     value: "Impact, 'Arial Black', sans-serif",     weight: 900 },
  { label: 'Mono',     value: "'JetBrains Mono', monospace",           weight: 600 },
];
const COLOR_PRESETS = ['#ffffff', '#ffd23f', '#ff3d8b', '#d4a574', '#000000'];
const BG_PRESETS = ['none', '#000000aa', '#ffffffcc', '#ff3d8b', '#ffd23f'];

type EditorTab = 'stickers' | 'text' | 'image';

@Component({
  selector: 'app-official-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './official-editor.component.html',
  styleUrl: './official-editor.component.scss',
})
export class OfficialEditorComponent implements OnChanges {
  decoService = inject(DecorationService);
  compositing = inject(CompositingService);

  current = input<OfficialDeco | null>(null);

  save = output<OfficialDeco>();
  remove = output<void>();
  close = output<void>();

  readonly textFonts = TEXT_FONTS;
  readonly colorPresets = COLOR_PRESETS;
  readonly bgPresets = BG_PRESETS;

  tab = signal<EditorTab>('stickers');
  draft = signal<Decoration | null>(null);

  // text form
  textValue = '';
  textFont = TEXT_FONTS[1];
  textColor = '#ffd23f';
  textBg = 'none';

  ngOnChanges(): void {
    const cur = this.current();
    this.draft.set(cur ? { ...cur } : null);
    if (cur?.kind === 'text') {
      this.textValue = cur.text ?? '';
      this.textColor = cur.color ?? '#ffd23f';
      this.textBg = cur.bg ?? 'none';
      this.textFont = TEXT_FONTS.find(f => f.value === cur.font) ?? TEXT_FONTS[1];
      this.tab.set('text');
    } else if (cur?.kind === 'image') {
      this.tab.set('image');
    } else {
      this.tab.set('stickers');
    }
  }

  stickerUrl(d: Decoration): string | null {
    const s = this.decoService.findSticker(d.stickerId ?? '');
    return s?.dataUrl ?? null;
  }

  draftLabel(): string {
    const d = this.draft();
    if (!d) return '';
    if (d.kind === 'sticker') return this.decoService.findSticker(d.stickerId ?? '')?.label ?? 'Sticker';
    if (d.kind === 'text') return `« ${d.text} »`;
    return 'Image importée';
  }

  pickSticker(id: string): void {
    this.compositing.cacheImage(id, this.decoService.findSticker(id)?.dataUrl ?? '');
    this.draft.set({ id: 'official', kind: 'sticker', stickerId: id, x: 50, y: 20, scale: 1, rotate: 0 });
  }

  buildText(): void {
    if (!this.textValue.trim()) return;
    this.draft.set({
      id: 'official', kind: 'text', text: this.textValue.trim(),
      font: this.textFont.value, weight: this.textFont.weight,
      color: this.textColor, bg: this.textBg,
      x: 50, y: 15, scale: 1, rotate: 0,
    });
  }

  onImageFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const id = `official-img-${Date.now()}`;
      await this.compositing.cacheImage(id, dataUrl);
      this.draft.set({ id: 'official', kind: 'image', sourceId: id, imageUrl: dataUrl, x: 50, y: 20, scale: 1, rotate: 0 });
    };
    reader.readAsDataURL(file);
  }

  clearDraft(): void { this.draft.set(null); }

  onSave(): void {
    const d = this.draft();
    if (!d) return;
    this.save.emit({ ...d, id: 'official', enabled: true });
  }
}
