import { VerifySessionInput, VerifySessionUseCase } from '@hex/application/use-cases/auth/VerifySessionUseCase';
import { SessionExpiredError } from '@hex/domain/errors/SessionExpiredError';
import { SessionNotFoundError } from '@hex/domain/errors/SessionNotFoundError';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSession = {
    id: { value: 'session-abc' },
    userId: { value: 'user-123' },
    expiresAt: new Date(Date.now() + 900_000),
};

const sessionRepository = {
    findById: jest.fn().mockResolvedValue(mockSession),
    save: jest.fn().mockResolvedValue(undefined),
};

const tokenService = {
    validateAccessToken: jest.fn().mockResolvedValue({
        sub: 'user-123',
        jti: 'session-abc',
        tenantId: 'tenant-456',
        appId: 'crm',
        type: 'access',
    }),
};

const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VerifySessionUseCase', () => {
    let useCase: VerifySessionUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new VerifySessionUseCase(
            sessionRepository as any,
            tokenService as any,
            auditService as any
        );
    });

    const validInput: VerifySessionInput = {
        accessToken: 'valid.jwt.token',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
    };

    it('should return valid result for active session', async () => {
        const result = await useCase.execute(validInput);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe('user-123');
        expect(result.sessionId).toBe('session-abc');
        expect(result.claims).toEqual(
            expect.objectContaining({
                sub: 'user-123',
                jti: 'session-abc',
            })
        );
        expect(tokenService.validateAccessToken).toHaveBeenCalledWith('valid.jwt.token');
        expect(sessionRepository.findById).toHaveBeenCalled();
    });

    it('should throw SessionNotFoundError when session does not exist', async () => {
        sessionRepository.findById.mockResolvedValueOnce(null);

        await expect(useCase.execute(validInput)).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw SessionExpiredError when session has expired', async () => {
        sessionRepository.findById.mockResolvedValueOnce({
            ...mockSession,
            expiresAt: new Date(Date.now() - 1000),
        });

        await expect(useCase.execute(validInput)).rejects.toThrow(SessionExpiredError);
        expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SESSION_EXPIRED' })
        );
    });

    it('should throw when token validation fails', async () => {
        tokenService.validateAccessToken.mockRejectedValueOnce(new Error('Invalid token'));

        await expect(useCase.execute(validInput)).rejects.toThrow('Invalid token');
    });

    it('should work without optional ip and userAgent', async () => {
        const input: VerifySessionInput = { accessToken: 'valid.jwt.token' };
        const result = await useCase.execute(input);

        expect(result.valid).toBe(true);
    });
});
