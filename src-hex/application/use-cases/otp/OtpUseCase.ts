import speakeasy from 'speakeasy';
import { IOtpRepository } from '../../../domain/repositories/IOtpRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { OtpSecret } from '../../../domain/entities/OtpSecret';
import { UserId } from '../../../domain/value-objects/UserId';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { InvalidCredentialsError } from '../../../domain/errors/InvalidCredentialsError';
import { v4 as uuidv4 } from 'uuid';

export interface GenerateOtpResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface VerifyOtpInput {
  userId: string;
  token: string;
}

/**
 * GenerateOtpUseCase
 * Creates a TOTP secret for a user and returns the QR code setup URL.
 */
export class GenerateOtpUseCase {
  constructor(
    private otpRepository: IOtpRepository,
    private userRepository: IUserRepository,
    private auditService: IAuditService
  ) {}

  async execute(userId: string): Promise<GenerateOtpResult> {
    const user = await this.userRepository.findById(UserId.create(userId));
    if (!user) throw new UserNotFoundError(userId);

    const generated = speakeasy.generateSecret({
      name: `BigSo SSO (${user.email.value})`,
      issuer: 'BigSo SSO',
    });

    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    const otpSecret = new OtpSecret(
      uuidv4(),
      user.id,
      generated.base32,
      backupCodes,
      'inactive', // becomes active after first verification
      new Date()
    );

    // Delete existing and replace
    await this.otpRepository.deleteAllForUser(user.id);
    await this.otpRepository.save(otpSecret);

    await this.auditService.log({ type: 'OTP_SECRET_GENERATED', userId });

    return {
      secret: generated.base32,
      qrCodeUrl: generated.otpauth_url ?? '',
      backupCodes,
    };
  }
}

/**
 * VerifyOtpUseCase
 * Validates a TOTP token against the user's stored secret.
 */
export class VerifyOtpUseCase {
  constructor(
    private otpRepository: IOtpRepository,
    private auditService: IAuditService
  ) {}

  async execute(input: VerifyOtpInput): Promise<void> {
    const userId = UserId.create(input.userId);
    const otpSecret = await this.otpRepository.findActiveByUser(userId);

    // Also check inactive secrets (user may be setting up for the first time)
    const record = otpSecret ?? await this.findInactiveForUser(userId);
    if (!record) {
      throw new InvalidCredentialsError('2FA not configured for this user');
    }

    const valid = speakeasy.totp.verify({
      secret: record.secret,
      encoding: 'base32',
      token: input.token,
      window: 1,
    });

    if (!valid) {
      await this.auditService.logSecurity({ type: 'OTP_INVALID', userId: input.userId });
      throw new InvalidCredentialsError('Invalid OTP token');
    }

    // Activate if this was the first verification
    if (record.status === 'inactive') {
      const activated = new OtpSecret(
        record.id,
        record.userId,
        record.secret,
        [...record.backupCodes],
        'active',
        record.createdAt,
        new Date(),
        new Date()
      );
      await this.otpRepository.update(activated);
    }

    await this.auditService.log({ type: 'OTP_VERIFIED', userId: input.userId });
  }

  private async findInactiveForUser(userId: UserId): Promise<OtpSecret | null> {
    // Fallback: look for an inactive OTP record to support first-time activation
    return this.otpRepository.findActiveByUser(userId);
  }
}
