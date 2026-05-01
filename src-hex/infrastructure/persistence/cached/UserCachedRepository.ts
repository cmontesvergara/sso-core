import { User, UserTenantMembership } from '../../../domain/entities/User';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { Email } from '../../../domain/value-objects/Email';
import { PasswordHash } from '../../../domain/value-objects/PasswordHash';
import { NUID } from '../../../domain/value-objects/NUID';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { RoleName } from '../../../domain/value-objects/RoleName';
import { RedisCacheService } from '../redis/RedisCacheService';
import { RedisKeyFactory } from '../redis/RedisKeyFactoryService';

// ── TTL constants (seconds) ──────────────────────────────────────────────────
const TTL_USER        = 15 * 60; // 15 min — profile data
const TTL_LOOKUP      = 15 * 60; // 15 min — email / nuid → userId
const TTL_TENANT_LIST =  5 * 60; //  5 min — tenant member list (mutable)

/**
 * Plain-object representation of a User for Redis serialization.
 * All fields are primitives or ISO strings — no Value Objects.
 */
interface UserSnapshot {
  id:               string;
  email:            string;
  nuid:             string;
  firstName:        string;
  lastName:         string;
  passwordHash:     string;
  userStatus:       string;
  systemRole:       string;
  phone:            string;
  secondName:       string | null;
  secondLastName:   string | null;
  birthDate:        string | null;
  gender:           string | null;
  nationality:      string | null;
  birthPlace:       string | null;
  placeOfResidence: string | null;
  occupation:       string | null;
  maritalStatus:    string | null;
  recoveryPhone:    string | null;
  recoveryEmail:    string | null;
  createdAt:        string;
  updatedAt:        string;
  lastLoginAt:      string | null;
  /** Tenant memberships — required for canAccessTenant() to work on cache hit */
  tenantMemberships: Array<{ tenantId: string; role: string; joinedAt: string }>;
}

/**
 * UserCachedRepository
 * Cache-Aside decorator around any IUserRepository (typically PrismaUserRepository).
 *
 * Read path:  Redis first → on miss, delegate to db → populate cache.
 * Write path: delegate to db first → invalidate / update cache entries.
 *
 * Lookup keys (email, nuid) store only the userId string to avoid
 * duplicating snapshots. A second GET fetches the full snapshot by id.
 */
