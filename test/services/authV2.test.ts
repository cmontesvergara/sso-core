// Mock dependencies BEFORE importing modules that depend on them
jest.mock('argon2');
jest.mock('../../src/services/otp');
jest.mock('../../src/services/auditLog');
jest.mock('../../src/services/jwt');

// Set required environment variable before importing modules that depend on it
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper-for-unit-tests-only';

import argon2 from 'argon2';
import { AuthServiceV2 } from '../../src/services/authV2';
import { OTP } from '../../src/services/otp';
import { AuditLog } from '../../src/services/auditLog';
import { JWT } from '../../src/services/jwt';
import { UserRepository } from '../../src/core/repositories/user.repository';
import { SsoSessionService } from '../../src/services/session/sso-session.service';

// Setup argon2 mock to return true for valid password tests
const mockArgon2Verify = argon2.verify as jest.Mock;

// Mock Prisma client
const mockPrismaClient: any = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../../src/services/prisma', () => ({
  getPrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock OTP and JWT as jest.fn() for test manipulation
const mockIsOTPEnabled = jest.fn();
const mockGenerateTwoFactorToken = jest.fn();

(OTP.isOTPEnabled as jest.Mock) = mockIsOTPEnabled;
(JWT.generateTwoFactorToken as jest.Mock) = mockGenerateTwoFactorToken;

describe('AuthServiceV2', () => {
  let authV2Service: AuthServiceV2;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockSsoSessionService: jest.Mocked<SsoSessionService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@bigso.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc123$xyz789',
    firstName: 'Test',
    secondName: null,
    lastName: 'User',
    secondLastName: null,
    systemRole: 'user' as const,
    userStatus: 'active' as const,
    nuid: '123456789',
    phone: '+1234567890',
    birthDate: null,
    gender: null,
    nationality: null,
    birthPlace: null,
    placeOfResidence: null,
    occupation: null,
    maritalStatus: null,
    recoveryPhone: null,
    recoveryEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: password is valid
    mockArgon2Verify.mockResolvedValue(true);
    mockIsOTPEnabled.mockResolvedValue(false);
    mockGenerateTwoFactorToken.mockReturnValue('2fa-temp-token');

    // Setup mock repositories
    mockUserRepo = {
      prisma: mockPrismaClient,
      createUser: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      findUserByNuid: jest.fn(),
      updateUser: jest.fn(),
      updateUserPassword: jest.fn(),
      deleteUser: jest.fn(),
      listUsers: jest.fn(),
      countUsers: jest.fn(),
    } as any;

    mockSsoSessionService = {
      createSession: jest.fn(),
      validateToken: jest.fn(),
      isRevoked: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
    } as any;

    // Create service with mocks using isolateModules
    await jest.isolateModules(async () => {
      const mod = await import('../../src/services/authV2');
      const AuthServiceV2Class = mod.AuthServiceV2;
      authV2Service = new AuthServiceV2Class(mockUserRepo, mockSsoSessionService);
    });
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
      mockUserRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockSsoSessionService.createSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        jti: 'session-999',
      } as any);

      // Execute
      const result = await authV2Service.login(loginOptions);

      // Verify
      expect(mockUserRepo.findUserByEmail).toHaveBeenCalledWith('test@bigso.com');
      expect(result.ssoToken).toBe('sso_token_abc123');
      expect(AuditLog.logLogin).toHaveBeenCalledWith(mockUser.id, '192.168.1.1', 'Mozilla/5.0');
    });

    it('should login successfully with NUID', async () => {
      // Setup
      mockUserRepo.findUserByNuid.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockSsoSessionService.createSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        jti: 'session-999',
      } as any);

      // Execute
      const result = await authV2Service.login({
        ...loginOptions,
        email: undefined,
        nuid: mockUser.nuid,
      });

      // Verify
      expect(mockUserRepo.findUserByNuid).toHaveBeenCalledWith(mockUser.nuid);
      expect(result.ssoToken).toBe('sso_token_abc123');
    });

    it('should throw 401 when user not found by email', async () => {
      // Setup
      mockUserRepo.findUserByEmail.mockResolvedValue(undefined);

      // Execute & Verify
      await expect(authV2Service.login(loginOptions)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should throw 401 when user not found by NUID', async () => {
      // Setup
      mockUserRepo.findUserByNuid.mockResolvedValue(undefined);

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
      mockUserRepo.findUserByEmail.mockResolvedValue(mockUser);
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
      mockUserRepo.findUserByEmail.mockResolvedValue(inactiveUser);

      // Execute & Verify
      await expect(authV2Service.login(loginOptions)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not active',
        code: 'ACCOUNT_NOT_ACTIVE',
      });
    });

    it('should return tempToken when 2FA is enabled', async () => {
      // Setup
      mockUserRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(true);
      mockGenerateTwoFactorToken.mockReturnValue('2fa_temp_token_xyz');

      // Execute
      const result = await authV2Service.login(loginOptions);

      // Verify
      expect(result.requiresTwoFactor).toBe(true);
      expect(result.tempToken).toBe('2fa_temp_token_xyz');
      expect(mockSsoSessionService.createSession).not.toHaveBeenCalled();
      expect(AuditLog.logLogin).not.toHaveBeenCalled();
    });

    it('should use default appId and tenantId when not provided', async () => {
      // Setup
      mockUserRepo.findUserByEmail.mockResolvedValue(mockUser);
      mockIsOTPEnabled.mockResolvedValue(false);
      mockSsoSessionService.createSession.mockResolvedValue({
        accessToken: 'sso_token_abc123',
        jti: 'session-999',
      } as any);

      // Execute
      await authV2Service.login({
        email: 'test@bigso.com',
        password: 'SecurePass123!',
        appId: undefined as any,
        tenantId: undefined as any,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      // Verify - Session service should be called with defaults
      expect(mockSsoSessionService.createSession).toHaveBeenCalled();
    });
  });
});
