import { RefreshToken } from '@hex/domain/entities/RefreshToken';
import { RefreshTokenId } from '@hex/domain/value-objects/Ids';
import { UserId } from '@hex/domain/value-objects/UserId';

describe('RefreshToken Entity', () => {
    const now = new Date();
    const future = new Date(Date.now() + 7 * 24 * 3600_000);
    const past = new Date(Date.now() - 1000);

    const createToken = (overrides?: Partial<ConstructorParameters<typeof RefreshToken>[0]>) => {
        return new RefreshToken(
            RefreshTokenId.create('rt-001'),
            UserId.create('user-123'),
            'hashed-token',
            now,
            future,
            false,
            null,
            null,
            null,
            null
        );
    };

    it('should create a refresh token with all properties', () => {
        const token = createToken();

        expect(token.id.value).toBe('rt-001');
        expect(token.userId.value).toBe('user-123');
        expect(token.tokenHash).toBe('hashed-token');
        expect(token.revoked).toBe(false);
        expect(token.previousTokenId).toBeNull();
        expect(token.isActive()).toBe(true);
        expect(token.isExpired()).toBe(false);
        expect(token.hasBeenRotated()).toBe(false);
    });

    it('should detect expired token', () => {
        const token = new RefreshToken(
            RefreshTokenId.create('rt-002'),
            UserId.create('user-123'),
            'hashed-token',
            now,
            past,
            false,
            null,
            null,
            null,
            null
        );

        expect(token.isExpired()).toBe(true);
        expect(token.isActive()).toBe(false);
    });

    it('should detect revoked token', () => {
        const token = new RefreshToken(
            RefreshTokenId.create('rt-003'),
            UserId.create('user-123'),
            'hashed-token',
            now,
            future,
            true,
            null,
            null,
            null,
            null
        );

        expect(token.revoked).toBe(true);
        expect(token.isActive()).toBe(false);
    });

    it('should detect rotated token', () => {
        const token = new RefreshToken(
            RefreshTokenId.create('rt-004'),
            UserId.create('user-123'),
            'hashed-token',
            now,
            future,
            false,
            RefreshTokenId.create('rt-prev'),
            null,
            null,
            null
        );

        expect(token.hasBeenRotated()).toBe(true);
        expect(token.previousTokenId?.value).toBe('rt-prev');
    });

    it('should verify hash correctly', () => {
        const token = createToken();

        expect(token.verifyHash('hashed-token')).toBe(true);
        expect(token.verifyHash('wrong-hash')).toBe(false);
    });

    it('should create revoked copy', () => {
        const token = createToken();
        const revoked = token.revoke();

        expect(revoked.revoked).toBe(true);
        expect(token.revoked).toBe(false); // Original unchanged
    });

    it('should create rotation', () => {
        const token = createToken();
        const newToken = token.createRotation(
            RefreshTokenId.create('rt-002'),
            'new-hash',
            new Date(Date.now() + 7 * 24 * 3600_000)
        );

        expect(newToken.tokenHash).toBe('new-hash');
        expect(newToken.previousTokenId?.value).toBe('rt-001');
        expect(newToken.hasBeenRotated()).toBe(true); // New token references previous
        expect(token.hasBeenRotated()).toBe(false); // Original has no previous
    });
});
