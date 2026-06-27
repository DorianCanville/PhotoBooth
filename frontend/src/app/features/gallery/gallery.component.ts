import { Component, OnChanges, signal, inject, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService, Photo } from '../../core/services/storage.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnChanges {
  protected storage = inject(StorageService);

  open = input(false);
  close = output<void>();
  edit = output<Photo>();
  photosChanged = output<number>();

  photos = signal<Photo[]>([]);
  selected = signal<Photo | null>(null);
  viewTab = signal<'deco' | 'raw'>('deco');
  printing = signal(false);
  printError = signal<string | null>(null);

  ngOnChanges(): void {
    if (this.open()) this.reload();
  }

  async reload(): Promise<void> {
    const list = await this.storage.getPhotos();
    const sorted = [...list].reverse();
    this.photos.set(sorted);
    this.photosChanged.emit(list.length);
  }

  openPhoto(p: Photo): void {
    this.selected.set(p);
    this.viewTab.set('deco');
  }

  closeViewer(): void { this.selected.set(null); }

  async deletePhoto(p: Photo): Promise<void> {
    await this.storage.deletePhoto(p.id);
    await this.reload();
    if (this.selected()?.id === p.id) this.selected.set(null);
  }

  async printPhoto(p: Photo): Promise<void> {
    this.printing.set(true);
    this.printError.set(null);
    try {
      // Imprime la version actuellement affichée (onglet « Avec déco » / « Sans déco »).
      await this.storage.print(p.id, this.viewTab());
      await this.reload();
    } catch {
      this.printError.set('Erreur impression');
    } finally {
      this.printing.set(false);
    }
  }

  photoFileUrl(p: Photo): string { return this.storage.getPhotoUrl(p.filename); }
  photoRawUrl(p: Photo): string | null {
    return p.filenameRaw ? this.storage.getPhotoUrl(p.filenameRaw) : null;
  }

  navigate(dir: 1 | -1): void {
    const list = this.photos();
    const cur = this.selected();
    if (!cur) return;
    const idx = list.findIndex(p => p.id === cur.id);
    const next = list[idx + dir];
    if (next) this.selected.set(next);
  }
}
