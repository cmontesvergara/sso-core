import { RefreshTokenUseCase } from '@hex/application/use-cases/auth/RefreshTokenUseCase';

jest.mock('../../../../../src/services/prisma', () => ({
  getPrismaClient: () => ({
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-123',
        firstName: 'Test',
        lastName: 'User',
      }),
    },
    tenantMember: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }),
}));

const mockRefreshToken = {
  id: { value: 'rt-001' },
  userId: { value: 'user-123' },
  tokenHash: 'hashed-token-abc',
  revoked: false,
  expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  isActive: () => true,
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
      { hash: (v: string) => v, verify: (v: string, h: string) => v === h } // test stub
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

  it('should throw when refresh token is not found', async () => {
    refreshTokenRepository.findByHash.mockResolvedValueOnce(null);
    await expect(
      refreshTokenUseCase.execute({ refreshToken: 'invalid', tenantId: 't', appId: 'a' })
    ).rejects.toThrow();
  });

  it('should throw when refresh token is revoked', async () => {
    refreshTokenRepository.findByHash.mockResolvedValueOnce({
      ...mockRefreshToken,
      revoked: true,
      isActive: () => false,
    });
    await expect(
      refreshTokenUseCase.execute({ refreshToken: 'hashed-token-abc', tenantId: 't', appId: 'a' })
    ).rejects.toThrow();
  });

  it('should publish TokenRefreshedEvent', async () => {
    await refreshTokenUseCase.execute({
      refreshToken: 'hashed-token-abc',
      tenantId: 'tenant-456',
      appId: 'crm',
    });
    expect(eventBus.publish).toHaveBeenCalled();
  });
});
