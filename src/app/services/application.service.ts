import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Application,
  CreateApplicationRequest,
  UpdateApplicationRequest,
} from '../models/application.models';
import { LicenseKind } from '../models/license.models';

/** Calls the applications API. */
@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/applications';

  /** Lists applications, optionally filtered by search text, payload type and active state. */
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

  /** Gets one application by ID. */
  get(id: number): Promise<Application> {
    return firstValueFrom(this.http.get<Application>(`${this.baseUrl}/${id}`));
  }

  /** Creates an application. */
  create(request: CreateApplicationRequest): Promise<Application> {
    return firstValueFrom(this.http.post<Application>(this.baseUrl, request));
  }

  /** Updates an application. */
  update(id: number, request: UpdateApplicationRequest): Promise<Application> {
    return firstValueFrom(this.http.put<Application>(`${this.baseUrl}/${id}`, request));
  }

  /** Activates or deactivates an application. */
  setActive(id: number, isActive: boolean): Promise<Application> {
    return firstValueFrom(this.http.post<Application>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Deletes an application that has no licenses. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
