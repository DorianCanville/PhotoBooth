import { Component, OnInit, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage.service';
import { ThemeService, ThemeName } from '../../core/services/theme.service';
import { DecorationService } from '../../core/services/decoration.service';
import { OfficialDeco } from '../../core/services/decoration.service';

type AdminTab = 'settings' | 'stickers' | 'textes' | 'officielle';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  protected storage = inject(StorageService);
  protected theme = inject(ThemeService);
  protected decoService = inject(DecorationService);

  close = output<void>();

  pinPhase = signal<'enter' | 'unlocked'>('enter');
  pinInput = signal('');
  pinError = signal(false);
  adminPin = '1234';

  activeTab = signal<AdminTab>('settings');
  tabs: AdminTab[] = ['settings', 'stickers', 'textes', 'officielle'];

  // Settings
  selectedTheme = signal<ThemeName>('studio');
  accentColor = signal('#d4a574');
  buttonSize = signal(1);

  // Official deco
  officialText = signal('');
  officialFont = "Georgia, 'Times New Roman', serif";
  officialColor = '#ffffff';
  officialBg = 'none';
  officialEnabled = signal(false);
  officialX = signal(50);
  officialY = signal(90);

  async ngOnInit(): Promise<void> {
    const s = await this.storage.getSettings();
    this.adminPin = (s['adminPin'] as string) || '1234';
    this.selectedTheme.set((s['theme'] as ThemeName) || 'studio');
    this.accentColor.set((s['accentOverride'] as string) || '#d4a574');
    this.buttonSize.set((s['buttonSize'] as number) || 1);
    await this.decoService.loadFromStorage();

    const od = this.decoService.officialDeco();
    if (od) {
      this.officialText.set(od.text ?? '');
      this.officialFont = od.font ?? this.officialFont;
      this.officialColor = od.color ?? '#ffffff';
      this.officialBg = od.bg ?? 'none';
      this.officialEnabled.set(od.enabled ?? false);
      this.officialX.set(od.x ?? 50);
      this.officialY.set(od.y ?? 90);
    }
  }

  checkPin(): void {
    if (this.pinInput() === this.adminPin) {
      this.pinPhase.set('unlocked');
      this.pinError.set(false);
    } else {
      this.pinError.set(true);
      this.pinInput.set('');
    }
  }

  async saveSettings(): Promise<void> {
    await this.storage.saveSettings({
      theme: this.selectedTheme(),
      accentOverride: this.accentColor(),
      buttonSize: this.buttonSize(),
    });
    this.theme.apply(this.selectedTheme(), this.accentColor());
    document.documentElement.style.setProperty('--pb-btn-scale', String(this.buttonSize()));
    this.activeTab.set('settings');
  }

  async saveOfficialDeco(): Promise<void> {
    const od: OfficialDeco = {
      id: 'official',
      kind: 'text',
      text: this.officialText(),
      font: this.officialFont,
      color: this.officialColor,
      bg: this.officialBg,
      x: this.officialX(),
      y: this.officialY(),
      scale: 1,
      rotate: 0,
      enabled: this.officialEnabled(),
    };
    await this.decoService.setOfficialDeco(od);
  }

  async toggleOfficialDeco(): Promise<void> {
    const current = this.decoService.officialDeco();
    if (current) {
      await this.decoService.setOfficialDeco({ ...current, enabled: !current.enabled });
      this.officialEnabled.set(!this.officialEnabled());
    }
  }

  onStickerFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const label = file.name.replace(/\.[^.]+$/, '');
      const img = new Image();
      img.onload = () => {
        this.decoService.addCustomSticker({
          label, dataUrl, aspect: img.naturalWidth / img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async removeSticker(id: string): Promise<void> {
    await this.decoService.removeCustomSticker(id);
  }

  async removeText(id: string): Promise<void> {
    await this.decoService.removeSavedText(id);
  }
}
