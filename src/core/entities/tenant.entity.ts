/**
 * Tenant & Multi-tenancy Entities
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

export interface Permission {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  createdAt: Date;
}
