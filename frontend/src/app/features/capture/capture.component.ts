import {
  Component, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, signal, computed, inject, output, input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraService, LensMode } from '../../core/services/camera.service';
import { AudioService } from '../../core/services/audio.service';
import { CompositingService } from '../../core/services/compositing.service';
import { StorageService } from '../../core/services/storage.service';
import { DecorationService, OfficialDeco, CustomSticker } from '../../core/services/decoration.service';
import { DecorationLayerComponent } from './decoration-layer.component';
import { DecorationPickerComponent } from './decoration-picker.component';
import { PinModalComponent } from './pin-modal.component';
import { OfficialEditorComponent } from './official-editor.component';

export type CaptureMode = 'single' | 'burst';

const TIMER_PRESETS = [3, 5, 10, 15];
const BURST_COUNT = 4;
const BURST_INTERVAL_MS = 2000;
const LENS_ZOOM: Record<LensMode, number> = { normal: 1, wide: 1 };

@Component({
  selector: 'app-capture',
  standalone: true,
  imports: [CommonModule, DecorationLayerComponent, DecorationPickerComponent, PinModalComponent, OfficialEditorComponent],
  templateUrl: './capture.component.html',
  styleUrl: './capture.component.scss',
})
export class CaptureComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoElRef!: ElementRef<HTMLVideoElement>;

  camera = inject(CameraService);
  audio = inject(AudioService);
  compositing = inject(CompositingService);
  storage = inject(StorageService);
  decoService = inject(DecorationService);

  /** Photo count for gallery badge — passed from app */
  photoCount = input(0);

  openGallery = output<void>();
  openAdmin = output<void>();
  /** Nombre de photos venant d'être sauvegardées (met à jour le compteur galerie). */
  photosSaved = output<number>();

  readonly timerPresets = TIMER_PRESETS;
  readonly lensModes: LensMode[] = ['normal', 'wide'];
  readonly captureModes: CaptureMode[] = ['single', 'burst'];
  readonly burstDots = [0, 1, 2, 3];

  lens = signal<LensMode>('normal');
  captureMode = signal<CaptureMode>('single');
  timerSeconds = signal(5);
  controlsCollapsed = signal(false);

  phase = signal<'preview' | 'countdown' | 'capturing' | 'review'>('preview');
  countdownN = signal(0);
  burstIdx = signal(0);
  showFlash = signal(false);
  showPicker = signal(false);

  // Admin / official / sticker-draft state (picker is the admin surface)
  pinOpen = signal(false);
  pinPurpose = signal<'unlock' | 'official'>('unlock');
  officialEditorOpen = signal(false);

  capturedPhotos = signal<{ baseCanvas: HTMLCanvasElement; dataUrl: string; dataUrlRaw: string }[]>([]);

  readonly reviewPreviewUrl = computed(() => {
    const photos = this.capturedPhotos();
    if (!photos.length) return null;
    // Just show the dataUrl for now (re-bake would need async)
    return photos[0]?.dataUrl ?? null;
  });

  async ngAfterViewInit(): Promise<void> {
    // Applique la rotation par objectif définie en admin avant d'ouvrir le flux.
    try {
      const s = await this.storage.getSettings();
      const lr = s['lensRotation'] as Partial<Record<LensMode, number>> | undefined;
      if (lr) this.camera.setLensRotation(lr);
    } catch { /* backend indisponible : on garde les valeurs par défaut */ }
    this.camera.start(this.videoElRef.nativeElement, this.lens());
  }

  ngOnDestroy(): void {
    this.camera.stop();
  }

  changeLens(l: LensMode): void {
    this.lens.set(l);
    this.camera.start(this.videoElRef.nativeElement, l);
  }

  async triggerCapture(): Promise<void> {
    if (this.phase() !== 'preview') return;
    this.showPicker.set(false);
    this.phase.set('countdown');

    let remaining = this.timerSeconds();
    this.countdownN.set(remaining);

    await new Promise<void>(resolve => {
      const tick = setInterval(() => {
        this.audio.countdownBeep(remaining);
        remaining--;
        this.countdownN.set(remaining);
        if (remaining <= 0) { clearInterval(tick); resolve(); }
      }, 1000);
    });

    this.countdownN.set(0);
    this.phase.set('capturing');

    if (this.captureMode() === 'single') {
      await this.captureSingle();
    } else {
      await this.captureBurst();
    }

    this.phase.set('review');
  }

  private async captureSingle(): Promise<void> {
    // Capture directement depuis le flux live : pas de bascule de résolution
    // (qui bloquerait le pipeline libcamera CSI — voir CameraService.start).
    const frame = this.camera.captureFrame(LENS_ZOOM[this.lens()]);
    if (!frame) return;
    this.doFlash();
    await new Promise(r => setTimeout(r, 100));
    const allDecos = this.decoService.getAllDecos(true);
    const [dataUrl, dataUrlRaw] = await Promise.all([
      this.compositing.composePhoto(frame, allDecos, true),
      this.compositing.composePhoto(frame, [], false),
    ]);
    this.capturedPhotos.set([{ baseCanvas: frame, dataUrl, dataUrlRaw }]);
  }

  private async captureBurst(): Promise<void> {
    const photos: { baseCanvas: HTMLCanvasElement; dataUrl: string; dataUrlRaw: string }[] = [];
    const allDecos = this.decoService.getAllDecos(true);

    for (let i = 0; i < BURST_COUNT; i++) {
      this.burstIdx.set(i + 1);
      if (i > 0) {
        for (let n = 2; n > 0; n--) {
          this.countdownN.set(n);
          this.audio.beep(880, 0.06);
          await new Promise(r => setTimeout(r, 900));
        }
        this.countdownN.set(0);
      }
      const frame = this.camera.captureFrame(LENS_ZOOM[this.lens()]);
      if (!frame) continue;
      this.doFlash();
      await new Promise(r => setTimeout(r, 120));
      const [dataUrl, dataUrlRaw] = await Promise.all([
        this.compositing.composePhoto(frame, allDecos, true),
        this.compositing.composePhoto(frame, [], false),
      ]);
      photos.push({ baseCanvas: frame, dataUrl, dataUrlRaw });
      await new Promise(r => setTimeout(r, 300));
    }
    this.capturedPhotos.set(photos);
    this.burstIdx.set(0);
  }

  private doFlash(): void {
    this.audio.shutterClick();
    this.showFlash.set(true);
    setTimeout(() => this.showFlash.set(false), 200);
  }

  async keep(): Promise<void> {
    const saved = this.capturedPhotos().length;
    for (const p of this.capturedPhotos()) {
      await this.storage.savePhoto(p.dataUrl, p.dataUrlRaw);
    }
    if (saved > 0) this.photosSaved.emit(saved);
    this.resetToPreview();
  }

  retakeAll(): void {
    this.capturedPhotos.set([]);
    this.decoService.clear();
    this.phase.set('preview');
  }

  resetToPreview(): void {
    this.capturedPhotos.set([]);
    this.decoService.clear();
    this.phase.set('preview');
  }

  // ── Admin unlock ────────────────────────────────────────────────────────────
  toggleAdmin(): void {
    if (this.decoService.adminUnlocked()) {
      this.decoService.lockAdmin();
    } else {
      this.pinPurpose.set('unlock');
      this.pinOpen.set(true);
    }
  }

  onPinSuccess(): void {
    this.pinOpen.set(false);
    if (this.pinPurpose() === 'official') this.officialEditorOpen.set(true);
  }

  // ── Official decoration ───────────────────────────────────────────────────────
  onOpenOfficial(): void {
    this.showPicker.set(false);
    if (this.decoService.adminUnlocked()) {
      this.officialEditorOpen.set(true);
    } else {
      this.pinPurpose.set('official');
      this.pinOpen.set(true);
    }
  }

  saveOfficial(od: OfficialDeco): void {
    this.decoService.setOfficialDeco(od);
    this.officialEditorOpen.set(false);
  }

  removeOfficial(): void {
    this.decoService.setOfficialDeco(null);
    this.officialEditorOpen.set(false);
  }

  toggleOfficial(): void {
    const cur = this.decoService.officialDeco();
    if (cur) this.decoService.setOfficialDeco({ ...cur, enabled: !cur.enabled });
  }

  // ── Admin sticker placement draft ─────────────────────────────────────────────
  onImportSticker(payload: { label: string; dataUrl: string }): void {
    this.showPicker.set(false);
    const img = new Image();
    img.onload = () => {
      const id = `cs-${Date.now()}`;
      this.compositing.cacheImage(id, payload.dataUrl);
      this.decoService.draftSticker.set({
        id, label: payload.label, dataUrl: payload.dataUrl,
        aspect: img.naturalWidth / img.naturalHeight,
        x: 50, y: 50, scale: 1, rotate: 0, lockedPosition: false,
      });
    };
    img.src = payload.dataUrl;
  }

  onEditSticker(s: CustomSticker): void {
    this.showPicker.set(false);
    this.compositing.cacheImage(s.id, s.dataUrl);
    this.decoService.draftSticker.set({
      id: s.id, label: s.label, dataUrl: s.dataUrl, aspect: s.aspect,
      x: s.defaultX ?? 50, y: s.defaultY ?? 50, scale: s.defaultScale ?? 1, rotate: s.defaultRotate ?? 0,
      lockedPosition: !!s.lockedPosition, editId: s.id,
    });
  }

  toggleDraftLock(): void {
    const d = this.decoService.draftSticker();
    if (d) this.decoService.updateDraftSticker({ lockedPosition: !d.lockedPosition });
  }

  validateDraft(): void {
    const d = this.decoService.draftSticker();
    if (!d) return;
    const sticker: Omit<CustomSticker, 'id'> & { id?: string } = {
      id: d.id, label: d.label, dataUrl: d.dataUrl, aspect: d.aspect,
      defaultX: d.x, defaultY: d.y, defaultScale: d.scale, defaultRotate: d.rotate,
      lockedPosition: d.lockedPosition,
    };
    if (d.editId) {
      this.decoService.updateCustomSticker(d.editId, sticker);
    } else {
      this.decoService.addCustomSticker(sticker);
    }
    this.decoService.draftSticker.set(null);
  }

  cancelDraft(): void {
    this.decoService.draftSticker.set(null);
  }
}
