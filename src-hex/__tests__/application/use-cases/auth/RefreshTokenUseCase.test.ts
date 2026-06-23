import { RefreshTokenUseCase } from '@hex/application/use-cases/auth/RefreshTokenUseCase';
import { InvalidCredentialsError } from '@hex/domain/errors/InvalidCredentialsError';

const mockRefreshToken = {
  id: { value: 'rt-001' },
  userId: { value: 'user-123' },
  tokenHash: 'hashed-token-abc',
  revoked: false,
  expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  isActive: () => true,
  hasBeenRotated: () => false,
  revoke: jest.fn().mockReturnThis(),
  createRotation: jest.fn().mockReturnValue({
    id: { value: 'rt-002' },
    userId: { value: 'user-123' },
    tokenHash: 'new-hashed-token',
    revoked: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  }),
};

const mockSession = {
  id: { value: 'session-abc' },
  userId: { value: 'user-123' },
  expiresAt: new Date(Date.now() + 900_000),
};

const refreshTokenRepository = {
  findByHash: jest.fn().mockResolvedValue(mockRefreshToken),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  findByUser: jest.fn().mockResolvedValue([]),
};

const sessionRepository = {
  findById: jest.fn().mockResolvedValue(mockSession),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
};

const tokenService = {
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'new.access.token',
    refreshToken: 'new.refresh.token',
    expiresIn: 900,
  }),
  hashToken: jest.fn().mockImplementation((t: string) => Promise.resolve(t + '-hashed')),
  validateRefreshToken: jest.fn().mockResolvedValue({
    sub: 'user-123',
    sessionId: 'session-abc',
    type: 'refresh',
    tenantId: 'tenant-456',
    appId: 'crm',
  }),
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

const mockQueryRepository = {
  findUserById: jest.fn().mockResolvedValue({
    id: 'user-123',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    nuid: 'N123',
    email: 'test@bigso.co',
    userStatus: 'active',
    systemRole: 'user',
  }),
  findFirstTenantMembership: jest.fn().mockResolvedValue({
    tenantId: 'tenant-456',
    role: 'admin',
  }),
  findTenantMemberships: jest.fn().mockResolvedValue([]),
  findRolePermissions: jest.fn().mockResolvedValue([]),
  findApplicationByAppId: jest.fn().mockResolvedValue(null),
  upsertTenantMember: jest.fn().mockResolvedValue(undefined),
  updateTenantMemberRole: jest.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('RefreshTokenUseCase', () => {
  let refreshTokenUseCase: RefreshTokenUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    refreshTokenUseCase = new RefreshTokenUseCase(
      refreshTokenRepository as any,
      sessionRepository as any,
      tokenService as any,
      auditService as any,
      eventBus as any,
      { hash: (v: string) => v, verify: (v: string, h: string) => v === h },
      mockQueryRepository as any,
      mockLogger as any
    );
  });

  it('should return new tokens on valid refresh token', async () => {
    const result = await refreshTokenUseCase.execute({
      refreshToken: 'hashed-token-abc',
      tenantId: 'tenant-456',
      appId: 'crm',
    });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('new.access.token');
  });

  it('should preserve application audience when refreshing', async () => {
    mockQueryRepository.findApplicationByAppId.mockResolvedValueOnce({
      id: 'app-crm',
      audience: 'https://api.ordamy.com',
      url: 'https://crm.bigso.co',
      backendUrl: 'https://api.crm.bigso.co',
    });

    await refreshTokenUseCase.execute({
      refreshToken: 'hashed-token-abc',
      tenantId: 'tenant-456',
      appId: 'crm',
    });

    expect(mockQueryRepository.findApplicationByAppId).toHaveBeenCalledWith('crm');
    expect(tokenService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'crm',
        audience: 'https://api.ordamy.com',
        url: 'https://crm.bigso.co',
        backendUrl: 'https://api.crm.bigso.co',
      })
    );
  });

  it('should reject token not found in refresh token table', async () => {
    refreshTokenRepository.findByHash.mockResolvedValueOnce(null);

    await expect(
      refreshTokenUseCase.execute({
        refreshToken: 'unknown-token',
        tenantId: 't',
        appId: 'a'
      })
    ).rejects.toThrow(InvalidCredentialsError);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REFRESH_FAILURE',
        metadata: expect.objectContaining({
          reason: 'Token not found in refresh token table'
        })
      })
    );
  });

  it('should throw when refresh token is revoked', async () => {
    refreshTokenRepository.findByHash.mockResolvedValueOnce({
      ...mockRefreshToken,
      revoked: true,
      isActive: () => false,
      hasBeenRotated: () => false,
    });

    await expect(
      refreshTokenUseCase.execute({ refreshToken: 'hashed-token-abc', tenantId: 't', appId: 'a' })
    ).rejects.toThrow('Token has been revoked');
  });

  it('should detect token reuse and revoke all user tokens', async () => {
    const rotatedToken = {
      ...mockRefreshToken,
      isActive: () => false,
      hasBeenRotated: () => true,
    };
    refreshTokenRepository.findByHash.mockResolvedValueOnce(rotatedToken);
    refreshTokenRepository.findByUser.mockResolvedValueOnce([
      { ...mockRefreshToken, isActive: () => true, revoke: () => mockRefreshToken },
    ]);

    await expect(
      refreshTokenUseCase.execute({ refreshToken: 'reused-token', tenantId: 't', appId: 'a' })
    ).rejects.toThrow('Token reuse detected');

    expect(auditService.logSecurity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TOKEN_REUSE_DETECTED'
      })
    );
  });

  it('should publish TokenRefreshedEvent on successful refresh', async () => {
    await refreshTokenUseCase.execute({
      refreshToken: 'hashed-token-abc',
      tenantId: 'tenant-456',
      appId: 'crm',
    });
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should log audit on successful refresh', async () => {
    await refreshTokenUseCase.execute({
      refreshToken: 'hashed-token-abc',
      tenantId: 'tenant-456',
      appId: 'crm',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TOKEN_REFRESH',
        userId: 'user-123'
      })
    );
  });
});
