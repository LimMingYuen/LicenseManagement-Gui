import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CreateCustomerRequest,
  Customer,
  UpdateCustomerRequest,
} from '../models/customer.models';

/** Calls the customers API. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/customers';

  /** Lists customers, optionally filtered by search text and active state. */
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

  /** Gets one customer by ID. */
  get(id: number): Promise<Customer> {
    return firstValueFrom(this.http.get<Customer>(`${this.baseUrl}/${id}`));
  }

  /** Creates a customer. */
  create(request: CreateCustomerRequest): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(this.baseUrl, request));
  }

  /** Updates a customer. */
  update(id: number, request: UpdateCustomerRequest): Promise<Customer> {
    return firstValueFrom(this.http.put<Customer>(`${this.baseUrl}/${id}`, request));
  }

  /** Activates or deactivates a customer. */
  setActive(id: number, isActive: boolean): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Moves every license onto the target customer and deletes this one. */
  merge(id: number, targetId: number): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(`${this.baseUrl}/${id}/merge`, { targetId }));
  }

  /** Deletes a customer that has no licenses. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
