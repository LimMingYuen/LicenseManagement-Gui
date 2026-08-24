export type UserRole = 'SuperAdmin' | 'Operator';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserRequest {
  fullName: string;
  role: UserRole;
  isActive: boolean;
}
