import {
  Component, OnInit, signal, inject, input, output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositingService } from '../../core/services/compositing.service';
import { DecorationService } from '../../core/services/decoration.service';
import { StorageService, Photo } from '../../core/services/storage.service';
import { DecorationLayerComponent } from '../capture/decoration-layer.component';
import { DecorationPickerComponent } from '../capture/decoration-picker.component';

@Component({
  selector: 'app-photo-editor',
  standalone: true,
  imports: [CommonModule, DecorationLayerComponent, DecorationPickerComponent],
  templateUrl: './photo-editor.component.html',
  styleUrl: './photo-editor.component.scss',
})
export class PhotoEditorComponent implements OnInit {
  photo = input.required<Photo>();
  close = output<void>();
  saved = output<void>();

  compositing = inject(CompositingService);
  decoService = inject(DecorationService);
  storage = inject(StorageService);

  showPicker = signal(false);
  saving = signal(false);
  previewUrl = signal<string | null>(null);
  baseImage: HTMLImageElement | null = null;

  async ngOnInit(): Promise<void> {
    this.decoService.clear();

    // Load base image (raw = without deco)
    const rawUrl = this.photo().filenameRaw
      ? this.storage.getPhotoUrl(this.photo().filenameRaw!)
      : this.storage.getPhotoUrl(this.photo().filename);

    this.baseImage = await this.compositing.loadImage(rawUrl);
    this.previewUrl.set(rawUrl);
  }

  async save(): Promise<void> {
    if (!this.baseImage) return;
    this.saving.set(true);
    try {
      const allDecos = this.decoService.getAllDecos(true);
      const [dataUrl, dataUrlRaw] = await Promise.all([
        this.compositing.composePhoto(this.baseImage, allDecos, true),
        this.compositing.composePhoto(this.baseImage, [], false),
      ]);
      await this.storage.savePhoto(dataUrl, dataUrlRaw);
      this.saved.emit();
      this.close.emit();
    } finally {
      this.saving.set(false);
    }
  }
}
