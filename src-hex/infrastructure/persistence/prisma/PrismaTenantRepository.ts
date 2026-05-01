import { Tenant, TenantSettings } from '../../../domain/entities/Tenant';
import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaTenantRepository
 * Implementation of ITenantRepository using Prisma ORM
 * Aligned with Prisma schema: tenants table
 */
export class PrismaTenantRepository implements ITenantRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: TenantId): Promise<Tenant | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: id.value },
    });
    return tenant ? this.mapToDomain(tenant) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    return tenant ? this.mapToDomain(tenant) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.create({
      data: {
        id: tenant.id.value,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
      },
    });
  }

  async update(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenant.id.value },
      data: {
        name: tenant.name,
      },
    });
  }

  async delete(id: TenantId): Promise<void> {
    await this.prisma.tenant.delete({ where: { id: id.value } });
  }

  async findAll(): Promise<Tenant[]> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map((t: any) => this.mapToDomain(t));
  }

  async findActive(): Promise<Tenant[]> {
    // Tenant schema has no isActive column — return all tenants
    return this.findAll();
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const count = await this.prisma.tenant.count({ where: { slug } });
    return count === 0;
  }

  private mapToDomain(raw: any): Tenant {
    const settings: TenantSettings = {};
    return new Tenant(
      TenantId.create(raw.id),
      raw.name,
      raw.slug,
      'active', // status — not in current schema
      settings,
      raw.createdAt,
      raw.createdAt // updatedAt not in schema
    );
  }
}
