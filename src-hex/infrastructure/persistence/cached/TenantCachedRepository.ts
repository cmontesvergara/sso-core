import { Tenant, TenantStatus, TenantSettings } from '../../../domain/entities/Tenant';
import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

const TTL_TENANT = 30 * 60; // 30 min — tenants rarely change
const TTL_LIST   = 10 * 60; // 10 min — all-tenants list

interface TenantSnapshot {
  id: string; name: string; slug: string;
  status: TenantStatus; settings: TenantSettings;
  createdAt: string; updatedAt: string;
}

/**
 * TenantCachedRepository
 * Cache-Aside decorator for ITenantRepository.
 * Tenants are near-immutable configuration — high TTL is safe.
 */
export class TenantCachedRepository implements ITenantRepository {
  constructor(
    private readonly db: ITenantRepository,
    private readonly cache: RedisCacheService<TenantSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly listCache: RedisCacheService<string[]>,
    private readonly keys: RedisKeyFactory
  ) {}

  async findById(id: TenantId): Promise<Tenant | null> {
    const key = this.keys.tenant(id.value);
    const cached = await this.cache.get(key);
    if (cached) return this.fromSnapshot(cached);

    const tenant = await this.db.findById(id);
    if (tenant) await this.cache.set(key, this.toSnapshot(tenant), TTL_TENANT);
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const slugKey = this.keys.tenantBySlug(slug);
    const tenantId = await this.lookupCache.get(slugKey);
    if (tenantId) {
      const cached = await this.cache.get(this.keys.tenant(tenantId));
      if (cached) return this.fromSnapshot(cached);
    }

    const tenant = await this.db.findBySlug(slug);
    if (tenant) {
      await Promise.all([
        this.cache.set(this.keys.tenant(tenant.id.value), this.toSnapshot(tenant), TTL_TENANT),
        this.lookupCache.set(slugKey, tenant.id.value, TTL_TENANT),
      ]);
    }
    return tenant;
  }

  async save(tenant: Tenant): Promise<void> {
    await this.db.save(tenant);
    await Promise.all([
      this.cache.set(this.keys.tenant(tenant.id.value), this.toSnapshot(tenant), TTL_TENANT),
      this.lookupCache.set(this.keys.tenantBySlug(tenant.slug), tenant.id.value, TTL_TENANT),
      this.listCache.delete(this.keys.tenantsList()), // invalidate list
    ]);
  }

  async update(tenant: Tenant): Promise<void> {
    await this.db.update(tenant);
    await Promise.all([
      this.cache.set(this.keys.tenant(tenant.id.value), this.toSnapshot(tenant), TTL_TENANT),
      this.lookupCache.set(this.keys.tenantBySlug(tenant.slug), tenant.id.value, TTL_TENANT),
      this.listCache.delete(this.keys.tenantsList()),
    ]);
  }

  async delete(id: TenantId): Promise<void> {
    const tenant = await this.findById(id);
    await this.db.delete(id);
    const toInvalidate: Promise<void>[] = [this.cache.delete(this.keys.tenant(id.value))];
    if (tenant) toInvalidate.push(this.lookupCache.delete(this.keys.tenantBySlug(tenant.slug)));
    toInvalidate.push(this.listCache.delete(this.keys.tenantsList()));
    await Promise.all(toInvalidate);
  }

  async findAll(): Promise<Tenant[]> {
    const listKey = this.keys.tenantsList();
    const ids = await this.listCache.get(listKey);
    if (ids?.length) {
      const snapshots = await this.cache.getMany(ids.map(id => this.keys.tenant(id)));
      if (snapshots.size === ids.length)
        return Array.from(snapshots.values()).map(s => this.fromSnapshot(s));
    }

    const tenants = await this.db.findAll();
    if (tenants.length) {
      const entries = new Map(tenants.map(t => [this.keys.tenant(t.id.value), this.toSnapshot(t)]));
      await Promise.all([
        this.cache.setMany(entries, TTL_TENANT),
        this.listCache.set(listKey, tenants.map(t => t.id.value), TTL_LIST),
      ]);
    }
    return tenants;
  }

  async findActive(): Promise<Tenant[]> {
    return this.db.findActive(); // not separately cached
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const inCache = await this.lookupCache.exists(this.keys.tenantBySlug(slug));
    if (inCache) return false; // slug exists in cache → not available
    return this.db.isSlugAvailable(slug);
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  private toSnapshot(t: Tenant): TenantSnapshot {
    return {
      id: t.id.value, name: t.name, slug: t.slug,
      status: t.status, settings: { ...t.settings },
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    };
  }

  private fromSnapshot(s: TenantSnapshot): Tenant {
    return new Tenant(
      TenantId.create(s.id), s.name, s.slug,
      s.status, s.settings, new Date(s.createdAt), new Date(s.updatedAt)
    );
  }
}
