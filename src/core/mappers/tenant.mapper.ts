/**
 * Tenant Mappers
 * Functions to map between Prisma Tenant entities and DTOs
 */

import {
    Permission as PrismaPermission,
    Role as PrismaRole,
    Tenant as PrismaTenant,
    TenantMember as PrismaTenantMember,
    User as PrismaUser,
} from '@prisma/client';
import {
    PermissionResponseDTO,
    RoleResponseDTO,
    TenantMemberResponseDTO,
    TenantResponseDTO,
} from '../dtos';
import { mapUserToResponse } from './user.mapper';

/**
 * Map Prisma Tenant to Tenant Response DTO
 */
export function mapTenantToResponse(tenant: PrismaTenant): TenantResponseDTO {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    createdAt: tenant.createdAt,
  };
}

/**
 * Map Prisma TenantMember to TenantMember Response DTO
 */
export function mapTenantMemberToResponse(
  tenantMember: PrismaTenantMember & { user?: PrismaUser }
): TenantMemberResponseDTO {
  return {
    id: tenantMember.id,
    tenantId: tenantMember.tenantId,
    userId: tenantMember.userId,
    role: tenantMember.role,
    createdAt: tenantMember.createdAt,
    user: tenantMember.user ? mapUserToResponse(tenantMember.user) : undefined,
  };
}

/**
 * Map Prisma Role to Role Response DTO
 */
export function mapRoleToResponse(
  role: PrismaRole & { permissions?: PrismaPermission[] }
): RoleResponseDTO {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    createdAt: role.createdAt,
    permissions: role.permissions ? role.permissions.map(mapPermissionToResponse) : undefined,
  };
}

/**
 * Map Prisma Permission to Permission Response DTO
 */
export function mapPermissionToResponse(permission: PrismaPermission): PermissionResponseDTO {
  return {
    id: permission.id,
    roleId: permission.roleId,
    resource: permission.resource,
    action: permission.action,
    createdAt: permission.createdAt,
  };
}
