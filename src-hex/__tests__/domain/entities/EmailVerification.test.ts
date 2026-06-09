import { EmailVerification } from '@hex/domain/entities/EmailVerification';
import { Email } from '@hex/domain/value-objects/Email';
import { UserId } from '@hex/domain/value-objects/UserId';

describe('EmailVerification Entity', () => {
    const now = new Date();
    const future = new Date(Date.now() + 3600_000);
    const past = new Date(Date.now() - 1000);

    const createVerification = (overrides?: Partial<{
        status: 'pending' | 'verified' | 'expired';
        expiresAt: Date;
        verifiedAt: Date;
    }>) => {
        return new EmailVerification(
            'ev-001',
            UserId.create('user-123'),
            Email.createUnsafe('test@bigso.co'),
            'verification-token-123',
            now,
            overrides?.expiresAt ?? future,
            overrides?.status ?? 'pending',
            overrides?.verifiedAt
        );
    };

    it('should create verification with all properties', () => {
        const ev = createVerification();

        expect(ev.id).toBe('ev-001');
        expect(ev.userId.value).toBe('user-123');
        expect(ev.email.value).toBe('test@bigso.co');
        expect(ev.token).toBe('verification-token-123');
        expect(ev.status).toBe('pending');
        expect(ev.isPending()).toBe(true);
        expect(ev.isExpired()).toBe(false);
        expect(ev.verifiedAt).toBeUndefined();
    });

    it('should detect expired verification', () => {
        const ev = createVerification({ expiresAt: past });

        expect(ev.isExpired()).toBe(true);
        expect(ev.isPending()).toBe(false);
    });

    it('should verify token correctly', () => {
        const ev = createVerification();

        expect(ev.verifyToken('verification-token-123')).toBe(true);
        expect(ev.verifyToken('wrong-token')).toBe(false);
    });

    it('should not verify expired token', () => {
        const ev = createVerification({ expiresAt: past });

        expect(ev.verifyToken('verification-token-123')).toBe(false);
    });

    it('should mark as verified', () => {
        const ev = createVerification();
        const verified = ev.markAsVerified();

        expect(verified.status).toBe('verified');
        expect(verified.verifiedAt).toBeDefined();
        expect(ev.status).toBe('pending'); // Original unchanged
    });

    it('should mark as expired', () => {
        const ev = createVerification();
        const expired = ev.markAsExpired();

        expect(expired.status).toBe('expired');
        expect(ev.status).toBe('pending'); // Original unchanged
    });

    it('should be immutable', () => {
        const ev = createVerification();
        expect(() => {
            (ev as any)._token = 'tampered';
        }).toThrow();
    });
});
