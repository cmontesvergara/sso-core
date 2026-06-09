import { AuthCode } from '@hex/domain/entities/AuthCode';
import { InvalidAuthCodeError } from '@hex/domain/errors/InvalidAuthCodeError';
import { AuthCodeId } from '@hex/domain/value-objects/Ids';
import { TenantId } from '@hex/domain/value-objects/TenantId';
import { UserId } from '@hex/domain/value-objects/UserId';

describe('AuthCode Entity', () => {
    const now = new Date();
    const future = new Date(Date.now() + 300_000);
    const past = new Date(Date.now() - 1000);

    const createCode = (overrides?: Partial<{
        used: boolean;
        expiresAt: Date;
        codeChallenge: string | null;
        codeChallengeMethod: string | null;
    }>) => {
        return new AuthCode(
            AuthCodeId.create('ac-001'),
            'auth-code-123',
            UserId.create('user-123'),
            TenantId.create('tenant-456'),
            'crm',
            'https://crm.bigso.co/callback',
            overrides?.expiresAt ?? future,
            now,
            overrides?.used ?? false,
            overrides?.codeChallenge ?? null,
            overrides?.codeChallengeMethod ?? null,
            'state-xyz',
            'nonce-abc',
            null
        );
    };

    it('should create an auth code with all properties', () => {
        const code = createCode();

        expect(code.id.value).toBe('ac-001');
        expect(code.code).toBe('auth-code-123');
        expect(code.userId.value).toBe('user-123');
        expect(code.tenantId.value).toBe('tenant-456');
        expect(code.appId).toBe('crm');
        expect(code.redirectUri).toBe('https://crm.bigso.co/callback');
        expect(code.used).toBe(false);
        expect(code.codeChallenge).toBeNull();
        expect(code.state).toBe('state-xyz');
        expect(code.nonce).toBe('nonce-abc');
        expect(code.isUsable()).toBe(true);
        expect(code.isExpired()).toBe(false);
    });

    it('should detect expired code', () => {
        const code = createCode({ expiresAt: past });

        expect(code.isExpired()).toBe(true);
        expect(code.isUsable()).toBe(false);
    });

    it('should detect used code', () => {
        const code = createCode({ used: true });

        expect(code.used).toBe(true);
        expect(code.isUsable()).toBe(false);
    });

    it('should mark code as used', () => {
        const code = createCode();
        const used = code.markAsUsed();

        expect(used.used).toBe(true);
        expect(code.used).toBe(false); // Original unchanged
    });

    it('should throw when marking unusable code as used', () => {
        const code = createCode({ used: true });

        expect(() => code.markAsUsed()).toThrow(InvalidAuthCodeError);
    });

    it('should verify PKCE S256 code verifier', () => {
        const codeChallenge = 'E9Melhoa2OwvFrEMT';
        const code = createCode({
            codeChallenge,
            codeChallengeMethod: 'S256',
        });

        // Compute correct S256 hash
        const crypto = require('crypto');
        const correctVerifier = 'correct-verifier';
        const computedChallenge = crypto
            .createHash('sha256')
            .update(correctVerifier)
            .digest('base64url');

        const codeWithChallenge = new AuthCode(
            AuthCodeId.create('ac-002'),
            'code-2',
            UserId.create('user-123'),
            TenantId.create('tenant-456'),
            'crm',
            'https://crm.bigso.co/callback',
            future,
            now,
            false,
            computedChallenge,
            'S256',
            null,
            null,
            null
        );

        expect(codeWithChallenge.verifyVerifier(correctVerifier)).toBe(true);
        expect(codeWithChallenge.verifyVerifier('wrong-verifier')).toBe(false);
    });

    it('should verify plain PKCE verifier', () => {
        const code = createCode({
            codeChallenge: 'plain-verifier',
            codeChallengeMethod: 'plain',
        });

        expect(code.verifyVerifier('plain-verifier')).toBe(true);
        expect(code.verifyVerifier('wrong')).toBe(false);
    });

    it('should skip PKCE verification when no challenge stored', () => {
        const code = createCode();

        expect(code.verifyVerifier('anything')).toBe(true);
    });

    it('should be immutable', () => {
        const code = createCode();
        expect(() => {
            (code as any)._code = 'tampered';
        }).toThrow();
    });
});
