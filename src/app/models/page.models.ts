export interface PageDto {
  id: number;
  path: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface SyncPagesResult {
  newPages: number;
  updatedPages: number;
  unchangedPages: number;
  deletedPages: number;
}

export interface RolePagePermission {
  pageId: number;
  path: string;
  name: string;
  icon: string | null;
  canAccess: boolean;
}

export interface SetRolePermissionsRequest {
  pages: { pageId: number; canAccess: boolean }[];
}
