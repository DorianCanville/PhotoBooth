import { Injectable, signal } from '@angular/core';

export type LensMode = 'normal' | 'wide';

// Indices pour identifier chaque caméra physique via le libellé du périphérique.
//   normal = caméra 64MP (arducam Hawkeye)  ← caméra par défaut
//   wide   = caméra grand-angle (imx708)
const LENS_LABEL_HINTS: Record<LensMode, string[]> = {
  normal: ['64mp', 'arducam', 'hawkeye'],
  wide: ['imx708', 'wide', 'grand'],
};

@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private deviceIds = new Map<LensMode, string>();
  private devicesResolved = false;

  // Rotation appliquée à l'aperçu ET à la photo, par objectif (en degrés, 0 ou
  // 180). Les caméras physiquement montées à l'envers se corrigent ici. Valeurs
  // par défaut : 64MP ("normal") montée à l'envers → 180°, grand-angle → 0°.
  // Surchargées par les réglages admin via setLensRotation().
  private lensRotation: Record<LensMode, number> = { normal: 180, wide: 0 };
  private currentLens: LensMode = 'normal';

  // SOURCE DE VÉRITÉ UNIQUE de la rotation courante (signal). Le template
  // compose la transform de l'aperçu (`scaleX(-1) rotate(...)`) à partir d'ici :
  // on évite ainsi que l'écriture impérative de `style.transform` entre en
  // conflit avec le binding Angular du miroir (cause des retournements aléatoires).
  readonly rotationDeg = signal(0);

  /** Configure la rotation par objectif (degrés) ; s'applique à chaud à l'aperçu. */
  setLensRotation(map: Partial<Record<LensMode, number>>): void {
    this.lensRotation = { ...this.lensRotation, ...map };
    this.rotationDeg.set(this.normalizeDeg(this.lensRotation[this.currentLens]));
  }

  private normalizeDeg(deg: number): number {
    return (((deg ?? 0) % 360) + 360) % 360;
  }

  // Résolution du flux par objectif, choisie pour exploiter le PLEIN CHAMP de
  // chaque capteur (sinon image inutilement « zoomée ») :
  //   normal (arducam 64MP) → capteur natif 4:3 : on demande un mode 4:3
  //     (2312×1736). La sortie photo étant déjà 4:3, aucun rognage latéral.
  //   wide (imx708)        → capteur natif 16:9 : 2304×1296 est un mode plein
  //     champ (crop (0,0)/4608×2592).
  private static readonly LENS_RESOLUTION: Record<LensMode, { width: number; height: number }> = {
    normal: { width: 2312, height: 1736 },
    wide: { width: 2304, height: 1296 },
  };

  async start(videoEl: HTMLVideoElement, lens: LensMode = 'normal'): Promise<void> {
    await this.stop();
    this.videoEl = videoEl;
    this.ready.set(false);
    this.error.set(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia indisponible');

      await this.resolveDevices();

      // Flux UNIQUE servant à la fois à l'aperçu et à la capture (~3 MP, 30fps).
      //
      // ⚠️ Caméras CSI (imx708 / arducam_64mp via libcamera/rp1-cfe) : changer
      // la résolution en cours de route (applyConstraints) ou stopper/recréer
      // le flux à répétition fait finir le pipeline libcamera en état bloqué —
      // la caméra ne répond plus jusqu'au REDÉMARRAGE du Raspberry. On ouvre
      // donc le flux une seule fois, à une résolution fixe correcte, et on
      // capture la photo directement depuis ce flux (captureFrame). Pas de
      // bascule « still mode », pas de recréation entre les prises.
      const res = CameraService.LENS_RESOLUTION[lens];
      const video: MediaTrackConstraints = {
        width: { ideal: res.width },
        height: { ideal: res.height },
        frameRate: { ideal: 30 },
      };
      const deviceId = this.deviceIds.get(lens);
      if (deviceId) {
        video.deviceId = { exact: deviceId };
      } else {
        video.facingMode = 'user';
      }

      console.log(`[CameraService] start(lens="${lens}") → deviceId=${deviceId ? deviceId.slice(0, 12) + '…' : '(défaut facingMode)'}`);
      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      const track = this.stream.getVideoTracks()[0];
      console.log(`[CameraService] flux actif : "${track?.label}"`, track?.getSettings());

      // Rotation de l'aperçu selon l'objectif (caméras montées à l'envers). On
      // n'écrit PAS style.transform ici : le template lit rotationDeg() et
      // compose `scaleX(-1) rotate(...)` lui-même (source de vérité unique).
      this.currentLens = lens;
      this.rotationDeg.set(this.normalizeDeg(this.lensRotation[lens]));

      videoEl.srcObject = this.stream;
      videoEl.onloadedmetadata = () => this.ready.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Découvre les caméras physiques une seule fois et les associe aux modes.
   * cam0 = imx708 (grand angle), cam1 = arducam 64MP (défaut).
   */
  private async resolveDevices(): Promise<void> {
    if (this.devicesResolved) return;

    // Les libellés ne sont exposés qu'après une première autorisation caméra.
    let tmp: MediaStream | null = null;
    try {
      tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      // permission refusée / pas de caméra → map vide, fallback sur la caméra par défaut
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    tmp?.getTracks().forEach(t => t.stop());

    console.log('[CameraService] Caméras détectées :',
      cams.map((c, i) => ({ index: i, label: c.label || '(libellé masqué)', deviceId: c.deviceId.slice(0, 12) + '…' })));

    // 1) Association par mots-clés dans le libellé.
    for (const mode of ['normal', 'wide'] as LensMode[]) {
      const hints = LENS_LABEL_HINTS[mode];
      const match = cams.find(c => hints.some(h => c.label.toLowerCase().includes(h)));
      if (match) {
        this.deviceIds.set(mode, match.deviceId);
        console.log(`[CameraService] ${mode} → "${match.label}" (par libellé)`);
      }
    }

    // 2) Fallback par ordre d'énumération : cam0 = wide, cam1 = 64MP.
    if (!this.deviceIds.has('normal') && cams[1]) {
      this.deviceIds.set('normal', cams[1].deviceId);
      console.log(`[CameraService] normal → "${cams[1].label || 'index 1'}" (fallback ordre)`);
    }
    if (!this.deviceIds.has('wide') && cams[0]) {
      this.deviceIds.set('wide', cams[0].deviceId);
      console.log(`[CameraService] wide → "${cams[0].label || 'index 0'}" (fallback ordre)`);
    }

    this.devicesResolved = true;
  }

  async stop(): Promise<void> {
    const hadStream = !!this.stream;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
    this.ready.set(false);

    // L'Arducam 64MP (UVC) a besoin d'un court instant pour se libérer après
    // l'arrêt de la piste ; la rouvrir immédiatement renvoie sinon un flux
    // noir. On ne paie ce délai que si une caméra était réellement active.
    if (hadStream) await new Promise(r => setTimeout(r, 250));
  }

  // Capture frame from video to ImageData via canvas
  captureFrame(zoom: number = 1): HTMLCanvasElement | null {
    const video = this.videoEl;
    if (!video || !this.ready()) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Région source (recadrage centré pour le zoom). On dimensionne le canvas
    // à la taille native de la zone capturée pour éviter tout sur-échantillonnage.
    const sw = vw / zoom;
    const sh = vh / zoom;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // On retourne la photo comme l'aperçu (seul 180° est géré : cas des caméras
    // montées à l'envers ; un 90°/270° changerait les dimensions du canvas).
    // NB : la photo n'est PAS mise en miroir (contrairement à l'aperçu selfie).
    if (this.rotationDeg() === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return canvas;
  }
}
