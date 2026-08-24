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

@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/licenses';

  list(query: LicenseListQuery = {}): Promise<License[]> {
    let params = new HttpParams();
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.type) params = params.set('type', query.type);
    if (query.status) params = params.set('status', query.status);
    if (query.application) params = params.set('application', query.application);

    return firstValueFrom(this.http.get<License[]>(this.baseUrl, { params }));
  }

  get(id: number): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.get<LicenseWithFile>(`${this.baseUrl}/${id}`));
  }

  summary(): Promise<LicenseSummary> {
    return firstValueFrom(this.http.get<LicenseSummary>(`${this.baseUrl}/summary`));
  }

  /** The management tree: Application → Customer → Machine → licenses. */
  catalog(): Promise<LicenseCatalog> {
    return firstValueFrom(this.http.get<LicenseCatalog>(`${this.baseUrl}/catalog`));
  }

  /** Re-downloads the stored file. Nothing is re-signed. */
  download(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/${id}/file`, { responseType: 'blob' }),
    );
  }

  generateMachine(request: GenerateMachineRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/machine`, request));
  }

  generateRobot(request: GenerateRobotRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/robot`, request));
  }

  generateGateway(request: GenerateGatewayRequest): Promise<LicenseWithFile> {
    return firstValueFrom(this.http.post<LicenseWithFile>(`${this.baseUrl}/gateway`, request));
  }

  revoke(id: number, reason: string | null): Promise<License> {
    return firstValueFrom(this.http.post<License>(`${this.baseUrl}/${id}/revoke`, { reason }));
  }
}
