import { OtpSecret } from '@hex/domain/entities/OtpSecret';
import { UserId } from '@hex/domain/value-objects/UserId';

describe('OtpSecret Entity', () => {
    const now = new Date();

    const createOtp = (overrides?: Partial<{
        status: 'active' | 'inactive';
        backupCodes: string[];
        verifiedAt: Date;
        lastUsedAt: Date;
    }>) => {
        return new OtpSecret(
            'otp-001',
            UserId.create('user-123'),
            'encrypted-secret-xyz',
            overrides?.backupCodes ?? ['code1', 'code2', 'code3'],
            overrides?.status ?? 'active',
            now,
            overrides?.lastUsedAt,
            overrides?.verifiedAt
        );
    };

    it('should create OTP secret with all properties', () => {
        const otp = createOtp();

        expect(otp.id).toBe('otp-001');
        expect(otp.userId.value).toBe('user-123');
        expect(otp.secret).toBe('encrypted-secret-xyz');
        expect(otp.backupCodes).toHaveLength(3);
        expect(otp.status).toBe('active');
        expect(otp.isActive()).toBe(true);
        expect(otp.verifiedAt).toBeUndefined();
        expect(otp.lastUsedAt).toBeUndefined();
    });

    it('should detect inactive OTP', () => {
        const otp = createOtp({ status: 'inactive' });

        expect(otp.isActive()).toBe(false);
    });

    it('should verify backup code', () => {
        const otp = createOtp();

        expect(otp.verifyBackupCode('code1')).toBe(true);
        expect(otp.verifyBackupCode('wrong-code')).toBe(false);
    });

    it('should mark as used', () => {
        const otp = createOtp();
        const used = otp.markAsUsed();

        expect(used.lastUsedAt).toBeDefined();
        expect(otp.lastUsedAt).toBeUndefined(); // Original unchanged
    });

    it('should mark as used', () => {
        const otp = createOtp();
        const used = otp.markAsUsed();

        expect(used.lastUsedAt).toBeDefined();
        expect(otp.lastUsedAt).toBeUndefined(); // Original unchanged
    });

    it('should deactivate', () => {
        const otp = createOtp();
        const deactivated = otp.deactivate();

        expect(deactivated.status).toBe('inactive');
        expect(deactivated.isActive()).toBe(false);
        expect(otp.isActive()).toBe(true); // Original unchanged
    });

    it('should consume backup code', () => {
        const otp = createOtp();
        const consumed = otp.consumeBackupCode('code1');

        expect(consumed.backupCodes).toHaveLength(2);
        expect(consumed.verifyBackupCode('code1')).toBe(false);
        expect(otp.backupCodes).toHaveLength(3); // Original unchanged
    });

    it('should be immutable', () => {
        const otp = createOtp();
        expect(() => {
            (otp as any)._secret = 'tampered';
        }).toThrow();
    });
});
