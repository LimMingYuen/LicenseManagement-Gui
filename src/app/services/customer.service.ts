import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateCustomerRequest, Customer } from '../models/customer.models';

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

  /** Deletes a customer with no active licenses. SuperAdmin only. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
