import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import crypto from 'crypto';
import { IEmailService } from '../../ports/output/IEmailService';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { RegisterUserInput } from '../../dto/input/RegisterUserInput';
import { UserResult } from '../../dto/output/UserResult';
import { UserCreatedEvent } from '../../../domain/events/UserEvents';
import { User } from '../../../domain/entities/User';
import { Tenant } from '../../../domain/entities/Tenant';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { Email } from '../../../domain/value-objects/Email';
// import { PasswordHash } from '../../../domain/value-objects/PasswordHash';
import { NUID } from '../../../domain/value-objects/NUID';
import { UserAlreadyExistsError } from '../../../domain/errors/UserAlreadyExistsError';
import { DocumentAlreadyExistsError } from '../../../domain/errors/DocumentAlreadyExistsError';
import { WeakPasswordError } from '../../../domain/errors/WeakPasswordError';
import {
  AuthenticationService,
  IPasswordHasher,
} from '../../../domain/services/AuthenticationService';

/**
 * RegisterUserUseCase
 * Orchestrates user registration
 * Updated for aligned domain entities
 */
export class RegisterUserUseCase {
  private authService: AuthenticationService;

  constructor(
    private userRepository: IUserRepository,
    private tenantRepository: ITenantRepository,
    private emailService: IEmailService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    passwordHasher: IPasswordHasher
  ) {
    this.authService = new AuthenticationService(passwordHasher);
  }

  async execute(input: RegisterUserInput): Promise<UserResult> {
    // 1. Validate email
    const emailResult = Email.create(input.email);
    if (emailResult.isFailure) {
      throw emailResult.error;
    }
    const email = emailResult.value;

    // 2. Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new UserAlreadyExistsError(input.email);
    }

    // 2b. Check if NUID already exists (if provided)
    if (input.nuid) {
      const nuidResult = NUID.create(input.nuid);
      const existingDocument = await this.userRepository.findByNUID(nuidResult);
      if (existingDocument) {
        throw new DocumentAlreadyExistsError(input.nuid);
      }
    }

    // 3. Validate password complexity
    const passwordValidation = this.authService.validatePasswordComplexity(input.password);
    if (!passwordValidation.isValid) {
      throw new WeakPasswordError(passwordValidation.errors.join(', '));
    }

    // 4. Hash password
    const passwordHash = await this.authService.hashPassword(input.password);

    // 5. Create user with all required fields
    const now = new Date();
    const user = new User(
      UserId.create(this.generateId()),
      email,
      NUID.create(input.nuid || this.generateNUID()), // Use input NUID or generate
      input.firstName,
      input.lastName,
      passwordHash,
      'disabled', // Requires email verification (DB constraint: disabled, active, blocked)
      'user',    // systemRole — matches Prisma SystemRole enum default
      '', // phone - required but empty for now
      null, // secondName
      null, // secondLastName
      null, // birthDate
      null, // gender
      null, // nationality
      null, // birthPlace
      null, // placeOfResidence
      null, // occupation
      null, // maritalStatus
      null, // recoveryPhone
      null, // recoveryEmail
      [], // addresses
      [], // tenantMemberships
      now,
      now
    );

    await this.userRepository.save(user);

    // 6. Create tenant if specified
    if (input.tenantName) {
      await this.createTenantForUser(user, input.tenantName);
    }

    // 7. Send welcome email
    await this.emailService.sendWelcomeEmail(email, input.firstName);

    // 8. Publish event
    await this.eventBus.publish(
      new UserCreatedEvent(user.id, email, input.firstName, input.lastName)
    );

    // 9. Log audit
    await this.auditService.log({
      type: 'USER_REGISTERED',
      userId: user.id.value,
    });

    return this.mapToResult(user);
  }

  private async createTenantForUser(user: User, tenantName: string): Promise<void> {
    const tenant = new Tenant(
      TenantId.create(this.generateId()),
      tenantName,
      this.generateSlug(tenantName),
      'active',
      {},
      new Date(),
      new Date()
    );

    await this.tenantRepository.save(tenant);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateNUID(): string {
    // Generate a simple NUID: N followed by timestamp and random
    return `N${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private mapToResult(user: User): UserResult {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      userStatus: user.userStatus,
      systemRole: user.systemRole,
      tenantMemberships: user.tenantMemberships.map((m) => ({
        tenantId: m.tenantId.value,
        tenantName: '', // Would need to fetch tenant name
        role: m.role.value,
      })),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
