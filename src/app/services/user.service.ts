import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateUserRequest, UpdateUserRequest, User } from '../models/user.models';

/** Calls the users API. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  /** Lists users, optionally filtered by search text. */
  list(search?: string): Promise<User[]> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return firstValueFrom(this.http.get<User[]>(this.baseUrl, { params }));
  }

  /** Creates a user. */
  create(request: CreateUserRequest): Promise<User> {
    return firstValueFrom(this.http.post<User>(this.baseUrl, request));
  }

  /** Updates a user. */
  update(id: number, request: UpdateUserRequest): Promise<User> {
    return firstValueFrom(this.http.put<User>(`${this.baseUrl}/${id}`, request));
  }

  /** Activates or deactivates a user. */
  setActive(id: number, isActive: boolean): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  /** Sets a new password for a user. */
  resetPassword(id: number, newPassword: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/${id}/password`, { newPassword }));
  }
}
