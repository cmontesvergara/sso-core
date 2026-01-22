/**
 * Service Interfaces
 * Define contracts for business logic layer
 * Note: Using 'unknown' for flexibility - implementations should use specific types
 */

// Authentication Service Interface
export interface IAuthenticationService {
  signup(input: unknown): Promise<unknown>;
  signin(input: unknown): Promise<unknown>;
  signout(input: unknown): Promise<void>;
  refresh(refreshToken: string): Promise<unknown>;
}

// User Service Interface
export interface IUserService {
  getUserById(id: string): Promise<unknown>;
  getUserByEmail(email: string): Promise<unknown>;
  updateUser(id: string, data: unknown): Promise<unknown>;
  deleteUser(id: string): Promise<void>;
  listUsers(params: unknown): Promise<unknown>;
}

// Tenant Service Interface
export interface ITenantService {
  createTenant(data: unknown): Promise<unknown>;
  getTenantById(id: string): Promise<unknown>;
  getTenantBySlug(slug: string): Promise<unknown>;
  updateTenant(id: string, data: unknown): Promise<unknown>;
  deleteTenant(id: string): Promise<void>;
  addMember(tenantId: string, userId: string, role: string): Promise<unknown>;
  removeMember(tenantId: string, userId: string): Promise<void>;
  updateMemberRole(tenantId: string, userId: string, role: string): Promise<unknown>;
}

// OTP Service Interface
export interface IOTPService {
  generateSecret(userId: string): Promise<unknown>;
  verifyToken(userId: string, token: string): Promise<boolean>;
  enableOTP(userId: string, token: string): Promise<void>;
  disableOTP(userId: string): Promise<void>;
}

// Email Service Interface
export interface IEmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
  sendWelcomeEmail(email: string, name: string): Promise<void>;
}
