// Mock dependencies BEFORE importing modules that depend on them
jest.mock('argon2');
jest.mock('../../repositories/userRepo.prisma');
jest.mock('../sessionV2');
jest.mock('../otp');
jest.mock('../auditLog');
jest.mock('../jwt');

// Set required environment variable before importing modules that depend on it
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper-for-unit-tests-only';

import argon2 from 'argon2';
import { AuthServiceV2 } from '../authV2';
import { findUserByEmail, findUserByNuid } from '../../repositories/userRepo.prisma';
import { SessionV2 } from '../sessionV2';
import { OTP } from '../otp';
import { AuditLog } from '../auditLog';
import { JWT } from '../jwt';

// Setup argon2 mock to return true for valid password tests
const mockArgon2Verify = argon2.verify as jest.Mock;

describe('AuthServiceV2', () => {
  const authV2Service = new AuthServiceV2();

  const mockFindUserByEmail = findUserByEmail as jest.Mock;
  const mockFindUserByNuid = findUserByNuid as jest.Mock;
  const mockCreateSsoSession = SessionV2.createSsoSession as jest.Mock;
  const mockIsOTPEnabled = OTP.isOTPEnabled as jest.Mock;
  const mockLogLogin = AuditLog.logLogin as jest.Mock;
  const mockGenerateTwoFactorToken = JWT.generateTwoFactorToken as jest.Mock;

  const mockUser = {
    id: 'user-123',
    email: 'test@bigso.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc123$xyz789',
    firstName: 'Test',
    lastName: 'User',
    systemRole: 'user' as const,
    userStatus: 'active' as const,
    nuid: '123456789',
    phone: '+1234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: password is valid
    mockArgon2Verify.mockResolvedValue(true);
  });

  describe('login', () => {
    const loginOptions = {
      email: 'test@bigso.com',
      password: 'SecurePass123!',
      appId: 'app-123',
      tenantId: 'tenant-456',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should login successfully with email', async () => {
      // Setup
      mockFindUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockCreateSsoSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        refreshToken: 'refresh_token_xyz789',
        jti: 'session-999',
      });

      // Execute
      const result = await authV2Service.login(loginOptions);

      // Verify
      expect(mockFindUserByEmail).toHaveBeenCalledWith('test@bigso.com');
      expect(result.ssoToken).toBe('sso_token_abc123');
      expect(result.user).toEqual({
        userId: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        systemRole: mockUser.systemRole,
      });
      expect(mockLogLogin).toHaveBeenCalledWith(mockUser.id, '192.168.1.1', 'Mozilla/5.0');
    });

    it('should login successfully with NUID', async () => {
      // Setup
      mockFindUserByNuid.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockCreateSsoSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        refreshToken: 'refresh_token_xyz789',
        jti: 'session-999',
      });

      // Execute
      const result = await authV2Service.login({
        ...loginOptions,
        email: undefined,
        nuid: mockUser.nuid,
      });

      // Verify
      expect(mockFindUserByNuid).toHaveBeenCalledWith(mockUser.nuid);
      expect(result.ssoToken).toBe('sso_token_abc123');
    });

    it('should throw 401 when user not found by email', async () => {
      // Setup
      mockFindUserByEmail.mockResolvedValue(null);

      // Execute & Verify
      await expect(authV2Service.login(loginOptions)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw 401 when user not found by NUID', async () => {
      // Setup
      mockFindUserByNuid.mockResolvedValue(null);

      // Execute & Verify
      await expect(
        authV2Service.login({
          ...loginOptions,
          email: undefined,
          nuid: mockUser.nuid,
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw 400 when neither email nor NUID provided', async () => {
      // Execute & Verify
      await expect(
        authV2Service.login({
          password: 'SecurePass123!',
          appId: 'app-123',
          tenantId: 'tenant-456',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Email or NUID required',
        code: 'INVALID_INPUT',
      });
    });

    it('should throw 401 when password is invalid', async () => {
      // Setup - argon2.verify will return false for invalid password
      mockFindUserByEmail.mockResolvedValue(mockUser);
      mockArgon2Verify.mockResolvedValue(false);

      // Execute & Verify
      await expect(authV2Service.login(loginOptions)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw 403 when user status is not active', async () => {
      // Setup
      const inactiveUser = { ...mockUser, userStatus: 'suspended' };
      mockFindUserByEmail.mockResolvedValue(inactiveUser);

      // Execute & Verify
      await expect(authV2Service.login(loginOptions)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not active',
        code: 'ACCOUNT_NOT_ACTIVE',
      });
    });

    it('should return tempToken when 2FA is enabled', async () => {
      // Setup
      mockFindUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(true);
      mockGenerateTwoFactorToken.mockReturnValue('2fa_temp_token_xyz');

      // Execute
      const result = await authV2Service.login(loginOptions);

      // Verify
      expect(result.requiresTwoFactor).toBe(true);
      expect(result.tempToken).toBe('2fa_temp_token_xyz');
      expect(mockCreateSsoSession).not.toHaveBeenCalled();
      expect(mockLogLogin).not.toHaveBeenCalled();
    });

    it('should use default appId and tenantId when not provided', async () => {
      // Setup
      mockFindUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockCreateSsoSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        refreshToken: 'refresh_token_xyz789',
        jti: 'session-999',
      });

      // Execute
      await authV2Service.login({
        email: 'test@bigso.com',
        password: 'SecurePass123!',
        appId: undefined as any,
        tenantId: undefined as any,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      // Verify - SessionV2 should be called with config defaults
      expect(mockCreateSsoSession).toHaveBeenCalled();
    });
  });
});
