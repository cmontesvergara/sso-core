/**
 * Repository Interfaces
 * Define contracts for data access layer
 * Note: Using 'unknown' for flexibility - implementations should use specific types
 */

// User Repository Interface
export interface IUserRepository {
  createUser(data: unknown): Promise<unknown>;
  findUserByEmail(email: string): Promise<unknown | undefined>;
  findUserById(id: string): Promise<unknown | undefined>;
  updateUser(id: string, data: unknown): Promise<unknown>;
  updateUserPassword(id: string, newPassword: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  listUsers(params: { skip?: number; take?: number; where?: unknown }): Promise<unknown[]>;
  countUsers(where?: unknown): Promise<number>;
}

// Address Repository Interface
export interface IAddressRepository {
  createAddress(data: unknown): Promise<unknown>;
  findAddressesByUserId(userId: string): Promise<unknown[]>;
  findAddressById(id: string): Promise<unknown | null>;
  updateAddress(id: string, data: unknown): Promise<unknown>;
  deleteAddress(id: string): Promise<void>;
}

// Tenant Repository Interface
export interface ITenantRepository {
  createTenant(data: unknown): Promise<unknown>;
  findTenantById(id: string): Promise<unknown | null>;
  findTenantBySlug(slug: string): Promise<unknown | null>;
  findTenantByName(name: string): Promise<unknown | null>;
  listTenants(params?: { skip?: number; take?: number }): Promise<unknown[]>;
  updateTenant(id: string, data: unknown): Promise<unknown>;
  deleteTenant(id: string): Promise<void>;
}

// Tenant Member Repository Interface
export interface ITenantMemberRepository {
  addTenantMember(data: unknown): Promise<unknown>;
  findTenantMember(tenantId: string, userId: string): Promise<unknown | null>;
  listTenantMembers(tenantId: string): Promise<unknown[]>;
  listUserTenants(userId: string): Promise<unknown[]>;
  updateTenantMemberRole(tenantId: string, userId: string, role: string): Promise<unknown>;
  removeTenantMember(tenantId: string, userId: string): Promise<void>;
}

// Role Repository Interface
export interface IRoleRepository {
  createRole(data: unknown): Promise<unknown>;
  findRoleById(id: string): Promise<unknown | null>;
  findRoleByTenantAndName(tenantId: string, name: string): Promise<unknown | null>;
  listRolesByTenant(tenantId: string): Promise<unknown[]>;
  updateRole(id: string, data: unknown): Promise<unknown>;
  deleteRole(id: string): Promise<void>;
}

// Permission Repository Interface
export interface IPermissionRepository {
  createPermission(data: unknown): Promise<unknown>;
  findPermissionById(id: string): Promise<unknown | null>;
  listPermissionsByRole(roleId: string): Promise<unknown[]>;
  deletePermission(id: string): Promise<void>;
  hasPermission(roleId: string, resource: string, action: string): Promise<boolean>;
}

// Refresh Token Repository Interface
export interface IRefreshTokenRepository {
  saveRefreshToken(params: unknown): Promise<unknown>;
  findRefreshTokenByHash(tokenHash: string): Promise<unknown | null>;
  revokeRefreshTokenById(id: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
}

// OTP Secret Repository Interface
export interface IOTPSecretRepository {
  findOTPSecretByUserId(userId: string): Promise<unknown | null>;
  saveOTPSecret(
    userId: string,
    secret: string,
    backupCodes: string[],
    verified?: boolean
  ): Promise<unknown>;
  updateOTPSecretVerification(userId: string, verified: boolean): Promise<void>;
  updateBackupCodes(userId: string, codes: string[]): Promise<void>;
  deleteOTPSecret(userId: string): Promise<void>;
}

// Email Verification Repository Interface
export interface IEmailVerificationRepository {
  findEmailVerificationByToken(token: string): Promise<unknown | null>;
  findEmailVerificationByUserId(userId: string): Promise<unknown[]>;
  saveEmailVerification(
    userId: string,
    email: string,
    token: string,
    expiresAt: Date
  ): Promise<unknown>;
  markEmailVerificationAsVerified(token: string): Promise<unknown>;
  deleteEmailVerification(token: string): Promise<void>;
  deleteExpiredEmailVerifications(): Promise<number>;
}

// Other Information Repository Interface
export interface IOtherInformationRepository {
  createOtherInformation(data: unknown): Promise<unknown>;
  findOtherInformationByUserId(userId: string): Promise<unknown | null>;
  updateOtherInformation(userId: string, data: unknown): Promise<unknown>;
  deleteOtherInformation(userId: string): Promise<void>;
}
