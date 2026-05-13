import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IEmailService } from '../../ports/output/IEmailService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { EmailVerification } from '../../../domain/entities/EmailVerification';
import { UserId } from '../../../domain/value-objects/UserId';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { InvalidAuthCodeError } from '../../../domain/errors/InvalidAuthCodeError';
import { v4 as uuidv4 } from 'uuid';

export interface SendVerificationEmailInput {
  userId: string;
}

export interface VerifyEmailInput {
  token: string;
}

/**
 * VerifyEmailUseCase
 * Sends verification email and handles token confirmation.
 */
export class VerifyEmailUseCase {
  constructor(
    private emailVerificationRepository: IEmailVerificationRepository,
    private userRepository: IUserRepository,
    private emailService: IEmailService,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async sendVerification(input: SendVerificationEmailInput): Promise<void> {
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) throw new UserNotFoundError(input.userId);

    const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 h

    const verification = new EmailVerification(
      uuidv4(),
      user.id,
      user.email,
      token,
      now,
      expiresAt,
      'pending'
    );

    await this.emailVerificationRepository.save(verification);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

  async verifyToken(input: VerifyEmailInput): Promise<void> {
    const verification = await this.emailVerificationRepository.findByToken(input.token);
    if (!verification || !verification.isPending()) {
      throw new InvalidAuthCodeError('Token de verificación inválido o expirado');
    }

    const verified = verification.markAsVerified();
    await this.emailVerificationRepository.update(verified);

    // Activate user if still disabled (pending verification)
    const user = await this.userRepository.findById(verification.userId);
    if (user && user.userStatus === 'disabled') {
      const activated = user.withStatus('active');
      await this.userRepository.update(activated);
    }

    await this.auditService.log({
      type: 'EMAIL_VERIFIED',
      userId: verification.userId.value,
    });
  }
}
