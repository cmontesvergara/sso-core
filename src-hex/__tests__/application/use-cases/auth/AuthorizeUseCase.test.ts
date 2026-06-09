import { AuthorizeInput, AuthorizeUseCase } from '@hex/application/use-cases/auth/AuthorizeUseCase';
import { InvalidCredentialsError } from '@hex/domain/errors/InvalidCredentialsError';
import { TenantAccessDeniedError } from '@hex/domain/errors/TenantAccessDeniedError';
import { UserNotFoundError } from '@hex/domain/errors/UserNotFoundError';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUser = {
    id: { value: 'user-123' },
    email: { value: 'test@bigso.co' },
    canAccessTenant: jest.fn().mockReturnValue(true),
};

const mockSession = {
    id: { value: 'session-abc' },
    userId: { value: 'user-123' },
    expiresAt: new Date(Date.now() + 900_000),
};

const mockApplication = {
    id: { value: 'app-001' },
    appId: 'crm',
    name: 'CRM',
    url: 'https://crm.bigso.co',
    description: null,
    logoUrl: null,
    backendUrl: null,
    isActive: true,
    audience: 'https://crm.bigso.co',
    scope: ['read', 'write'],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockTenant = {
    id: { value: 'tenant-456' },
    name: 'BIGSO',
    slug: 'bigso',
};

const authCodeRepository = {
    save: jest.fn().mockResolvedValue(undefined),
};

const applicationRepository = {
    findByClientId: jest.fn().mockResolvedValue(mockApplication),
};

const tenantRepository = {
    findById: jest.fn().mockResolvedValue(mockTenant),
};

const userRepository = {
    findById: jest.fn().mockResolvedValue(mockUser),
};

const sessionRepository = {
    findById: jest.fn().mockResolvedValue(mockSession),
};

const tokenService = {
    generateSignedPayload: jest.fn().mockReturnValue('signed.jwt.payload'),
};

const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthorizeUseCase', () => {
    let useCase: AuthorizeUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new AuthorizeUseCase(
            authCodeRepository as any,
            applicationRepository as any,
            tenantRepository as any,
            userRepository as any,
            sessionRepository as any,
            tokenService as any,
            auditService as any
        );
    });

    const validInput: AuthorizeInput = {
        sessionId: 'session-abc',
        tenantId: 'tenant-456',
        appId: 'crm',
        redirectUri: 'https://crm.bigso.co/callback',
    };

    it('should generate an authorization code for valid input', async () => {
        const result = await useCase.execute(validInput);

        expect(result.success).toBe(true);
        expect(result.code).toBeDefined();
        expect(result.code.length).toBe(48);
        expect(result.expiresIn).toBe(300);
        expect(result.redirectUri).toContain('code=');
        expect(authCodeRepository.save).toHaveBeenCalledTimes(1);
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'AUTHORIZE' })
        );
    });

    it('should include state in redirect URI when provided', async () => {
        const input = { ...validInput, state: 'xyz-state' };
        const result = await useCase.execute(input);

        expect(result.redirectUri).toContain('state=xyz-state');
        expect(result.state).toBe('xyz-state');
    });

    it('should include signedPayload for PKCE flows', async () => {
        const input = {
            ...validInput,
            codeChallenge: 'challenge123',
            codeChallengeMethod: 'S256',
        };
        const result = await useCase.execute(input);

        expect(result.signedPayload).toBe('signed.jwt.payload');
        expect(tokenService.generateSignedPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                code: result.code,
                appId: 'crm',
                tenantId: 'tenant-456',
            }),
            'https://crm.bigso.co'
        );
    });

    it('should throw InvalidCredentialsError when session not found', async () => {
        sessionRepository.findById.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw UserNotFoundError when user not found', async () => {
        userRepository.findById.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(UserNotFoundError);
    });

    it('should throw TenantAccessDeniedError when user cannot access tenant', async () => {
        mockUser.canAccessTenant.mockReturnValueOnce(false);

        await expect(useCase.execute(validInput)).rejects.toThrow(TenantAccessDeniedError);
    });

    it('should throw TenantAccessDeniedError when application not found', async () => {
        applicationRepository.findByClientId.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(TenantAccessDeniedError);
    });

    it('should throw TenantAccessDeniedError when application is inactive', async () => {
        applicationRepository.findByClientId.mockResolvedValueOnce({ ...mockApplication, isActive: false });

        await expect(useCase.execute(validInput)).rejects.toThrow(TenantAccessDeniedError);
    });

    it('should throw TenantAccessDeniedError when tenant not found', async () => {
        tenantRepository.findById.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(TenantAccessDeniedError);
    });
});
