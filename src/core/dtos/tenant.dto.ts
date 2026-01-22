import { UserResponseDTO } from './user.dto';

export interface CreateTenantDTO {
  name: string;
  slug: string;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
}

export interface TenantResponseDTO {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface TenantMemberResponseDTO {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user?: UserResponseDTO;
}

// Role & Permission DTOs
export interface CreateRoleDTO {
  tenantId: string;
  name: string;
}

export interface RoleResponseDTO {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
  permissions?: PermissionResponseDTO[];
}

export interface CreatePermissionDTO {
  roleId: string;
  resource: string;
  action: string;
}

export interface PermissionResponseDTO {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  createdAt: Date;
}
