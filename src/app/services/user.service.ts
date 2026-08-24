import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateUserRequest, UpdateUserRequest, User } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  list(search?: string): Promise<User[]> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return firstValueFrom(this.http.get<User[]>(this.baseUrl, { params }));
  }

  create(request: CreateUserRequest): Promise<User> {
    return firstValueFrom(this.http.post<User>(this.baseUrl, request));
  }

  update(id: number, request: UpdateUserRequest): Promise<User> {
    return firstValueFrom(this.http.put<User>(`${this.baseUrl}/${id}`, request));
  }

  setActive(id: number, isActive: boolean): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.baseUrl}/${id}/status`, { isActive }));
  }

  resetPassword(id: number, newPassword: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.baseUrl}/${id}/password`, { newPassword }));
  }
}
