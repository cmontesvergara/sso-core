import { Application, TenantApplication } from '../../../domain/entities/Application';
import { IApplicationRepository } from '../../../domain/repositories/IApplicationRepository';
import { ApplicationId } from '../../../domain/value-objects/Ids';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaApplicationRepository
 * Implementation of IApplicationRepository using Prisma ORM
 * Aligned with Prisma schema: applications + tenant_apps tables
 */
export class PrismaApplicationRepository implements IApplicationRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: ApplicationId): Promise<Application | null> {
    const app = await this.prisma.application.findUnique({
      where: { id: id.value },
    });
    return app ? this.mapToDomain(app) : null;
  }

  async findByClientId(clientId: string): Promise<Application | null> {
    const app = await this.prisma.application.findUnique({
      where: { appId: clientId },
    });
    return app ? this.mapToDomain(app) : null;
  }

  async save(application: Application): Promise<void> {
    await this.prisma.application.create({
      data: {
        id: application.id.value,
        appId: application.appId,
        name: application.name,
        url: application.url,
        description: application.description,
        logoUrl: application.logoUrl,
        backendUrl: application.backendUrl,
        isActive: application.isActive,
        audience: application.audience,
        scope: [...application.scope],
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      },
    });
  }

  async update(application: Application): Promise<void> {
    await this.prisma.application.update({
      where: { id: application.id.value },
      data: {
        name: application.name,
        url: application.url,
        description: application.description,
        logoUrl: application.logoUrl,
        backendUrl: application.backendUrl,
        isActive: application.isActive,
        audience: application.audience,
        scope: [...application.scope],
        updatedAt: application.updatedAt,
      },
    });
  }

  async delete(id: ApplicationId): Promise<void> {
    await this.prisma.application.delete({ where: { id: id.value } });
  }

  async findActive(): Promise<Application[]> {
    const apps = await this.prisma.application.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return apps.map((a: any) => this.mapToDomain(a));
  }

  async existsByClientId(clientId: string): Promise<boolean> {
    const count = await this.prisma.application.count({
      where: { appId: clientId },
    });
    return count > 0;
  }

  async findTenantApplication(
    tenantId: TenantId,
    applicationId: ApplicationId
  ): Promise<TenantApplication | null> {
    const ta = await this.prisma.tenantApp.findFirst({
      where: {
        tenantId: tenantId.value,
        applicationId: applicationId.value,
      },
    });
    return ta ? this.mapTenantAppToDomain(ta) : null;
  }

  async saveTenantApplication(tenantApplication: TenantApplication): Promise<void> {
    await this.prisma.tenantApp.create({
      data: {
        id: tenantApplication.id,
        tenantId: tenantApplication.tenantId.value,
        applicationId: tenantApplication.applicationId.value,
        isEnabled: tenantApplication.isEnabled,
        createdAt: tenantApplication.createdAt,
        updatedAt: tenantApplication.updatedAt,
      },
    });
  }

  async updateTenantApplication(tenantApplication: TenantApplication): Promise<void> {
    await this.prisma.tenantApp.update({
      where: { id: tenantApplication.id },
      data: {
        isEnabled: tenantApplication.isEnabled,
        updatedAt: tenantApplication.updatedAt,
      },
    });
  }

  private mapToDomain(raw: any): Application {
    return new Application(
      ApplicationId.create(raw.id),
      raw.appId,
      raw.name,
      raw.url ?? '',
      raw.description ?? null,
      raw.logoUrl ?? null,
      raw.backendUrl ?? null,
      raw.isActive ?? true,
      raw.audience ?? null,
      raw.scope ?? [],
      raw.createdAt,
      raw.updatedAt
    );
  }

  private mapTenantAppToDomain(raw: any): TenantApplication {
    return new TenantApplication(
      raw.id,
      TenantId.create(raw.tenantId),
      ApplicationId.create(raw.appId),
      raw.isEnabled ?? true,
      raw.config ?? null,
      raw.createdAt,
      raw.updatedAt
    );
  }
}
