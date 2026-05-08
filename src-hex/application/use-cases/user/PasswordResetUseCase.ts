import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository';
import { IEmailService } from '../../ports/output/IEmailService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import {
  AuthenticationService,
  IPasswordHasher,
} from '../../../domain/services/AuthenticationService';
import { EmailVerification } from '../../../domain/entities/EmailVerification';
import { Email } from '../../../domain/value-objects/Email';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { InvalidAuthCodeError } from '../../../domain/errors/InvalidAuthCodeError';
import { WeakPasswordError } from '../../../domain/errors/WeakPasswordError';
import { PasswordChangedEvent } from '../../../domain/events/UserEvents';
import { v4 as uuidv4 } from 'uuid';

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

/**
 * ForgotPasswordUseCase
 * Sends a password reset link.
 * Uses the email_verifications table with a RESET_ prefixed token to avoid adding a new table.
 */
export class ForgotPasswordUseCase {
  constructor(
    private userRepository: IUserRepository,
    private emailVerificationRepository: IEmailVerificationRepository,
    private emailService: IEmailService,
    private auditService: IAuditService
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const emailResult = Email.create(input.email);
    if (emailResult.isFailure) {
      // Return silently — never reveal whether email exists
      return;
    }

    const user = await this.userRepository.findByEmail(emailResult.value);
    if (!user) {
      // Same: do not reveal non-existence
      return;
    }

    const token = `RESET_${uuidv4()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

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
    await this.emailService.sendPasswordResetEmail(user.email, token);

    await this.auditService.log({
      type: 'PASSWORD_RESET_REQUESTED',
      userId: user.id.value,
      ip: undefined,
    });
  }
}

/**
 * ResetPasswordUseCase
 * Validates the reset token and updates the password.
 */
export class ResetPasswordUseCase {
  private authService: AuthenticationService;

  constructor(
    private userRepository: IUserRepository,
    private emailVerificationRepository: IEmailVerificationRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    passwordHasher: IPasswordHasher
  ) {
    this.authService = new AuthenticationService(passwordHasher);
  }

  async execute(input: ResetPasswordInput): Promise<void> {
    // 1. Find the verification record by token
    const verification = await this.emailVerificationRepository.findByToken(input.token);
    if (!verification || !verification.isPending()) {
      throw new InvalidAuthCodeError('Token de recuperación inválido o expirado');
    }

    // 2. Find user
    const user = await this.userRepository.findById(verification.userId);
    if (!user) {
      throw new UserNotFoundError(verification.userId.value);
    }

    // 3. Validate new password strength
    const validation = this.authService.validatePasswordComplexity(input.newPassword);
    if (!validation.isValid) {
      throw new WeakPasswordError(validation.errors.join(', '));
    }

    // 4. Hash and save
    const newHash = await this.authService.hashPassword(input.newPassword);
    const updated = user.withPasswordHash(newHash);
    await this.userRepository.update(updated);

    // 5. Invalidate token
    const usedVerification = verification.markAsVerified();
    await this.emailVerificationRepository.update(usedVerification);

    // 6. Events and audit
    await this.eventBus.publish(new PasswordChangedEvent(user.id));
    await this.auditService.logSecurity({
      type: 'PASSWORD_RESET_COMPLETED',
      userId: user.id.value,
    });
  }
}
