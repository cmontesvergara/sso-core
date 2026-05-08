import { User } from '../entities/User';
import { PasswordHash } from '../value-objects/PasswordHash';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { TenantAccessDeniedError } from '../errors/TenantAccessDeniedError';
import { TenantId } from '../value-objects/TenantId';

/**
 * IPasswordHasher
 * Interface for password hashing (to be implemented in infrastructure)
 */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hashedPassword: string): Promise<boolean>;
}

/**
 * AuthenticationService
 * Domain service for authentication logic
 * Pure business logic, no external dependencies
 */
export class AuthenticationService {
  constructor(private passwordHasher: IPasswordHasher) {}

  /**
   * Verify user credentials
   * @throws InvalidCredentialsError if verification fails
   */
  async verifyCredentials(user: User, plainPassword: string): Promise<boolean> {
    if (!user.isActive()) {
      throw new InvalidCredentialsError('Account is not active');
    }

    const isValid = await this.passwordHasher.verify(plainPassword, user.passwordHash.hash);

    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    return true;
  }

  /**
   * Check if user can access a tenant
   * @throws TenantAccessDeniedError if access is denied
   */
  ensureTenantAccess(user: User, tenantId: TenantId): void {
    if (!user.canAccessTenant(tenantId)) {
      throw new TenantAccessDeniedError(user.id.value, tenantId.value);
    }
  }

  /**
   * Hash a new password
   */
  async hashPassword(plainPassword: string): Promise<PasswordHash> {
    const hash = await this.passwordHasher.hash(plainPassword);
    return PasswordHash.createUnsafe(hash);
  }

  /**
   * Verify password meets complexity requirements
   * Returns validation result instead of throwing
   */
  validatePasswordComplexity(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
