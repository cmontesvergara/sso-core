import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { UserId } from '../../../domain/value-objects/UserId';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { UserProfileUpdatedEvent } from '../../../domain/events/UserEvents';

export interface UpdateProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileResult {
  success: boolean;
  userId: string;
}

import {
  AuthenticationService,
  IPasswordHasher,
} from '../../../domain/services/AuthenticationService';
import { WeakPasswordError } from '../../../domain/errors/WeakPasswordError';

/**
 * UpdateUserProfileUseCase
 * Updates non-sensitive user fields.
 */
export class UpdateUserProfileUseCase {
  constructor(
    private userRepository: IUserRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: UpdateProfileInput): Promise<UpdateProfileResult> {
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) throw new UserNotFoundError(input.userId);

    // Apply only the provided fields — withProfile() is a partial patch builder
    const updated = user.withProfile({
      firstName:      input.firstName,
      lastName:       input.lastName,
      phone:          input.phone,
      recoveryEmail:  input.recoveryEmail,
      recoveryPhone:  input.recoveryPhone,
    });

    await this.userRepository.update(updated);

    await this.eventBus.publish(
      new UserProfileUpdatedEvent(updated.id, {
        firstName: updated.firstName,
        lastName:  updated.lastName,
        phone:     updated.phone,
      })
    );
    await this.auditService.log({ type: 'USER_PROFILE_UPDATED', userId: input.userId });

    return { success: true, userId: input.userId };
  }
}

/**
 * ChangePasswordUseCase
 * Verifies current password then replaces with a new hashed password.
 */
export class ChangePasswordUseCase {
  private authService: AuthenticationService;

  constructor(
    private userRepository: IUserRepository,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    passwordHasher: IPasswordHasher
  ) {
    this.authService = new AuthenticationService(passwordHasher);
  }

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) throw new UserNotFoundError(input.userId);

    // Verify current password
    await this.authService.verifyCredentials(user, input.currentPassword);

    // Validate new password strength
    const validation = this.authService.validatePasswordComplexity(input.newPassword);
    if (!validation.isValid) throw new WeakPasswordError(validation.errors.join(', '));

    // Hash and save
    const newHash = await this.authService.hashPassword(input.newPassword);
    const updated = user.withPasswordHash(newHash);
    await this.userRepository.update(updated);

    await this.auditService.logSecurity({ type: 'PASSWORD_CHANGED', userId: input.userId });
  }
}
