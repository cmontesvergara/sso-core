import { PermissionData, TenantMembershipData, UserContextData } from '../../dto/output/LoginResult';

/**
 * IQueryRepository
 *
 * Port for complex read/write operations that don't fit the standard
 * repository pattern but still need to be abstracted from the application layer.
 *
 * This is a pragmatic compromise: the application layer needs to orchestrate
 * multi-table queries and atomic writes, but shouldn't depend on Prisma directly.
 *
 * Implementations live in infrastructure/persistence/prisma/.
 */
export interface IQueryRepository {
    /**
     * Find a user by ID with basic fields needed for auth responses.
     */
    findUserById(userId: string): Promise<UserContextData | null>;

    /**
     * Find the first tenant membership for a user, optionally filtered by app.
     * Used to resolve the default tenant during refresh token rotation.
     */
    findFirstTenantMembership(
        userId: string,
        appId?: string
    ): Promise<{ tenantId: string; role: string } | null>;

    /**
     * Find all tenant memberships for a user, optionally filtered by app.
     */
    findTenantMemberships(
        userId: string,
        appId?: string
    ): Promise<TenantMembershipData[]>;

    /**
     * Find role permissions for a given tenant + role name + app.
     */
    findRolePermissions(
        tenantId: string,
        roleName: string,
        appId: string
    ): Promise<PermissionData[]>;

    /**
     * Find an application by its appId (public identifier).
     */
    findApplicationByAppId(appId: string): Promise<{
        id: string;
        audience?: string | null;
        url?: string | null;
        backendUrl?: string | null;
    } | null>;

    /**
     * Upsert a tenant member (create if not exists, update role if exists).
     */
    upsertTenantMember(
        tenantId: string,
        userId: string,
        role: string
    ): Promise<void>;

    /**
     * Update the role of an existing tenant member.
     */
    updateTenantMemberRole(
        tenantId: string,
        userId: string,
        role: string
    ): Promise<void>;
}
