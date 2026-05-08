import { Role } from '../../../domain/entities/Role';
import { IRoleRepository } from '../../../domain/repositories/IRoleRepository';
import { RoleId } from '../../../domain/value-objects/Ids';
import { RoleName, Permission } from '../../../domain/value-objects/RoleName';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaRoleRepository
 * Implementation of IRoleRepository using Prisma ORM
 * Aligned with Prisma schema: roles + permissions tables
 */
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: RoleId): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({
      where: { id: id.value },
      include: { permissions: true },
    });
    return role ? this.mapToDomain(role) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const role = await this.prisma.role.findFirst({
      where: { name },
      include: { permissions: true },
    });
    return role ? this.mapToDomain(role) : null;
  }

  async save(role: Role): Promise<void> {
    // Role requires a tenantId FK in the schema.
    // When creating roles outside of a tenant context, callers should use
    // prisma directly. This method is a no-op placeholder.
    throw new Error('PrismaRoleRepository.save requires tenantId — use createForTenant instead');
  }

  async update(role: Role): Promise<void> {
    await this.prisma.role.update({
      where: { id: role.id.value },
      data: { name: role.name.value },
    });
  }

  async delete(id: RoleId): Promise<void> {
    await this.prisma.role.delete({ where: { id: id.value } });
  }

  async findAll(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    return roles.map((r: any) => this.mapToDomain(r));
  }

  async findActive(): Promise<Role[]> {
    // Prisma schema does not have an isActive field on Role;
    // returning all roles as active is the current behavior.
    return this.findAll();
  }

  async findByTenant(tenantId: TenantId): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: tenantId.value },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    return roles.map((r: any) => this.mapToDomain(r));
  }

  private mapToDomain(raw: any): Role {
    const permissions: Permission[] = (raw.permissions ?? []).map((p: any) =>
      Permission.create(`${p.resource}:${p.action}`)
    );

    return new Role(
      RoleId.create(raw.id),
      RoleName.create(raw.name),
      raw.description ?? '',
      permissions,
      false, // isSystem — not tracked in current schema
      'active', // status — not tracked in current schema
      raw.createdAt,
      raw.createdAt // updatedAt — not tracked in current schema
    );
  }
}
