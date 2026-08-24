import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateCustomerRequest,
  Customer,
  UpdateCustomerRequest,
} from '../models/customer.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/customers';

  /**
   * @param includeInactive Retired customers stay in the management list so they can be
   * reactivated, but the generate-form picker passes false — you cannot issue against them.
   */
  list(options?: { search?: string; includeInactive?: boolean }): Promise<Customer[]> {
    let params = new HttpParams();

    if (options?.search?.trim()) {
      params = params.set('search', options.search.trim());
    }

    if (options?.includeInactive === false) {
      params = params.set('includeInactive', 'false');
    }

    return firstValueFrom(this.http.get<Customer[]>(this.baseUrl, { params }));
  }

  get(id: number): Promise<Customer> {
    return firstValueFrom(this.http.get<Customer>(`${this.baseUrl}/${id}`));
  }

  create(request: CreateCustomerRequest): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(this.baseUrl, request));
  }

  update(id: number, request: UpdateCustomerRequest): Promise<Customer> {
    return firstValueFrom(this.http.put<Customer>(`${this.baseUrl}/${id}`, request));
  }

  setActive(id: number, isActive: boolean): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Moves every license onto {@link targetId} and deletes this customer. SuperAdmin only. */
  merge(id: number, targetId: number): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${this.baseUrl}/${id}/merge`, { targetId }));
  }

  /** Only succeeds for a customer with no licenses; the API refuses the rest. SuperAdmin only. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
