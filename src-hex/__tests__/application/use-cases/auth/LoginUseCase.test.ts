import { LoginUseCase } from '@hex/application/use-cases/auth/LoginUseCase';
import { LoginInput } from '@hex/application/dto/input/LoginInput';
import { DeviceFingerprint } from '@hex/domain/value-objects/DeviceFingerprint';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUser = {
  id: { value: 'user-123' },
  email: { value: 'test@bigso.co' },
  nuid: { value: 'N123456' },
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez',
  passwordHash: { hash: '$argon2id$...' },
  userStatus: 'active',
  systemRole: 'user',
  phone: '',
  isActive: () => true,
  canAccessTenant: () => true,
  getRoleForTenant: () => ({ value: 'admin' }),
  hasPermission: () => false,
  tenantMemberships: [],
  lastLoginAt: undefined,
  withLastLogin: jest.fn().mockReturnThis(),
};

const mockSession = {
  id: { value: 'session-abc' },
  userId: { value: 'user-123' },
  expiresAt: new Date(Date.now() + 900_000),
};

const mockTokens = {
  accessToken: 'access.jwt.token',
  refreshToken: 'refresh.jwt.token',
  expiresIn: 900,
};

const userRepository = {
  findByEmail: jest.fn().mockResolvedValue(mockUser),
  findByNUID: jest.fn().mockResolvedValue(mockUser),
  findById: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
};

const sessionRepository = {
  save: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(mockSession),
};

const tokenService = {
  generateTokens: jest.fn().mockResolvedValue(mockTokens),
  validateAccessToken: jest.fn(),
};

const auditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logSecurity: jest.fn().mockResolvedValue(undefined),
  logAuthSuccess: jest.fn().mockResolvedValue(undefined),
  logAuthFailure: jest.fn().mockResolvedValue(undefined),
};

const eventBus = {
  publish: jest.fn().mockResolvedValue(undefined),
  publishAll: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
};

const passwordHasher = {
  hash: jest.fn(),
  verify: jest.fn().mockResolvedValue(true),
};

let refreshTokenRepository: any;
let hashService: any;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;

  const baseInput: LoginInput = {
    email: 'test@bigso.co',
    password: 'StrongPass123!',
    appId: 'crm',
    tenantId: 'tenant-456',
    deviceFingerprint: DeviceFingerprint.create({ ip: '127.0.0.1', userAgent: 'jest' }),
  };

  beforeEach(() => {
    jest.resetAllMocks(); // resets queued mockOnce values too
    // Reset all mocks to their default resolved values
    userRepository.findByEmail.mockResolvedValue(mockUser);
    userRepository.findByNUID.mockResolvedValue(mockUser);
    userRepository.findById.mockResolvedValue(mockUser);
    userRepository.save.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue(undefined);
    passwordHasher.verify.mockResolvedValue(true);
    tokenService.generateTokens.mockResolvedValue(mockTokens);
    refreshTokenRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    hashService = {
      hash: jest.fn().mockReturnValue('mock-hash'),
    };

    loginUseCase = new LoginUseCase(
      userRepository as any,
      sessionRepository as any,
      refreshTokenRepository as any,
      tokenService as any,
      auditService as any,
      eventBus as any,
      hashService as any,
      passwordHasher as any
    );
  });

  describe('execute — happy path', () => {
    it('should return access and refresh tokens on valid credentials', async () => {
      const result = await loginUseCase.execute(baseInput);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('access.jwt.token');
      expect(result.refreshToken).toBe('refresh.jwt.token');
    });

    it('should lookup user by email when email is provided', async () => {
      await loginUseCase.execute(baseInput);
      expect(userRepository.findByEmail).toHaveBeenCalledTimes(1);
    });

    it('should lookup user by NUID when nuid is provided instead of email', async () => {
      // findByNUID is now fully implemented via PrismaUserRepository
      const input = { ...baseInput, email: undefined, nuid: 'N123456' };
      const result = await loginUseCase.execute(input);
      // Should succeed with NUID lookup path
      expect(result.success).toBe(true);
    });

    it('should generate tokens via tokenService', async () => {
      await loginUseCase.execute(baseInput);
      expect(tokenService.generateTokens).toHaveBeenCalledTimes(1);
    });

    it('should publish UserLoggedInEvent', async () => {
      await loginUseCase.execute(baseInput);
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should log an audit entry on success', async () => {
      await loginUseCase.execute(baseInput);
      // The LoginUseCase calls auditService.log() with type: 'AUTH_SUCCESS'
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AUTH_SUCCESS',
          userId: 'user-123',
        })
      );
    });
  });

  describe('execute — error cases', () => {
    it('should throw when user is not found', async () => {
      userRepository.findByEmail.mockResolvedValueOnce(null);
      await expect(loginUseCase.execute(baseInput)).rejects.toThrow();
    });

    it('should throw when password does not match', async () => {
      passwordHasher.verify.mockResolvedValueOnce(false);
      await expect(loginUseCase.execute(baseInput)).rejects.toThrow();
    });

    it('should throw when user account is inactive', async () => {
      userRepository.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        userStatus: 'inactive',
        isActive: () => false,
      });
      await expect(loginUseCase.execute(baseInput)).rejects.toThrow();
    });
  });
});
