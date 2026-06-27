import { Component, OnInit, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage.service';
import { ThemeService } from '../../core/services/theme.service';
import { DecorationService } from '../../core/services/decoration.service';
import { OfficialDeco } from '../../core/services/decoration.service';
import { CameraService } from '../../core/services/camera.service';

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
  private camera = inject(CameraService);

  close = output<void>();

  pinPhase = signal<'enter' | 'unlocked'>('enter');
  pinInput = signal('');
  pinError = signal(false);
  adminPin = '1234';

  activeTab = signal<AdminTab>('settings');
  tabs: AdminTab[] = ['settings', 'stickers', 'textes', 'officielle'];

  // Settings
  accentColor = signal('#d4a574');
  buttonSize = signal(1);
  // Rotation par objectif (0 ou 180°) — corrige les caméras montées à l'envers.
  lensNormalRot = signal(180);
  lensWideRot = signal(0);

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
    this.accentColor.set((s['accentOverride'] as string) || '#d4a574');
    this.buttonSize.set((s['buttonSize'] as number) || 1);
    const lr = (s['lensRotation'] as Record<string, number>) || {};
    this.lensNormalRot.set(lr['normal'] ?? 180);
    this.lensWideRot.set(lr['wide'] ?? 0);
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
      theme: 'studio',
      accentOverride: this.accentColor(),
      buttonSize: this.buttonSize(),
      lensRotation: { normal: this.lensNormalRot(), wide: this.lensWideRot() },
    });
    // Applique l'orientation à chaud à l'aperçu de capture (toujours actif derrière la modale).
    this.camera.setLensRotation({ normal: this.lensNormalRot(), wide: this.lensWideRot() });
    this.theme.apply('studio', this.accentColor());
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
