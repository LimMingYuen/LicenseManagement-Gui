import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ImportMode = 'Merge' | 'Replace';

export interface ImportResult {
  imported: number;
  skipped: number;
  totalInArchive: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/backup';

  status(): Promise<{ recordCount: number }> {
    return firstValueFrom(this.http.get<{ recordCount: number }>(`${this.baseUrl}/status`));
  }

  export(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/export`, { responseType: 'blob' }));
  }

  import(file: File, mode: ImportMode): Promise<ImportResult> {
    const body = new FormData();
    body.append('file', file, file.name);

    return firstValueFrom(
      this.http.post<ImportResult>(`${this.baseUrl}/import`, body, {
        params: new HttpParams().set('mode', mode),
      }),
    );
  }
}
