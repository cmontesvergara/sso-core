import { UserCachedRepository } from '@hex/infrastructure/persistence/cached/UserCachedRepository';
import { User } from '@hex/domain/entities/User';
import { UserId } from '@hex/domain/value-objects/UserId';
import { Email } from '@hex/domain/value-objects/Email';
import { NUID } from '@hex/domain/value-objects/NUID';
import { PasswordHash } from '@hex/domain/value-objects/PasswordHash';
import { TenantId } from '@hex/domain/value-objects/TenantId';
import { RedisKeyFactory } from '@hex/infrastructure/persistence/redis/RedisKeyFactoryService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<{ id: string; email: string; nuid: string }> = {}): User {
  return new User(
    UserId.create(overrides.id ?? 'user-001'),
    Email.createUnsafe(overrides.email ?? 'carlos@bigso.co'),
    NUID.create(overrides.nuid ?? 'N123456'),
    'Carlos', 'Montes',
    PasswordHash.createUnsafe('$argon2id$hashed'),
    'active', 'user', '',
    null, null, null, null, null, null, null, null, null, null, null,
    [], [],
    new Date('2024-01-01'), new Date('2024-06-01'), undefined
  );
}

function makeCacheMock() {
  return {
    get:     jest.fn().mockResolvedValue(null),
    set:     jest.fn().mockResolvedValue(undefined),
    delete:  jest.fn().mockResolvedValue(undefined),
    exists:  jest.fn().mockResolvedValue(false),
    getMany: jest.fn().mockResolvedValue(new Map()),
    setMany: jest.fn().mockResolvedValue(undefined),
  };
}

