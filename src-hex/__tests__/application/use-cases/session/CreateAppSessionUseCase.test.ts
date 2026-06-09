import { CreateSessionInput } from '@hex/application/dto/input/CreateSessionInput';
import { CreateAppSessionUseCase } from '@hex/application/use-cases/session/CreateAppSessionUseCase';
import { TenantAccessDeniedError } from '@hex/domain/errors/TenantAccessDeniedError';
import { UserNotFoundError } from '@hex/domain/errors/UserNotFoundError';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUser = {
    id: { value: 'user-123' },
    email: { value: 'test@bigso.co' },
    canAccessTenant: jest.fn().mockReturnValue(true),
};

const mockTenant = {
    id: { value: 'tenant-456' },
    name: 'BIGSO',
    slug: 'bigso',
};

const sessionRepository = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
};

const userRepository = {
    findById: jest.fn().mockResolvedValue(mockUser),
};

const tenantRepository = {
    findById: jest.fn().mockResolvedValue(mockTenant),
};

const tokenService = {
    generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access.jwt.token',
        refreshToken: 'refresh.jwt.token',
        expiresIn: 900,
    }),
};

const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
};

const eventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateAppSessionUseCase', () => {
    let useCase: CreateAppSessionUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new CreateAppSessionUseCase(
            sessionRepository as any,
            userRepository as any,
            tenantRepository as any,
            tokenService as any,
            auditService as any,
            eventBus as any
        );
    });

    const validInput: CreateSessionInput = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        appId: 'crm',
        deviceFingerprint: {
            ip: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
        } as any,
        expiresInSeconds: 900,
    };

    it('should create an app session and return tokens', async () => {
        const result = await useCase.execute(validInput);

        expect(result.userId).toBe('user-123');
        expect(result.tenantId).toBe('tenant-456');
        expect(result.appId).toBe('crm');
        expect(result.accessToken).toBe('access.jwt.token');
        expect(result.refreshToken).toBe('refresh.jwt.token');
        expect(result.expiresIn).toBe(900);
        expect(result.sessionId).toBeDefined();
        expect(sessionRepository.save).toHaveBeenCalledTimes(1);
        expect(tokenService.generateTokens).toHaveBeenCalledTimes(1);
        expect(eventBus.publish).toHaveBeenCalledTimes(1);
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'APP_SESSION_CREATED' })
        );
    });

    it('should use default expiry when expiresInSeconds not provided', async () => {
        const input = { ...validInput };
        delete (input as any).expiresInSeconds;

        const result = await useCase.execute(input);

        expect(result.expiresIn).toBe(900); // Default 15 minutes
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
        userRepository.findById.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(UserNotFoundError);
    });

    it('should throw TenantAccessDeniedError when user cannot access tenant', async () => {
        mockUser.canAccessTenant.mockReturnValueOnce(false);

        await expect(useCase.execute(validInput)).rejects.toThrow(TenantAccessDeniedError);
    });

    it('should work without tenantId (optional)', async () => {
        const input = { ...validInput };
        delete (input as any).tenantId;

        const result = await useCase.execute(input);

        expect(result.userId).toBe('user-123');
        expect(result.tenantId).toBeUndefined();
    });

    it('should work without deviceFingerprint (optional)', async () => {
        const input = { ...validInput };
        delete (input as any).deviceFingerprint;

        const result = await useCase.execute(input);

        expect(result.userId).toBe('user-123');
        expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    });
});
