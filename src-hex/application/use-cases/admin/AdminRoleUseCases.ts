import { PrismaClient } from '@prisma/client';

/**
 * AdminRoleUseCases
 *
 * CRUD operations for roles and their permissions within tenants.
 * systemRole authorization is removed (field deprecated) — auth is done
 * solely by the hex AuthMiddleware (requireAuth).
 */
export class AdminRoleUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async createRole(data: { name: string; tenantId: string }, createdBy: string) {
    const existing = await this.prisma.role.findFirst({
      where: { name: data.name, tenantId: data.tenantId },
    });
    if (existing) throw new Error(`Role '${data.name}' already exists in this tenant`);

    return this.prisma.role.create({
      data: {
        name:     data.name,
        tenantId: data.tenantId,
      },
    });
  }

  async getTenantRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: true },
    });
  }

  async getAllRoles(tenantId?: string) {
    return this.prisma.role.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { permissions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoleById(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    if (!role) throw new Error('Role not found');
    return role;
  }

  async updateRole(roleId: string, data: { name?: string; description?: string }) {
    return this.prisma.role.update({ where: { id: roleId }, data });
  }

  async deleteRole(roleId: string) {
    await this.prisma.permission.deleteMany({ where: { roleId } });
    return this.prisma.role.delete({ where: { id: roleId } });
  }

  // ── PERMISSIONS ───────────────────────────────────────────────────────────

  async addPermission(roleId: string, data: {
    applicationId: string;
    resource: string;
    action: string;
  }) {
    const existing = await this.prisma.permission.findFirst({
      where: { roleId, applicationId: data.applicationId, resource: data.resource, action: data.action },
    });
    if (existing) throw new Error('Permission already assigned to this role');

    return this.prisma.permission.create({
      data: { roleId, applicationId: data.applicationId, resource: data.resource, action: data.action },
    });
  }

  async getRolePermissions(roleId: string) {
    return this.prisma.permission.findMany({ where: { roleId } });
  }

  async removePermission(permissionId: string) {
    return this.prisma.permission.delete({ where: { id: permissionId } });
  }

  async removePermissionByResourceAction(
    roleId: string, applicationId: string, resource: string, action: string
  ) {
    return this.prisma.permission.deleteMany({
      where: { roleId, applicationId, resource, action },
    });
  }
}
