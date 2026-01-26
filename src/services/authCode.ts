import { v4 as uuidv4 } from 'uuid';
import {
    cleanupExpiredAuthCodes,
    createAuthCode as createAuthCodeRepo,
    deleteAuthCode,
    findAuthCodeByCode,
    markAuthCodeAsUsed,
} from '../repositories/authCodeRepo.prisma';
import { Logger } from '../utils/logger';

/**
 * AuthCode Service
 * Business logic for OAuth2 Authorization Code Flow
 */

const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes

export class AuthCodeService {
  private static instance: AuthCodeService;

  private constructor() {}

  static getInstance(): AuthCodeService {
    if (!AuthCodeService.instance) {
      AuthCodeService.instance = new AuthCodeService();
    }
    return AuthCodeService.instance;
  }

  /**
   * Generate authorization code
   * 
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param appId - Application ID (e.g., 'crm', 'hr', 'admin')
   * @param redirectUri - URI to redirect after exchange
   * @returns Authorization code object
   */
  async generateAuthCode(
    userId: string,
    tenantId: string,
    appId: string,
    redirectUri: string
  ) {
    // Generate random code (UUID format)
    const code = `ac_${uuidv4().replace(/-/g, '')}`;

    // Calculate expiration (5 minutes from now)
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000);

    // Create in database
    await createAuthCodeRepo({
      code,
      user_id: userId,
      tenant_id: tenantId,
      app_id: appId,
      redirect_uri: redirectUri,
      expires_at: expiresAt,
    });

    Logger.info('Authorization code generated', {
      code: code.substring(0, 10) + '...',
      userId,
      tenantId,
      appId,
      expiresAt,
    });

    return code;
  }

  /**
   * Validate authorization code
   * 
   * - Checks if code exists
   * - Validates not expired
   * - Validates not already used
   * - Validates app_id matches
   * - Marks as used (one-time use)
   * 
   * @param code - Authorization code
   * @param appId - Application ID making the request
   * @returns User and tenant information
   * @throws Error if validation fails
   */
  async validateAuthCode(code: string, appId: string) {
    // Find code in database
    const authCode = await findAuthCodeByCode(code);

    if (!authCode) {
      Logger.warn('Authorization code not found', { code: code.substring(0, 10) + '...' });
      throw new Error('INVALID_CODE');
    }

    // Check if already used
    if (authCode.used) {
      Logger.warn('Authorization code already used', { 
        code: code.substring(0, 10) + '...',
        userId: authCode.userId,
      });
      throw new Error('CODE_ALREADY_USED');
    }

    // Check if expired
    if (new Date() > authCode.expiresAt) {
      Logger.warn('Authorization code expired', {
        code: code.substring(0, 10) + '...',
        expiresAt: authCode.expiresAt,
      });
      // Clean up expired code
      await deleteAuthCode(code);
      throw new Error('CODE_EXPIRED');
    }

    // Validate app_id matches
    if (authCode.appId !== appId) {
      Logger.warn('Authorization code app mismatch', {
        code: code.substring(0, 10) + '...',
        expected: authCode.appId,
        received: appId,
      });
      throw new Error('APP_MISMATCH');
    }

    // Mark as used (one-time use enforcement)
    await markAuthCodeAsUsed(code);

    Logger.info('Authorization code validated successfully', {
      code: code.substring(0, 10) + '...',
      userId: authCode.userId,
      tenantId: authCode.tenantId,
      appId,
    });

    // Return user and tenant context
    return {
      valid: true,
      userId: authCode.userId,
      tenantId: authCode.tenantId,
      appId: authCode.appId,
      email: authCode.user.email,
      firstName: authCode.user.firstName,
      lastName: authCode.user.lastName,
      tenant: {
        id: authCode.tenant.id,
        name: authCode.tenant.name,
        slug: authCode.tenant.slug,
      },
    };
  }

  /**
   * Cleanup expired and used codes
   * Should be called periodically (e.g., cron job)
   * 
   * @returns Number of codes deleted
   */
  async cleanupExpiredCodes(): Promise<number> {
    const count = await cleanupExpiredAuthCodes();
    Logger.info(`Cleaned up ${count} expired/used authorization codes`);
    return count;
  }

  /**
   * Revoke authorization code
   * Used if user cancels authorization or for security reasons
   * 
   * @param code - Authorization code to revoke
   */
  async revokeAuthCode(code: string): Promise<void> {
    await deleteAuthCode(code);
    Logger.info('Authorization code revoked', {
      code: code.substring(0, 10) + '...',
    });
  }
}

// Singleton export
export const AuthCode = AuthCodeService.getInstance();

// Schedule cleanup job (every 10 minutes)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await AuthCode.cleanupExpiredCodes();
    } catch (error) {
      Logger.error('Failed to cleanup auth codes', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
}
