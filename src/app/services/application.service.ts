import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Application,
  CreateApplicationRequest,
  UpdateApplicationRequest,
} from '../models/application.models';
import { LicenseKind } from '../models/license.models';

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/applications';

  /**
   * @param supports Restricts the list to applications that issue this payload type. The
   * generate forms pass their own kind, so the picker cannot offer an application that
   * would then reject the request.
   * @param includeInactive Retired applications stay in the management list so they can be
   * reactivated; the generate forms pass false.
   */
  list(options?: {
    search?: string;
    supports?: LicenseKind;
    includeInactive?: boolean;
  }): Promise<Application[]> {
    let params = new HttpParams();

    if (options?.search?.trim()) {
      params = params.set('search', options.search.trim());
    }

    if (options?.supports) {
      params = params.set('supports', options.supports);
    }

    if (options?.includeInactive === false) {
      params = params.set('includeInactive', 'false');
    }

    return firstValueFrom(this.http.get<Application[]>(this.baseUrl, { params }));
  }

  get(id: number): Promise<Application> {
    return firstValueFrom(this.http.get<Application>(`${this.baseUrl}/${id}`));
  }

  create(request: CreateApplicationRequest): Promise<Application> {
    return firstValueFrom(this.http.post<Application>(this.baseUrl, request));
  }

  update(id: number, request: UpdateApplicationRequest): Promise<Application> {
    return firstValueFrom(this.http.put<Application>(`${this.baseUrl}/${id}`, request));
  }

  setActive(id: number, isActive: boolean): Promise<Application> {
    return firstValueFrom(this.http.post<Application>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Only succeeds for an application with no licenses; the API refuses the rest. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