function makeDbMock() {
  return {
    findById:       jest.fn().mockResolvedValue(null),
    findByEmail:    jest.fn().mockResolvedValue(null),
    findByNUID:     jest.fn().mockResolvedValue(null),
    findByTenant:   jest.fn().mockResolvedValue([]),
    save:           jest.fn().mockResolvedValue(undefined),
    update:         jest.fn().mockResolvedValue(undefined),
    delete:         jest.fn().mockResolvedValue(undefined),
    existsByEmail:  jest.fn().mockResolvedValue(false),
    existsByNUID:   jest.fn().mockResolvedValue(false),
    countByTenant:  jest.fn().mockResolvedValue(0),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('UserCachedRepository', () => {
  let db: ReturnType<typeof makeDbMock>;
  let snapshotCache: ReturnType<typeof makeCacheMock>;
  let lookupCache: ReturnType<typeof makeCacheMock>;
  let listCache: ReturnType<typeof makeCacheMock>;
  let keys: RedisKeyFactory;
  let repo: UserCachedRepository;
  let user: User;

  beforeEach(() => {
    db           = makeDbMock();
    snapshotCache = makeCacheMock();
    lookupCache   = makeCacheMock();
    listCache     = makeCacheMock();
    keys          = new RedisKeyFactory();
    repo          = new UserCachedRepository(db as any, snapshotCache as any, lookupCache as any, listCache as any, keys);
    user          = makeUser();
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('cache hit — returns user WITHOUT calling DB', async () => {
      // Simulate a warm cache by returning a snapshot
      const snap = {
        id: 'user-001', email: 'carlos@bigso.co', nuid: 'N123456',
        firstName: 'Carlos', lastName: 'Montes',
        passwordHash: '$argon2id$hashed', userStatus: 'active', systemRole: 'user',
        phone: '', secondName: null, secondLastName: null, birthDate: null,
        gender: null, nationality: null, birthPlace: null, placeOfResidence: null,
        occupation: null, maritalStatus: null, recoveryPhone: null, recoveryEmail: null,
        createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-06-01T00:00:00.000Z',
        lastLoginAt: null,
      };
      snapshotCache.get.mockResolvedValue(snap);

      const result = await repo.findById(UserId.create('user-001'));

      expect(result).not.toBeNull();
      expect(result!.email.value).toBe('carlos@bigso.co');
      expect(db.findById).not.toHaveBeenCalled();
    });

    it('cache miss — calls DB and writes to cache', async () => {
      db.findById.mockResolvedValue(user);

      const result = await repo.findById(UserId.create('user-001'));

      expect(db.findById).toHaveBeenCalledTimes(1);
      expect(snapshotCache.set).toHaveBeenCalledWith(
        keys.user('user-001'),
        expect.objectContaining({ id: 'user-001', email: 'carlos@bigso.co' }),
        expect.any(Number)
      );
      expect(result!.id.value).toBe('user-001');
    });

    it('cache miss and DB miss — returns null, does NOT write cache', async () => {
      const result = await repo.findById(UserId.create('ghost-id'));

      expect(result).toBeNull();
      expect(snapshotCache.set).not.toHaveBeenCalled();
    });
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('full cache hit — lookup key exists, snapshot exists — does NOT call DB', async () => {
      lookupCache.get.mockResolvedValue('user-001');
      snapshotCache.get.mockResolvedValue({
        id: 'user-001', email: 'carlos@bigso.co', nuid: 'N123456',
        firstName: 'Carlos', lastName: 'Montes',
        passwordHash: '$argon2id$hashed', userStatus: 'active', systemRole: 'user',
        phone: '', secondName: null, secondLastName: null, birthDate: null,
        gender: null, nationality: null, birthPlace: null, placeOfResidence: null,
        occupation: null, maritalStatus: null, recoveryPhone: null, recoveryEmail: null,
        createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-06-01T00:00:00.000Z',
        lastLoginAt: null,
      });

      const result = await repo.findByEmail(Email.createUnsafe('carlos@bigso.co'));

      expect(db.findByEmail).not.toHaveBeenCalled();
      expect(result!.email.value).toBe('carlos@bigso.co');
    });

    it('cache miss — calls DB, writes snapshot + lookup key', async () => {
      db.findByEmail.mockResolvedValue(user);

      await repo.findByEmail(Email.createUnsafe('carlos@bigso.co'));

      expect(db.findByEmail).toHaveBeenCalledTimes(1);
      expect(snapshotCache.set).toHaveBeenCalledWith(
        keys.user('user-001'), expect.any(Object), expect.any(Number)
      );
      expect(lookupCache.set).toHaveBeenCalledWith(
        keys.userByEmail('carlos@bigso.co'), 'user-001', expect.any(Number)
      );
    });
  });

  // ── findByNUID ────────────────────────────────────────────────────────────

  describe('findByNUID', () => {
    it('cache miss — calls DB, writes snapshot + nuid lookup key', async () => {
      db.findByNUID.mockResolvedValue(user);

      await repo.findByNUID(NUID.create('N123456'));

      expect(db.findByNUID).toHaveBeenCalledTimes(1);
      expect(lookupCache.set).toHaveBeenCalledWith(
        keys.userByNUID('N123456'), 'user-001', expect.any(Number)
      );
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('delegates to DB and writes snapshot + both lookup keys', async () => {
      await repo.save(user);

      expect(db.save).toHaveBeenCalledWith(user);
      expect(snapshotCache.set).toHaveBeenCalledWith(keys.user('user-001'), expect.any(Object), expect.any(Number));
      expect(lookupCache.set).toHaveBeenCalledWith(keys.userByEmail('carlos@bigso.co'), 'user-001', expect.any(Number));
      expect(lookupCache.set).toHaveBeenCalledWith(keys.userByNUID('N123456'), 'user-001', expect.any(Number));
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to DB, invalidates stale keys, then re-populates cache', async () => {
      await repo.update(user);

      expect(db.update).toHaveBeenCalledWith(user);

      // Invalidation
      expect(snapshotCache.delete).toHaveBeenCalledWith(keys.user('user-001'));
      expect(lookupCache.delete).toHaveBeenCalledWith(keys.userByEmail('carlos@bigso.co'));
      expect(lookupCache.delete).toHaveBeenCalledWith(keys.userByNUID('N123456'));

      // Re-population
      expect(snapshotCache.set).toHaveBeenCalledWith(keys.user('user-001'), expect.any(Object), expect.any(Number));
      expect(lookupCache.set).toHaveBeenCalledWith(keys.userByEmail('carlos@bigso.co'), 'user-001', expect.any(Number));
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('reads user first (to get email/nuid), then deletes from DB and invalidates cache', async () => {
      snapshotCache.get.mockResolvedValue({
        id: 'user-001', email: 'carlos@bigso.co', nuid: 'N123456',
        firstName: 'Carlos', lastName: 'Montes',
        passwordHash: '$argon2id$hashed', userStatus: 'active', systemRole: 'user',
        phone: '', secondName: null, secondLastName: null, birthDate: null,
        gender: null, nationality: null, birthPlace: null, placeOfResidence: null,
        occupation: null, maritalStatus: null, recoveryPhone: null, recoveryEmail: null,
        createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-06-01T00:00:00.000Z',
        lastLoginAt: null,
      });

      await repo.delete(UserId.create('user-001'));

      expect(db.delete).toHaveBeenCalledWith(UserId.create('user-001'));
      expect(snapshotCache.delete).toHaveBeenCalledWith(keys.user('user-001'));
      expect(lookupCache.delete).toHaveBeenCalledWith(keys.userByEmail('carlos@bigso.co'));
      expect(lookupCache.delete).toHaveBeenCalledWith(keys.userByNUID('N123456'));
    });
  });

  // ── existsByEmail ─────────────────────────────────────────────────────────

  describe('existsByEmail', () => {
    it('returns true from cache without calling DB', async () => {
      lookupCache.exists.mockResolvedValue(true);

      const result = await repo.existsByEmail(Email.createUnsafe('carlos@bigso.co'));

      expect(result).toBe(true);
      expect(db.existsByEmail).not.toHaveBeenCalled();
    });

    it('falls back to DB on cache miss', async () => {
      db.existsByEmail.mockResolvedValue(true);

      const result = await repo.existsByEmail(Email.createUnsafe('new@bigso.co'));

      expect(db.existsByEmail).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  // ── countByTenant ─────────────────────────────────────────────────────────

  describe('countByTenant', () => {
    it('always delegates to DB — count is not cached', async () => {
      db.countByTenant.mockResolvedValue(5);

      const result = await repo.countByTenant(TenantId.create('tenant-abc'));

      expect(db.countByTenant).toHaveBeenCalledTimes(1);
      expect(result).toBe(5);
    });
  });

  // ── RedisKeyFactory keys ──────────────────────────────────────────────────

  describe('RedisKeyFactory', () => {
    it('generates correct keys', () => {
      const k = new RedisKeyFactory();
      // NODE_ENV=test in jest, APP_NAME not set → prefix = 'sso:test'
      expect(k.user('u1')).toBe('sso:test:iam:user:by-id:u1:v0');
      expect(k.userByEmail('Test@BIGSO.co')).toBe('sso:test:iam:user:by-email:test@bigso.co:v0'); // lowercase
      expect(k.userByNUID('N99')).toBe('sso:test:iam:user:by-nuid:N99:v0');
      expect(k.usersByTenant('t1')).toBe('sso:test:iam:user:by-tenant:t1:v0');
    });
  });
});