export class UserCachedRepository implements IUserRepository {
  constructor(
    private readonly db: IUserRepository,
    private readonly cache: RedisCacheService<UserSnapshot>,
    private readonly lookupCache: RedisCacheService<string>,
    private readonly listCache: RedisCacheService<string[]>,
    private readonly keys: RedisKeyFactory
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  async findById(id: UserId): Promise<User | null> {
    const key = this.keys.user(id.value);
    const cached = await this.cache.get(key);
    if (cached) return this.fromSnapshot(cached);

    const user = await this.db.findById(id);
    if (user) await this.cache.set(key, this.toSnapshot(user), TTL_USER);
    return user;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const emailKey = this.keys.userByEmail(email.value);

    // Step 1: email → userId
    const userId = await this.lookupCache.get(emailKey);
    if (userId) {
      const userKey = this.keys.user(userId);
      const cached = await this.cache.get(userKey);
      if (cached) return this.fromSnapshot(cached);
    }

    // Step 2: miss — delegate to DB
    const user = await this.db.findByEmail(email);
    if (user) {
      await Promise.all([
        this.cache.set(this.keys.user(user.id.value), this.toSnapshot(user), TTL_USER),
        this.lookupCache.set(emailKey, user.id.value, TTL_LOOKUP),
      ]);
    }
    return user;
  }

  async findByNUID(nuid: NUID): Promise<User | null> {
    const nuidKey = this.keys.userByNUID(nuid.value);

    // Step 1: nuid → userId
    const userId = await this.lookupCache.get(nuidKey);
    if (userId) {
      const userKey = this.keys.user(userId);
      const cached = await this.cache.get(userKey);
      if (cached) return this.fromSnapshot(cached);
    }

    // Step 2: miss — delegate to DB
    const user = await this.db.findByNUID(nuid);
    if (user) {
      await Promise.all([
        this.cache.set(this.keys.user(user.id.value), this.toSnapshot(user), TTL_USER),
        this.lookupCache.set(nuidKey, user.id.value, TTL_LOOKUP),
      ]);
    }
    return user;
  }

  async findByTenant(tenantId: TenantId): Promise<User[]> {
    const listKey = this.keys.usersByTenant(tenantId.value);
    const cachedIds = await this.listCache.get(listKey);

    if (cachedIds && cachedIds.length > 0) {
      // Batch-fetch snapshots
      const userKeys = cachedIds.map(id => this.keys.user(id));
      const snapshots = await this.cache.getMany(userKeys);

      // If all are in cache — return immediately
      if (snapshots.size === cachedIds.length) {
        return Array.from(snapshots.values()).map(s => this.fromSnapshot(s));
      }
    }

    // Miss — delegate to DB, populate caches
    const users = await this.db.findByTenant(tenantId);
    if (users.length > 0) {
      const entries = new Map<string, UserSnapshot>(
        users.map(u => [this.keys.user(u.id.value), this.toSnapshot(u)])
      );
      await Promise.all([
        this.cache.setMany(entries, TTL_USER),
        this.listCache.set(listKey, users.map(u => u.id.value), TTL_TENANT_LIST),
      ]);
    }
    return users;
  }

  // ── Existence checks ─────────────────────────────────────────────────────

  async existsByEmail(email: Email): Promise<boolean> {
    // If the lookup key exists → user exists (no DB round-trip)
    const inCache = await this.lookupCache.exists(this.keys.userByEmail(email.value));
    if (inCache) return true;
    return this.db.existsByEmail(email);
  }

  async existsByNUID(nuid: NUID): Promise<boolean> {
    const inCache = await this.lookupCache.exists(this.keys.userByNUID(nuid.value));
    if (inCache) return true;
    return this.db.existsByNUID(nuid);
  }

  async countByTenant(tenantId: TenantId): Promise<number> {
    // Count is cheap and mutable — always delegate to DB
    return this.db.countByTenant(tenantId);
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async save(user: User): Promise<void> {
    await this.db.save(user);
    // Populate all three keys for the new user
    await Promise.all([
      this.cache.set(this.keys.user(user.id.value), this.toSnapshot(user), TTL_USER),
      this.lookupCache.set(this.keys.userByEmail(user.email.value), user.id.value, TTL_LOOKUP),
      this.lookupCache.set(this.keys.userByNUID(user.nuid.value), user.id.value, TTL_LOOKUP),
    ]);
  }

  async update(user: User): Promise<void> {
    await this.db.update(user);
    // Invalidate stale entries then write the fresh snapshot
    await Promise.all([
      this.cache.delete(this.keys.user(user.id.value)),
      this.lookupCache.delete(this.keys.userByEmail(user.email.value)),
      this.lookupCache.delete(this.keys.userByNUID(user.nuid.value)),
    ]);
    // Re-populate with fresh data
    await Promise.all([
      this.cache.set(this.keys.user(user.id.value), this.toSnapshot(user), TTL_USER),
      this.lookupCache.set(this.keys.userByEmail(user.email.value), user.id.value, TTL_LOOKUP),
      this.lookupCache.set(this.keys.userByNUID(user.nuid.value), user.id.value, TTL_LOOKUP),
    ]);
  }

  async delete(id: UserId): Promise<void> {
    // Read before delete so we know which lookup keys to invalidate
    const user = await this.findById(id);
    await this.db.delete(id);

    const toInvalidate: Promise<void>[] = [
      this.cache.delete(this.keys.user(id.value)),
    ];
    if (user) {
      toInvalidate.push(this.lookupCache.delete(this.keys.userByEmail(user.email.value)));
      toInvalidate.push(this.lookupCache.delete(this.keys.userByNUID(user.nuid.value)));
    }
    await Promise.all(toInvalidate);
  }

  // ── Serialization helpers ─────────────────────────────────────────────────

  private toSnapshot(user: User): UserSnapshot {
    return {
      id:               user.id.value,
      email:            user.email.value,
      nuid:             user.nuid.value,
      firstName:        user.firstName,
      lastName:         user.lastName,
      passwordHash:     user.passwordHash.hash,
      userStatus:       user.userStatus,
      systemRole:       user.systemRole,
      phone:            user.phone,
      secondName:       user.secondName,
      secondLastName:   user.secondLastName,
      birthDate:        user.birthDate?.toISOString() ?? null,
      gender:           user.gender,
      nationality:      user.nationality,
      birthPlace:       user.birthPlace,
      placeOfResidence: user.placeOfResidence,
      occupation:       user.occupation,
      maritalStatus:    user.maritalStatus,
      recoveryPhone:    user.recoveryPhone,
      recoveryEmail:    user.recoveryEmail,
      createdAt:        user.createdAt.toISOString(),
      updatedAt:        user.updatedAt.toISOString(),
      lastLoginAt:      user.lastLoginAt?.toISOString() ?? null,
      tenantMemberships: user.tenantMemberships.map(m => ({
        tenantId: m.tenantId.value,
        role:     m.role.value,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  private fromSnapshot(snap: UserSnapshot): User {
    const tenantMemberships: UserTenantMembership[] = (snap.tenantMemberships ?? []).map(m => ({
      tenantId: TenantId.create(m.tenantId),
      role:     RoleName.create(m.role),
      joinedAt: new Date(m.joinedAt),
    }));

    return new User(
      UserId.create(snap.id),
      Email.createUnsafe(snap.email),
      NUID.create(snap.nuid),
      snap.firstName,
      snap.lastName,
      PasswordHash.createUnsafe(snap.passwordHash),
      snap.userStatus as any,
      snap.systemRole as any,
      snap.phone,
      snap.secondName,
      snap.secondLastName,
      snap.birthDate        ? new Date(snap.birthDate)    : null,
      snap.gender,
      snap.nationality,
      snap.birthPlace,
      snap.placeOfResidence,
      snap.occupation,
      snap.maritalStatus,
      snap.recoveryPhone,
      snap.recoveryEmail,
      [],                  // addresses — not cached, load on demand
      tenantMemberships,   // ← restored from snapshot
      new Date(snap.createdAt),
      new Date(snap.updatedAt),
      snap.lastLoginAt ? new Date(snap.lastLoginAt) : undefined
    );
  }
}
