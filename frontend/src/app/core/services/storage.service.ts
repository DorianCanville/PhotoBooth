import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Photo {
  id: string;
  filename: string;
  filenameRaw?: string;
  createdAt: string;
  printed: boolean;
  // client-side only (dataUrls from session, before persisted)
  dataUrl?: string;
  dataUrlRaw?: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly apiBase = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  async getPhotos(): Promise<Photo[]> {
    return firstValueFrom(this.http.get<Photo[]>(`${this.apiBase}/photos`));
  }

  async savePhoto(dataUrl: string, dataUrlRaw: string | undefined): Promise<Photo> {
    return firstValueFrom(
      this.http.post<Photo>(`${this.apiBase}/photos`, { dataUrl, dataUrlRaw })
    );
  }

  async deletePhoto(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiBase}/photos/${id}`));
  }

  getPhotoUrl(filename: string): string {
    // Photos served by backend as static or via route
    return `${this.apiBase}/photos/file/${filename}`;
  }

  async getSettings(): Promise<Record<string, unknown>> {
    return firstValueFrom(this.http.get<Record<string, unknown>>(`${this.apiBase}/settings`));
  }

  async saveSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    return firstValueFrom(this.http.put<Record<string, unknown>>(`${this.apiBase}/settings`, patch));
  }

  async print(photoId: string, variant: 'deco' | 'raw' = 'deco'): Promise<{ ok: boolean; jobInfo?: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; jobInfo?: string }>(`${this.apiBase}/print`, { photoId, variant })
    );
  }
}
