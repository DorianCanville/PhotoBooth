import { Component, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DecorationService } from '../../core/services/decoration.service';

@Component({
  selector: 'app-pin-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="pin-backdrop">
  <div class="pin-card">
    <div class="pin-head">
      <div class="pin-emoji">🔒</div>
      <div class="pin-title">{{ title() }}</div>
      <div class="pin-sub">{{ subtitle() }}</div>
    </div>

    <div class="pin-dots" [class.shake]="error()">
      @for (i of [0,1,2,3]; track i) {
        <span class="pin-dot" [class.filled]="pin().length > i" [class.err]="error()"></span>
      }
    </div>

    <div class="pin-keypad">
      @for (d of ['1','2','3','4','5','6','7','8','9']; track d) {
        <button type="button" class="pin-key" (click)="onDigit(d)">{{ d }}</button>
      }
      <button type="button" class="pin-key pin-key-ghost" (click)="cancel.emit()">Annuler</button>
      <button type="button" class="pin-key" (click)="onDigit('0')">0</button>
      <button type="button" class="pin-key pin-key-ghost" (click)="onBack()">⌫</button>
    </div>
  </div>
</div>`,
  styles: [`
:host { position: absolute; inset: 0; z-index: 50; }
.pin-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(20px);
  display: flex; align-items: center; justify-content: center;
}
.pin-card {
  background: var(--pb-bg, #16161a);
  padding: 36px; border-radius: 22px;
  border: 1px solid var(--pb-border, rgba(255,255,255,0.12));
  min-width: 380px; max-width: 440px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  color: var(--pb-text, #fff);
}
.pin-head { text-align: center; margin-bottom: 24px; }
.pin-emoji { font-size: 40px; margin-bottom: 10px; }
.pin-title { font-size: 24px; font-weight: 600; }
.pin-sub { font-size: 13px; color: var(--pb-text-muted, rgba(255,255,255,0.6)); margin-top: 6px; line-height: 1.4; }
.pin-dots { display: flex; justify-content: center; gap: 14px; margin-bottom: 22px; }
.pin-dots.shake { animation: pin-shake 0.4s; }
.pin-dot {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--pb-surface, rgba(255,255,255,0.08));
  border: 1px solid var(--pb-border, rgba(255,255,255,0.12));
  transition: background .15s;
}
.pin-dot.filled { background: var(--pb-accent, #d4a574); }
.pin-dot.err { border-color: var(--pb-danger, #ff5470); }
.pin-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pin-key {
  appearance: none; border: 1px solid var(--pb-border, rgba(255,255,255,0.12));
  background: var(--pb-surface, rgba(255,255,255,0.08)); color: var(--pb-text, #fff);
  height: 64px; border-radius: 14px;
  font-size: 26px; font-weight: 500; cursor: pointer;
}
.pin-key-ghost { background: transparent; font-size: 15px; font-weight: 500; }
@keyframes pin-shake {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
`],
})
export class PinModalComponent {
  private decoService = inject(DecorationService);

  title = input('Mode admin');
  subtitle = input('Entre le code admin pour gérer stickers, textes et décoration officielle');

  success = output<void>();
  cancel = output<void>();

  pin = signal('');
  error = signal(false);

  onDigit(d: string): void {
    if (this.pin().length >= 4) return;
    const next = this.pin() + d;
    this.pin.set(next);
    this.error.set(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (this.decoService.tryUnlock(next)) {
          this.success.emit();
        } else {
          this.error.set(true);
          this.pin.set('');
        }
      }, 100);
    }
  }

  onBack(): void {
    this.pin.set(this.pin().slice(0, -1));
    this.error.set(false);
  }
}
