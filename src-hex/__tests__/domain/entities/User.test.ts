import { User } from '../../../../src-hex/domain/entities/User';
import { UserId } from '../../../../src-hex/domain/value-objects/UserId';
import { Email } from '../../../../src-hex/domain/value-objects/Email';
import { NUID } from '../../../../src-hex/domain/value-objects/NUID';
import { PasswordHash } from '../../../../src-hex/domain/value-objects/PasswordHash';
import { TenantId } from '../../../../src-hex/domain/value-objects/TenantId';

function makeUser(overrides: Partial<{
  status: string;
  systemRole: string;
}> = {}): User {
  return new User(
    UserId.create('user-001'),
    Email.createUnsafe('juan@bigso.co'),
    NUID.create('N000001'),
    'Juan',
    'Pérez',
    PasswordHash.createUnsafe('$argon2id$hash'),
    (overrides.status ?? 'active') as any,
    overrides.systemRole ?? 'user',
    '3001234567',
    null, null, null, null, null, null, null, null, null,
    null, null,
    [], [],
    new Date('2024-01-01'),
    new Date('2024-01-01')
  );
}

describe('User Entity', () => {
  describe('isActive()', () => {
    it('returns true when status is active', () => {
      expect(makeUser({ status: 'active' }).isActive()).toBe(true);
    });

    it('returns false when status is inactive', () => {
      expect(makeUser({ status: 'inactive' }).isActive()).toBe(false);
    });

    it('returns false when status is pending', () => {
      expect(makeUser({ status: 'pending' }).isActive()).toBe(false);
    });
  });

  describe('withProfile()', () => {
    it('returns a new User with patched firstName and lastName', () => {
      const user = makeUser();
      const updated = user.withProfile({ firstName: 'Carlos', lastName: 'López' });

      expect(updated.firstName).toBe('Carlos');
      expect(updated.lastName).toBe('López');
      expect(updated).not.toBe(user);
    });

    it('preserves fields not included in the patch', () => {
      const user = makeUser();
      const updated = user.withProfile({ firstName: 'Ana' });

      expect(updated.lastName).toBe('Pérez');   // unchanged
      expect(updated.email.value).toBe('juan@bigso.co');
      expect(updated.systemRole).toBe('user');
    });

    it('allows setting nullable fields to null explicitly', () => {
      const user = makeUser();
      const updated = user.withProfile({ gender: null, birthDate: null });

      expect(updated.gender).toBeNull();
      expect(updated.birthDate).toBeNull();
    });

    it('updates recoveryEmail and recoveryPhone', () => {
      const user = makeUser();
      const updated = user.withProfile({
        recoveryEmail: 'backup@bigso.co',
        recoveryPhone: '+573001234567',
      });

      expect(updated.recoveryEmail).toBe('backup@bigso.co');
      expect(updated.recoveryPhone).toBe('+573001234567');
    });

    it('does not modify original user (immutability)', () => {
      const user = makeUser();
      user.withProfile({ firstName: 'Mutated' });

      expect(user.firstName).toBe('Juan');  // original untouched
    });

    it('returns a new User with updatedAt refreshed', () => {
      const user = makeUser();
      const before = user.updatedAt;
      const updated = user.withProfile({ phone: '3109876543' });

      // updatedAt should be >= original
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('withAddress()', () => {
    it('returns a new User instance with updated status', () => {
      const user = makeUser({ status: 'pending' });
      const activated = user.withStatus('active');

      expect(activated.userStatus).toBe('active');
      expect(activated).not.toBe(user); // immutability
    });

    it('preserves all other fields', () => {
      const user = makeUser();
      const updated = user.withStatus('suspended');

      expect(updated.firstName).toBe('Juan');
      expect(updated.email.value).toBe('juan@bigso.co');
      expect(updated.systemRole).toBe('user');
    });
  });

  describe('withPasswordHash()', () => {
    it('returns a new User with updated passwordHash', () => {
      const user = makeUser();
      const newHash = PasswordHash.createUnsafe('$argon2id$newhash');
      const updated = user.withPasswordHash(newHash);

      expect(updated.passwordHash.hash).toBe('$argon2id$newhash');
      expect(updated).not.toBe(user);
    });
  });

  describe('withLastLogin()', () => {
    it('sets a new lastLoginAt date', () => {
      const user = makeUser();
      const loginTime = new Date('2024-06-01T10:00:00Z');
      const updated = user.withLastLogin(loginTime);

      expect(updated.lastLoginAt?.toISOString()).toBe(loginTime.toISOString());
    });
  });

  describe('canAccessTenant()', () => {
    it('returns false when user has no memberships', () => {
      const user = makeUser();
      expect(user.canAccessTenant(TenantId.create('tenant-99'))).toBe(false);
    });
  });

  describe('withTenantMembership()', () => {
    const tid = TenantId.create('tenant-001');

    function makeMembership(tenantId: TenantId, role: string) {
      return { tenantId, role: { value: role } as any, joinedAt: new Date() };
    }

    it('adds a membership when user has none', () => {
      const user = makeUser();
      const updated = user.withTenantMembership(makeMembership(tid, 'admin'));

      expect(updated.tenantMemberships).toHaveLength(1);
      expect(updated.tenantMemberships[0].tenantId.value).toBe('tenant-001');
    });

    it('returns a new User instance (immutability)', () => {
      const user = makeUser();
      const updated = user.withTenantMembership(makeMembership(tid, 'admin'));

      expect(updated).not.toBe(user);
      expect(user.tenantMemberships).toHaveLength(0); // original unchanged
    });

    it('replaces existing membership for the same tenant (no duplicates)', () => {
      const user = makeUser();
      const withFirst  = user.withTenantMembership(makeMembership(tid, 'member'));
      const withSecond = withFirst.withTenantMembership(makeMembership(tid, 'admin'));

      expect(withSecond.tenantMemberships).toHaveLength(1);
      expect(withSecond.tenantMemberships[0].role.value).toBe('admin');
    });

    it('preserves other tenant memberships when adding a new one', () => {
      const tid2 = TenantId.create('tenant-002');
      const user = makeUser();
      const withFirst  = user.withTenantMembership(makeMembership(tid, 'member'));
      const withBoth   = withFirst.withTenantMembership(makeMembership(tid2, 'viewer'));

      expect(withBoth.tenantMemberships).toHaveLength(2);
    });
  });

  describe('withoutTenantMembership()', () => {
    const tid = TenantId.create('tenant-001');

    it('removes a membership from the user', () => {
      const user = makeUser();
      const withMembership = user.withTenantMembership({
        tenantId: tid,
        role: { value: 'admin' } as any,
        joinedAt: new Date(),
      });
      const removed = withMembership.withoutTenantMembership(tid);

      expect(removed.tenantMemberships).toHaveLength(0);
    });

    it('is a no-op when user has no membership for that tenant', () => {
      const user = makeUser();
      const unchanged = user.withoutTenantMembership(tid);

      expect(unchanged.tenantMemberships).toHaveLength(0);
      expect(unchanged).not.toBe(user); // still returns a new instance
    });

    it('only removes the target tenant, preserving others', () => {
      const tid2 = TenantId.create('tenant-002');
      const user = makeUser()
        .withTenantMembership({ tenantId: tid,  role: { value: 'admin'  } as any, joinedAt: new Date() })
        .withTenantMembership({ tenantId: tid2, role: { value: 'viewer' } as any, joinedAt: new Date() });

      const removed = user.withoutTenantMembership(tid);

      expect(removed.tenantMemberships).toHaveLength(1);
      expect(removed.tenantMemberships[0].tenantId.value).toBe('tenant-002');
    });
  });

  describe('systemRole', () => {
    it('exposes systemRole getter', () => {
      const user = makeUser({ systemRole: 'superadmin' });
      expect(user.systemRole).toBe('superadmin');
    });

    it('defaults to user role', () => {
      const user = makeUser();
      expect(user.systemRole).toBe('user');
    });
  });

  describe('immutability', () => {
    it('is frozen after construction', () => {
      const user = makeUser();
      expect(Object.isFrozen(user)).toBe(true);
    });
  });
});
