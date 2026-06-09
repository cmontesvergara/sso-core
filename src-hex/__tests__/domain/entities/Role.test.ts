import { Role } from '@hex/domain/entities/Role';
import { RoleId } from '@hex/domain/value-objects/Ids';
import { Permission, RoleName } from '@hex/domain/value-objects/RoleName';

describe('Role Entity', () => {
    const now = new Date();

    const createRole = (overrides?: Partial<{
        permissions: Permission[];
        status: 'active' | 'inactive';
        isSystem: boolean;
    }>) => {
        return new Role(
            RoleId.create('role-001'),
            RoleName.create('admin'),
            'Administrator role',
            overrides?.permissions ?? [
                Permission.create('user:read'),
                Permission.create('user:write'),
            ],
            overrides?.isSystem ?? false,
            overrides?.status ?? 'active',
            now,
            now
        );
    };

    it('should create a role with all properties', () => {
        const role = createRole();

        expect(role.id.value).toBe('role-001');
        expect(role.name.value).toBe('admin');
        expect(role.description).toBe('Administrator role');
        expect(role.permissions).toHaveLength(2);
        expect(role.isSystem).toBe(false);
        expect(role.status).toBe('active');
        expect(role.isActive()).toBe(true);
    });

    it('should detect inactive role', () => {
        const role = createRole({ status: 'inactive' });

        expect(role.isActive()).toBe(false);
    });

    it('should check single permission', () => {
        const role = createRole();

        expect(role.hasPermission('user:read')).toBe(true);
        expect(role.hasPermission('user:delete')).toBe(false);
    });

    it('should check all permissions', () => {
        const role = createRole();

        expect(role.hasAllPermissions(['user:read', 'user:write'])).toBe(true);
        expect(role.hasAllPermissions(['user:read', 'user:delete'])).toBe(false);
    });

    it('should check any permission', () => {
        const role = createRole();

        expect(role.hasAnyPermission(['user:read', 'user:delete'])).toBe(true);
        expect(role.hasAnyPermission(['tenant:admin', 'user:delete'])).toBe(false);
    });

    it('should add permission', () => {
        const role = createRole();
        const updated = role.addPermission(Permission.create('tenant:read'));

        expect(updated.permissions).toHaveLength(3);
        expect(updated.hasPermission('tenant:read')).toBe(true);
        expect(role.permissions).toHaveLength(2); // Original unchanged
    });

    it('should not duplicate permission when adding existing', () => {
        const role = createRole();
        const updated = role.addPermission(Permission.create('user:read'));

        expect(updated.permissions).toHaveLength(2);
    });

    it('should remove permission', () => {
        const role = createRole();
        const updated = role.removePermission(Permission.create('user:read'));

        expect(updated.permissions).toHaveLength(1);
        expect(updated.hasPermission('user:read')).toBe(false);
        expect(role.permissions).toHaveLength(2); // Original unchanged
    });

    it('should be immutable', () => {
        const role = createRole();
        expect(() => {
            (role as any)._name = RoleName.create('tampered');
        }).toThrow();
    });
});
