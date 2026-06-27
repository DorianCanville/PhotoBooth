import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaptureComponent } from './features/capture/capture.component';
import { GalleryComponent } from './features/gallery/gallery.component';
import { AdminComponent } from './features/admin/admin.component';
import { PhotoEditorComponent } from './features/editor/photo-editor.component';
import { ThemeService } from './core/services/theme.service';
import { StorageService, Photo } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CaptureComponent, GalleryComponent, AdminComponent, PhotoEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private themeService = inject(ThemeService);
  private storage = inject(StorageService);

  showGallery = signal(false);
  showAdmin = signal(false);
  editingPhoto = signal<Photo | null>(null);
  photoCount = signal(0);

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.storage.getSettings();
      const theme = (s['theme'] as any) || 'studio';
      const accent = (s['accentOverride'] as string) || undefined;
      const btnSize = (s['buttonSize'] as number) || 1;
      this.themeService.apply(theme, accent);
      document.documentElement.style.setProperty('--pb-btn-scale', String(btnSize));
      // Load initial photo count
      const photos = await this.storage.getPhotos();
      this.photoCount.set(photos.length);
    } catch {
      this.themeService.apply('studio');
    }
  }

  openEditor(photo: Photo): void {
    this.showGallery.set(false);
    this.editingPhoto.set(photo);
  }

  onPhotosChanged(count: number): void {
    this.photoCount.set(count);
  }

  onPhotosSaved(n: number): void {
    this.photoCount.update(c => c + n);
  }
}
