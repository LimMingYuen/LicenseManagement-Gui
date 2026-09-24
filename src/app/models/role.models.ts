/** Name of the built-in role with full access. */
export const SUPER_ADMIN_ROLE = 'SuperAdmin';

export interface Role {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  pageCount: number;
}

export interface SaveRoleRequest {
  name: string;
  description: string;
}
