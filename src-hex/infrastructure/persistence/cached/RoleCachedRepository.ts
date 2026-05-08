import { Role, RoleStatus } from '../../../domain/entities/Role';
import { IRoleRepository } from '../../../domain/repositories/IRoleRepository';
import { RoleId } from '../../../domain/value-objects/Ids';
import { RoleName, Permission } from '../../../domain/value-objects/RoleName';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';
import { TenantVersionService } from '../redis/TenantVersionService';

const TTL_ROLE        = 60 * 60; // 60 min — roles are near-static
const TTL_TENANT_LIST = 30 * 60; // 30 min

interface RoleSnapshot {
  id: string; name: string; description: string;
  permissions: string[]; isSystem: boolean; status: RoleStatus;
  createdAt: string; updatedAt: string;
  /** tenantId stored so we can resolve the version group on read */
  tenantId: string | null;
}

/**
 * RoleCachedRepository
 * Cache-Aside decorator for IRoleRepository.
 *
 * Uses TenantVersionService to include :v{N} in every key.
 * To invalidate ALL cached roles for a tenant, call:
 *   tenantVersionService.incrVersion(tenantId)
 * No SCAN, no DEL loop. O(1) group invalidation.
 */
export class RoleCachedRepository implements IRoleRepository {
  constructor(
    private readonly db: IRoleRepository,
    private readonly cache: RedisCacheService<RoleSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly listCache: RedisCacheService<string[]>,
    private readonly keys: RedisKeyFactory,
    private readonly versions: TenantVersionService
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Resolves the current tenant version. Uses a global fallback (v1) when tenantId is unknown. */
  private async resolveVersion(tenantId: string | null): Promise<number> {
    if (!tenantId) return 1;
    return this.versions.getVersion(tenantId);
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async findById(id: RoleId): Promise<Role | null> {
    // Role id keys include tenantId in the snapshot for version resolution.
    // We try a scan-free approach: version is embedded in the snapshot itself.
    // Since we don't know the tenant upfront, try DB first and then cache.
    // For hot paths (findByTenant → findById), the tenant context is known.
    const role = await this.db.findById(id);
    if (role) {
      // We can't resolve tenant from just an id without a second query.
      // Use v0 for by-id keys as a conservative fallback — they'll be repopulated
      // on the next findByTenant/findByName which do know the tenant.
      const key = this.keys.role(id.value, 1);
      await this.cache.set(key, this.toSnapshot(role, null), TTL_ROLE);
    }
    return role;
  }

  async findByName(name: string): Promise<Role | null> {
    // name keys are tenant-agnostic — use v1 as a conservative global version
    const lookupKey = this.keys.roleByName(name, 1);
    const roleId = await this.lookupCache.get(lookupKey);
    if (roleId) {
      const cached = await this.cache.get(this.keys.role(roleId, 1));
      if (cached) return this.fromSnapshot(cached);
    }

    const role = await this.db.findByName(name);
    if (role) {
      await Promise.all([
        this.cache.set(this.keys.role(role.id.value, 1), this.toSnapshot(role, null), TTL_ROLE),
        this.lookupCache.set(lookupKey, role.id.value, TTL_ROLE),
      ]);
    }
    return role;
  }

  async findByTenant(tenantId: TenantId): Promise<Role[]> {
    const version = await this.resolveVersion(tenantId.value);
    const listKey = this.keys.rolesByTenant(tenantId.value, version);

    const ids = await this.listCache.get(listKey);
    if (ids?.length) {
      const snaps = await this.cache.getMany(ids.map(id => this.keys.role(id, version)));
      if (snaps.size === ids.length)
        return Array.from(snaps.values()).map(s => this.fromSnapshot(s));
    }

    const roles = await this.db.findByTenant(tenantId);
    if (roles.length) {
      const entries = new Map(
        roles.map(r => [this.keys.role(r.id.value, version), this.toSnapshot(r, tenantId.value)])
      );
      await Promise.all([
        this.cache.setMany(entries, TTL_ROLE),
        this.listCache.set(listKey, roles.map(r => r.id.value), TTL_TENANT_LIST),
        // Also populate name → id lookups
        ...roles.map(r =>
          this.lookupCache.set(this.keys.roleByName(r.name.value, version), r.id.value, TTL_ROLE)
        ),
      ]);
    }
    return roles;
  }

  async findAll(): Promise<Role[]> { return this.db.findAll(); }
  async findActive(): Promise<Role[]> { return this.db.findActive(); }

  // ── Writes ─────────────────────────────────────────────────────────────────

  async save(role: Role): Promise<void> {
    await this.db.save(role);
    // Don't cache on save — tenant context unknown, let findByTenant repopulate
  }

  async update(role: Role): Promise<void> {
    await this.db.update(role);
    // Invalidate by bumping tenant version — all keys become stale naturally
    // Caller must provide tenantId via domain event or service layer.
    // Here we just flush the v1 fallback keys we might have set.
    await Promise.all([
      this.cache.delete(this.keys.role(role.id.value, 1)),
      this.lookupCache.delete(this.keys.roleByName(role.name.value, 1)),
    ]);
  }

  async delete(id: RoleId): Promise<void> {
    const role = await this.db.findById(id);
    await this.db.delete(id);
    if (role) {
      await Promise.all([
        this.cache.delete(this.keys.role(id.value, 1)),
        this.lookupCache.delete(this.keys.roleByName(role.name.value, 1)),
      ]);
    }
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  private toSnapshot(r: Role, tenantId: string | null): RoleSnapshot {
    return {
      id: r.id.value, name: r.name.value, description: r.description,
      permissions: r.permissions.map(p => String(p)),
      isSystem: r.isSystem, status: r.status,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      tenantId,
    };
  }

  private fromSnapshot(s: RoleSnapshot): Role {
    return new Role(
      RoleId.create(s.id), RoleName.create(s.name), s.description,
      s.permissions as unknown as Permission[], s.isSystem, s.status,
      new Date(s.createdAt), new Date(s.updatedAt)
    );
  }
}
