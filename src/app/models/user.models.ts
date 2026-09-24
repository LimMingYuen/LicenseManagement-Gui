export interface User {
  id: number;
  username: string;
  fullName: string;
  roleId: number;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Signed-in user with the page paths their role may open. */
export interface CurrentUser extends User {
  allowedPages: string[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

export interface UpdateUserRequest {
  fullName: string;
  role: string;
  isActive: boolean;
}
