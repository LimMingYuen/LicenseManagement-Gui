import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getPermissionPages } from '../config/page-registry';
import { PageDto, SyncPagesResult } from '../models/page.models';

/** Calls the pages API. */
@Injectable({ providedIn: 'root' })
export class PageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/pages';

  /** Lists the pages a role can be granted, in sidebar order. */
  list(): Promise<PageDto[]> {
    return firstValueFrom(this.http.get<PageDto[]>(this.baseUrl));
  }

  /** Sends the page registry's permission pages so the server table matches it. */
  sync(): Promise<SyncPagesResult> {
    return firstValueFrom(
      this.http.post<SyncPagesResult>(`${this.baseUrl}/sync`, { pages: getPermissionPages() }),
    );
  }
}
