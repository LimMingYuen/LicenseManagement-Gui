import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  GenerateGatewayRequest,
  GenerateMachineRequest,
  GenerateRobotRequest,
  License,
  LicenseCatalog,
  LicenseListQuery,
  LicenseSummary,
  LicenseWithFile,
} from '../models/license.models';

/** Calls the licenses API. */
@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/licenses';

  /** Lists licenses matching the query. */
  list(query: LicenseListQuery = {}): Promise<License[]> {
    let params = new HttpParams();
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.type) params = params.set('type', query.type);
    if (query.status) params = params.set('status', query.status);
    if (query.application) params = params.set('application', query.application);

    return firstValueFrom(this.http.get<License[]>(this.baseUrl, { params }));
  }

  /** Gets one license with its signed file. */
  get(id: number): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.get<LicenseWithFile>(`${this.baseUrl}/${id}`));
  }

  /** Gets the dashboard counts and recent licenses. */
  summary(): Promise<LicenseSummary> {
    return firstValueFrom(this.http.get<LicenseSummary>(`${this.baseUrl}/summary`));
  }

  /** Gets the license catalog tree. */
  catalog(): Promise<LicenseCatalog> {
    return firstValueFrom(this.http.get<LicenseCatalog>(`${this.baseUrl}/catalog`));
  }

  /** Downloads the stored license file without re-signing it. */
  download(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/${id}/file`, { responseType: 'blob' }),
    );
  }

  /** Issues a machine license. */
  generateMachine(request: GenerateMachineRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/machine`, request));
  }

  /** Issues a robot license. */
  generateRobot(request: GenerateRobotRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/robot`, request));
  }

  /** Issues a gateway license. */
  generateGateway(request: GenerateGatewayRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/gateway`, request));
  }

  /** Revokes a license with an optional reason. */
  revoke(id: number, reason: string | null): Promise<License> {
    return firstValueFrom(this.http.post<License>(`${this.baseUrl}/${id}/revoke`, { reason }));
  }
}
