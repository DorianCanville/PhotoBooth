import { Injectable, signal } from '@angular/core';

export type LensMode = 'normal' | 'wide';

@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;

  async start(videoEl: HTMLVideoElement, lens: LensMode = 'normal'): Promise<void> {
    await this.stop();
    this.videoEl = videoEl;
    this.ready.set(false);
    this.error.set(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia indisponible');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
        audio: false,
      });
      videoEl.srcObject = this.stream;
      videoEl.onloadedmetadata = () => this.ready.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  async stop(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
    this.ready.set(false);
  }

  // Capture frame from video to ImageData via canvas
  captureFrame(zoom: number = 1): HTMLCanvasElement | null {
    const video = this.videoEl;
    if (!video || !this.ready()) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d')!;

    if (zoom !== 1) {
      const sw = vw / zoom;
      const sh = vh / zoom;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
    } else {
      ctx.drawImage(video, 0, 0, vw, vh);
    }

    return canvas;
  }
}
