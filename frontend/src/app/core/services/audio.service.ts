import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;

  private get audioCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  beep(freq = 880, dur = 0.06, vol = 0.15): void {
    try {
      const ctx = this.audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* noop */ }
  }

  shutterClick(): void {
    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime;
      const buf = ctx.createBuffer(1, 44100 * 0.08, 44100);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.18;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2400;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(t);
    } catch { /* noop */ }
  }

  countdownBeep(secondsLeft: number): void {
    if (secondsLeft <= 3) this.beep(880, 0.06, 0.15);
    else this.beep(660, 0.05, 0.1);
  }
}
