import {
  Component, ElementRef, ViewChild, inject, signal, computed, OnInit, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DecorationService } from '../../core/services/decoration.service';
import { CompositingService } from '../../core/services/compositing.service';
import { Decoration } from '../../core/services/compositing.service';

type Role = 'user' | 'official' | 'draft';
interface LayerItem {
  deco: Decoration;
  role: Role;
  canMove: boolean;
  canDelete: boolean;
  showLock: boolean;
  selected: boolean;
}

@Component({
  selector: 'app-decoration-layer',
  standalone: true,
  imports: [CommonModule],
  template: `
<div #container class="deco-layer" (pointerdown)="onLayerDown($event)">
  @for (item of items(); track item.deco.id) {
    <div
      class="deco-item"
      [class.selected]="item.selected"
      [class.locked]="!item.canMove"
      [style.left.%]="item.deco.x"
      [style.top.%]="item.deco.y"
      [style.transform]="itemTransform(item.deco)"
      (pointerdown)="onDecoDown($event, item)"
    >
      @if ((item.deco.kind === 'sticker' || item.deco.kind === 'image') && getStickerUrl(item.deco)) {
        <img [src]="getStickerUrl(item.deco)!" class="deco-img" [style.width.px]="baseSize() * item.deco.scale" />
      }
      @if (item.deco.kind === 'text') {
        <span class="deco-text"
          [style.font-size.px]="textSize(item.deco)"
          [style.font-family]="item.deco.font"
          [style.font-weight]="item.deco.weight"
          [style.color]="item.deco.color"
          [style.background]="item.deco.bg !== 'none' ? item.deco.bg : 'transparent'"
          [style.padding]="item.deco.bg !== 'none' ? '0.3em 0.7em' : '0'"
          [style.border-radius.px]="999"
          [style.text-shadow]="item.deco.bg === 'none' ? '0 4px 16px rgba(0,0,0,0.6)' : 'none'"
        >{{ item.deco.text }}</span>
      }

      <!-- Lock badge for non-movable decorations -->
      @if (item.showLock) {
        <div class="lock-badge">🔒</div>
      }

      <!-- Handles -->
      @if (item.selected && item.canMove) {
        <div class="deco-handles">
          <span class="rotate-line"></span>
          <div class="handle handle-rotate" (pointerdown)="onRotateDown($event, item)">⟳</div>
          <div class="handle handle-scale" (pointerdown)="onScaleDown($event, item)">↘</div>
          @if (item.canDelete) {
            <button class="handle handle-delete" (pointerdown)="onDelete($event, item)">✕</button>
          }
        </div>
      }
      @if (item.selected && !item.canMove && item.canDelete) {
        <div class="deco-handles">
          <button class="handle handle-delete" (pointerdown)="onDelete($event, item)">✕</button>
        </div>
      }
    </div>
  }
</div>`,
  styleUrl: './decoration-layer.component.scss',
})
export class DecorationLayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  decoService = inject(DecorationService);
  compositing = inject(CompositingService);

  private stageWidth = signal(1920);
  private resizeObs?: ResizeObserver;

  baseSize = computed(() => this.stageWidth() * 0.22);
  selected = signal<string | null>(null);

  /** Unified list of everything the layer renders, with per-item capabilities. */
  items = computed<LayerItem[]>(() => {
    const admin = this.decoService.adminUnlocked();
    const sel = this.selected();
    const out: LayerItem[] = [];

    // User decorations
    for (const d of this.decoService.decorations()) {
      out.push({
        deco: d, role: 'user',
        canMove: !d.locked, canDelete: true,
        showLock: !!d.locked,
        selected: sel === d.id,
      });
    }

    // Official decoration (movable only in admin mode)
    const od = this.decoService.officialDeco();
    if (od?.enabled) {
      out.push({
        deco: od, role: 'official',
        canMove: admin, canDelete: false,
        showLock: !admin,
        selected: admin && sel === od.id,
      });
    }

    // Admin sticker placement draft
    const draft = this.decoService.draftSticker();
    if (draft) {
      out.push({
        deco: { id: draft.id, kind: 'sticker', stickerId: draft.id, x: draft.x, y: draft.y, scale: draft.scale, rotate: draft.rotate },
        role: 'draft',
        canMove: true, canDelete: false,
        showLock: false,
        selected: true,
      });
    }

    return out;
  });

  ngOnInit(): void {
    this.decoService.loadFromStorage();
  }

  ngAfterViewInit(): void {
    const el = this.containerRef.nativeElement;
    const measure = () => this.stageWidth.set(el.getBoundingClientRect().width || 1920);
    measure();
    this.resizeObs = new ResizeObserver(measure);
    this.resizeObs.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  itemTransform(deco: Decoration): string {
    return `translate(-50%, -50%) rotate(${deco.rotate}deg)`;
  }

  textSize(deco: Decoration): number {
    return 60 * (deco.scale ?? 1) * (this.stageWidth() / 1920);
  }

  getStickerUrl(deco: Decoration): string | null {
    const key = deco.sourceId ?? deco.stickerId ?? deco.id;
    const cached = this.compositing.getCached(key);
    if (cached) return cached.src;
    const cs = this.decoService.findSticker(key);
    if (cs) {
      this.compositing.cacheImage(cs.id, cs.dataUrl);
      return cs.dataUrl;
    }
    if (deco.imageUrl) {
      this.compositing.cacheImage(key, deco.imageUrl);
      return deco.imageUrl;
    }
    return null;
  }

  // ── Dispatch a position/scale/rotate patch to the right target ──────────────
  private applyPatch(item: LayerItem, patch: Partial<Decoration>): void {
    if (item.role === 'draft') {
      this.decoService.updateDraftSticker(patch);
    } else if (item.role === 'official') {
      if (this.decoService.adminUnlocked()) this.decoService.patchOfficial(patch);
    } else {
      this.decoService.update(item.deco.id, patch);
    }
  }
  private commit(item: LayerItem): void {
    if (item.role === 'official') this.decoService.persistOfficial();
  }

  onDelete(e: PointerEvent, item: LayerItem): void {
    e.stopPropagation();
    if (item.role === 'user') {
      this.decoService.remove(item.deco.id);
      this.selected.set(null);
    }
  }

  onLayerDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).classList.contains('deco-layer')) {
      this.selected.set(null);
    }
  }

  // ── Drag move ───────────────────────────────────────────────────────────────
  onDecoDown(e: PointerEvent, item: LayerItem): void {
    e.stopPropagation();
    if (!item.canMove) {
      // still allow selection (to show delete) when deletable
      if (item.canDelete) this.selected.set(item.deco.id);
      return;
    }
    e.preventDefault();
    this.selected.set(item.deco.id);
    if ((e.target as HTMLElement).dataset['handle']) return;

    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startPosX = item.deco.x, startPosY = item.deco.y;

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      this.applyPatch(item, {
        x: Math.max(0, Math.min(100, startPosX + dx)),
        y: Math.max(0, Math.min(100, startPosY + dy)),
      });
    };
    const onUp = () => {
      this.commit(item);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ── Rotate ────────────────────────────────────────────────────────────────
  onRotateDown(e: PointerEvent, item: LayerItem): void {
    e.stopPropagation();
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).closest('.deco-item') as HTMLElement;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const startRot = item.deco.rotate;

    const onMove = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
      this.applyPatch(item, { rotate: startRot + (a - startAngle) });
    };
    const onUp = () => {
      this.commit(item);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ── Scale (horizontal drag, matches mockup) ───────────────────────────────
  onScaleDown(e: PointerEvent, item: LayerItem): void {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startScale = item.deco.scale;

    const onMove = (ev: PointerEvent) => {
      const scale = startScale + (ev.clientX - startX) / 150;
      this.applyPatch(item, { scale: Math.max(0.15, Math.min(8, scale)) });
    };
    const onUp = () => {
      this.commit(item);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
}
