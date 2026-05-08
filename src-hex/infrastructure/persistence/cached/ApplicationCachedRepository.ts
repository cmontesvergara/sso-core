import { Application, TenantApplication } from '../../../domain/entities/Application';
import { IApplicationRepository } from '../../../domain/repositories/IApplicationRepository';
import { ApplicationId } from '../../../domain/value-objects/Ids';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_APP = 30 * 60; // 30 min — apps rarely change

interface AppSnapshot {
  id: string; appId: string; name: string; url: string;
  description: string | null; logoUrl: string | null; backendUrl: string | null;
  isActive: boolean; audience: string | null; scope: string[];
  createdAt: string; updatedAt: string;
}

interface TenantAppSnapshot {
  id: string;
  tenantId: string; applicationId: string; isEnabled: boolean;
  config: Record<string, any>;
  createdAt: string; updatedAt: string;
}

/**
 * ApplicationCachedRepository
 * Cache-Aside decorator for IApplicationRepository.
 * Applications are near-static OAuth clients — high TTL is appropriate.
 */
export class ApplicationCachedRepository implements IApplicationRepository {
  constructor(
    private readonly db: IApplicationRepository,
    private readonly cache: RedisCacheService<AppSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly tenantAppCache: RedisCacheService<TenantAppSnapshot>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: ApplicationId): Promise<Application | null> {
    const key = this.keys.application(id.value);
    const cached = await this.cache.get(key);
    if (cached) return this.fromSnapshot(cached);

    const app = await this.db.findById(id);
    if (app) await this.cache.set(key, this.toSnapshot(app), TTL_APP);
    return app;
  }

  async findByClientId(clientId: string): Promise<Application | null> {
    const lookupKey = this.keys.applicationByClientId(clientId);
    const appId = await this.lookupCache.get(lookupKey);
    if (appId) {
      const cached = await this.cache.get(this.keys.application(appId));
      if (cached) return this.fromSnapshot(cached);
    }

    const app = await this.db.findByClientId(clientId);
    if (app) {
      await Promise.all([
        this.cache.set(this.keys.application(app.id.value), this.toSnapshot(app), TTL_APP),
        this.lookupCache.set(lookupKey, app.id.value, TTL_APP),
      ]);
    }
    return app;
  }

  async save(application: Application): Promise<void> {
    await this.db.save(application);
    await Promise.all([
      this.cache.set(this.keys.application(application.id.value), this.toSnapshot(application), TTL_APP),
      this.lookupCache.set(this.keys.applicationByClientId(application.appId), application.id.value, TTL_APP),
    ]);
  }

  async update(application: Application): Promise<void> {
    await this.db.update(application);
    await Promise.all([
      this.cache.set(this.keys.application(application.id.value), this.toSnapshot(application), TTL_APP),
      this.lookupCache.set(this.keys.applicationByClientId(application.appId), application.id.value, TTL_APP),
    ]);
  }

  async delete(id: ApplicationId): Promise<void> {
    const app = await this.findById(id);
    await this.db.delete(id);
    const tasks: Promise<void>[] = [this.cache.delete(this.keys.application(id.value))];
    if (app) tasks.push(this.lookupCache.delete(this.keys.applicationByClientId(app.appId)));
    await Promise.all(tasks);
  }

  async findActive(): Promise<Application[]> {
    return this.db.findActive(); // not separately cached
  }

  async existsByClientId(clientId: string): Promise<boolean> {
    const inCache = await this.lookupCache.exists(this.keys.applicationByClientId(clientId));
    if (inCache) return true;
    return this.db.existsByClientId(clientId);
  }

  async findTenantApplication(tenantId: TenantId, applicationId: ApplicationId): Promise<TenantApplication | null> {
    const key = this.keys.tenantApplication(tenantId.value, applicationId.value);
    const cached = await this.tenantAppCache.get(key);
    if (cached) return this.fromTenantAppSnapshot(cached);

    const tenantApp = await this.db.findTenantApplication(tenantId, applicationId);
    if (tenantApp) await this.tenantAppCache.set(key, this.toTenantAppSnapshot(tenantApp), TTL_APP);
    return tenantApp;
  }

  async saveTenantApplication(tenantApplication: TenantApplication): Promise<void> {
    await this.db.saveTenantApplication(tenantApplication);
    const key = this.keys.tenantApplication(tenantApplication.tenantId.value, tenantApplication.applicationId.value);
    await this.tenantAppCache.set(key, this.toTenantAppSnapshot(tenantApplication), TTL_APP);
  }

  async updateTenantApplication(tenantApplication: TenantApplication): Promise<void> {
    await this.db.updateTenantApplication(tenantApplication);
    const key = this.keys.tenantApplication(tenantApplication.tenantId.value, tenantApplication.applicationId.value);
    await this.tenantAppCache.set(key, this.toTenantAppSnapshot(tenantApplication), TTL_APP);
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  private toSnapshot(a: Application): AppSnapshot {
    return {
      id: a.id.value, appId: a.appId, name: a.name, url: a.url,
      description: a.description, logoUrl: a.logoUrl, backendUrl: a.backendUrl,
      isActive: a.isActive, audience: a.audience, scope: [...a.scope],
      createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
    };
  }

  private fromSnapshot(s: AppSnapshot): Application {
    return new Application(
      ApplicationId.create(s.id), s.appId, s.name, s.url,
      s.description, s.logoUrl, s.backendUrl, s.isActive,
      s.audience, s.scope, new Date(s.createdAt), new Date(s.updatedAt)
    );
  }

  private toTenantAppSnapshot(ta: TenantApplication): TenantAppSnapshot {
    return {
      id: ta.id,
      tenantId: ta.tenantId.value,
      applicationId: ta.applicationId.value,
      isEnabled: ta.isEnabled,
      config: ta.config ?? {},
      createdAt: ta.createdAt.toISOString(),
      updatedAt: ta.updatedAt.toISOString(),
    };
  }

  private fromTenantAppSnapshot(s: TenantAppSnapshot): TenantApplication {
    return new TenantApplication(
      s.id,
      TenantId.create(s.tenantId),
      ApplicationId.create(s.applicationId),
      s.isEnabled,
      s.config,
      new Date(s.createdAt),
      new Date(s.updatedAt)
    );
  }
}
