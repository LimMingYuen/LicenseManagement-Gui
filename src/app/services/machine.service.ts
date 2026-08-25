import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateMachineRequest,
  Machine,
  MachineListQuery,
  UpdateMachineRequest,
} from '../models/machine.models';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/machines';

  list(query?: MachineListQuery): Promise<Machine[]> {
    let params = new HttpParams();

    if (query?.customerId) {
      params = params.set('customerId', String(query.customerId));
    }

    if (query?.licensedForApplicationId) {
      params = params.set('licensedForApplicationId', String(query.licensedForApplicationId));
    }

    if (query?.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    if (query?.includeInactive === false) {
      params = params.set('includeInactive', 'false');
    }

    return firstValueFrom(this.http.get<Machine[]>(this.baseUrl, { params }));
  }

  get(id: number): Promise<Machine> {
    return firstValueFrom(this.http.get<Machine>(`${this.baseUrl}/${id}`));
  }

  create(request: CreateMachineRequest): Promise<Machine> {
    return firstValueFrom(this.http.post<Machine>(this.baseUrl, request));
  }

  update(id: number, request: UpdateMachineRequest): Promise<Machine> {
    return firstValueFrom(this.http.put<Machine>(`${this.baseUrl}/${id}`, request));
  }

  setActive(id: number, isActive: boolean): Promise<Machine> {
    return firstValueFrom(this.http.post<Machine>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Only succeeds for a machine with no licenses; the API refuses the rest. SuperAdmin only. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
