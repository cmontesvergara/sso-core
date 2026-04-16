/**
 * Repository Interfaces
 * Define contracts for data access layer
 *
 * These interfaces enable dependency inversion and testability.
 * Implementations should be in src/core/repositories/
 */

import { User, SSOSession, AppSession, RefreshToken } from '@prisma/client';
import { CreateUserDTO, UpdateUserDTO, ListUsersParams } from '../repositories/user.repository';
import { CreateSSOSessionDTO, CreateAppSessionDTO } from '../repositories/session.repository';
import { SaveRefreshTokenDTO } from '../repositories/refresh-token.repository';

// =============================================================================
// USER REPOSITORY
// =============================================================================
export interface IUserRepository {
  createUser(data: CreateUserDTO): Promise<User>;
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserById(id: string): Promise<User | undefined>;
  updateUser(id: string, data: UpdateUserDTO): Promise<User>;
  updateUserPassword(id: string, newPassword: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  listUsers(params: ListUsersParams): Promise<User[]>;
  countUsers(where?: { email?: string; nuid?: string; userStatus?: string }): Promise<number>;
}

// =============================================================================
// SESSION REPOSITORY
// =============================================================================
export interface ISessionRepository {
  // SSO Sessions
  createSSOSession(data: CreateSSOSessionDTO): Promise<SSOSession>;
  findSSOSessionByToken(token: string): Promise<SSOSession | null>;
  deleteSSOSession(token: string): Promise<void>;
  deleteAllSSOSessionsForUser(userId: string): Promise<number>;
  updateSSOSessionActivity(token: string): Promise<void>;
  extendSSOSession(token: string, newExpiresAt: Date): Promise<void>;
  getActiveSSOSessionsForUser(userId: string): Promise<SSOSession[]>;
  cleanupExpiredSSOSessions(): Promise<number>;

  // App Sessions
  createAppSession(data: CreateAppSessionDTO): Promise<AppSession>;
  findAppSessionByToken(token: string): Promise<AppSession | null>;
  deleteAppSession(token: string): Promise<void>;
  deleteAllAppSessionsForUser(userId: string): Promise<number>;
  updateAppSessionActivity(token: string): Promise<void>;
  extendAppSession(token: string, newExpiresAt: Date): Promise<void>;
  getActiveAppSessionsForUser(userId: string): Promise<AppSession[]>;
  cleanupExpiredAppSessions(): Promise<number>;
}

// =============================================================================
// REFRESH TOKEN REPOSITORY
// =============================================================================
export interface IRefreshTokenRepository {
  saveRefreshToken(data: SaveRefreshTokenDTO): Promise<RefreshToken>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshTokenById(id: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
}

// =============================================================================
// TENANT REPOSITORY
// =============================================================================
export interface ITenantRepository {
  createTenant(data: { name: string; slug: string; description?: string | null }): Promise<any>;
  findTenantById(id: string): Promise<any | null>;
  findTenantBySlug(slug: string): Promise<any | null>;
  findTenantByName(name: string): Promise<any | null>;
  listTenants(params?: { skip?: number; take?: number }): Promise<any[]>;
  updateTenant(id: string, data: any): Promise<any>;
  deleteTenant(id: string): Promise<void>;
}

// =============================================================================
// TENANT MEMBER REPOSITORY
// =============================================================================
export interface ITenantMemberRepository {
  addTenantMember(data: { tenantId: string; userId: string; role: string }): Promise<any>;
  findTenantMember(tenantId: string, userId: string): Promise<any | null>;
  listTenantMembers(tenantId: string): Promise<any[]>;
  listUserTenants(userId: string): Promise<any[]>;
  updateTenantMemberRole(tenantId: string, userId: string, role: string): Promise<any>;
  removeTenantMember(tenantId: string, userId: string): Promise<void>;
}

// =============================================================================
// ROLE REPOSITORY
// =============================================================================
export interface IRoleRepository {
  createRole(data: { name: string; tenantId: string; description?: string | null }): Promise<any>;
  findRoleById(id: string): Promise<any | null>;
  findRoleByTenantAndName(tenantId: string, name: string): Promise<any | null>;
  listRolesByTenant(tenantId: string): Promise<any[]>;
  updateRole(id: string, data: any): Promise<any>;
  deleteRole(id: string): Promise<void>;
}

// =============================================================================
// PERMISSION REPOSITORY
// =============================================================================
export interface IPermissionRepository {
  createPermission(data: { roleId: string; resource: string; action: string }): Promise<any>;
  findPermissionById(id: string): Promise<any | null>;
  listPermissionsByRole(roleId: string): Promise<any[]>;
  deletePermission(id: string): Promise<void>;
  hasPermission(roleId: string, resource: string, action: string): Promise<boolean>;
}

// =============================================================================
// ADDRESS REPOSITORY
// =============================================================================
export interface IAddressRepository {
  createAddress(data: { userId: string; country: string; province: string; city: string; detail: string; postalCode?: string | null }): Promise<any>;
  findAddressesByUserId(userId: string): Promise<any[]>;
  findAddressById(id: string): Promise<any | null>;
  updateAddress(id: string, data: any): Promise<any>;
  deleteAddress(id: string): Promise<void>;
}

// =============================================================================
// OTP SECRET REPOSITORY
// =============================================================================
export interface IOTPSecretRepository {
  findOTPSecretByUserId(userId: string): Promise<any | null>;
  saveOTPSecret(userId: string, secret: string, backupCodes: string[], verified?: boolean): Promise<any>;
  updateOTPSecretVerification(userId: string, verified: boolean): Promise<void>;
  updateBackupCodes(userId: string, codes: string[]): Promise<void>;
  deleteOTPSecret(userId: string): Promise<void>;
}

// =============================================================================
// EMAIL VERIFICATION REPOSITORY
// =============================================================================
export interface IEmailVerificationRepository {
  findEmailVerificationByToken(token: string): Promise<any | null>;
  findEmailVerificationByUserId(userId: string): Promise<any[]>;
  saveEmailVerification(userId: string, email: string, token: string, expiresAt: Date): Promise<any>;
  markEmailVerificationAsVerified(token: string): Promise<any>;
  deleteEmailVerification(token: string): Promise<void>;
  deleteExpiredEmailVerifications(): Promise<number>;
}

// =============================================================================
// OTHER INFORMATION REPOSITORY
// =============================================================================
export interface IOtherInformationRepository {
  createOtherInformation(data: { userId: string; type: string; value: any }): Promise<any>;
  findOtherInformationByUserId(userId: string): Promise<any | null>;
  updateOtherInformation(userId: string, data: any): Promise<any>;
  deleteOtherInformation(userId: string): Promise<void>;
}
