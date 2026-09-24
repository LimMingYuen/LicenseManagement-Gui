import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Role, SaveRoleRequest } from '../models/role.models';
import { RolePagePermission, SetRolePermissionsRequest } from '../models/page.models';

/** Calls the roles API. */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/roles';

  /** Lists all roles with their user counts. */
  list(): Promise<Role[]> {
    return firstValueFrom(this.http.get<Role[]>(this.baseUrl));
  }

  /** Creates a role. */
  create(request: SaveRoleRequest): Promise<Role> {
    return firstValueFrom(this.http.post<Role>(this.baseUrl, request));
  }

  /** Renames a role or changes its description. */
  update(id: number, request: SaveRoleRequest): Promise<Role> {
    return firstValueFrom(this.http.put<Role>(`${this.baseUrl}/${id}`, request));
  }

  /** Lists every page with whether the role may access it. */
  permissions(id: number): Promise<RolePagePermission[]> {
    return firstValueFrom(this.http.get<RolePagePermission[]>(`${this.baseUrl}/${id}/permissions`));
  }

  /** Sets the role's access to each listed page. */
  setPermissions(id: number, request: SetRolePermissionsRequest): Promise<RolePagePermission[]> {
    return firstValueFrom(
      this.http.put<RolePagePermission[]>(`${this.baseUrl}/${id}/permissions`, request),
    );
  }

  /** Deletes a role that no user holds. */
  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
