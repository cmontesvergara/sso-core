import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuditService } from '../../ports/output/IAuditService';
import { IEventBus } from '../../ports/output/IEventBus';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { UserId } from '../../../domain/value-objects/UserId';
import { RoleName } from '../../../domain/value-objects/RoleName';
import { UserNotFoundError } from '../../../domain/errors/UserNotFoundError';
import { TenantAccessDeniedError } from '../../../domain/errors/TenantAccessDeniedError';
import { UserAddedToTenantEvent } from '../../../domain/events/TenantEvents';
import { PrismaClient } from '@prisma/client';

export interface AddUserToTenantInput {
  tenantId: string;
  userId: string;
  role: string;
  requestedByUserId: string;
}

export interface ChangeUserRoleInput {
  tenantId: string;
  userId: string;
  newRole: string;
  requestedByUserId: string;
}

/**
 * AddUserToTenantUseCase
 * Adds a user as a member of a tenant with a given role.
 * Persists via Prisma AND updates the domain entity's membership list
 * using the immutable withTenantMembership() builder.
 */
export class AddUserToTenantUseCase {
  constructor(
    private tenantRepository: ITenantRepository,
    private userRepository: IUserRepository,
    private prisma: PrismaClient,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: AddUserToTenantInput): Promise<void> {
    // 1. Verify tenant exists
    const tenant = await this.tenantRepository.findById(TenantId.create(input.tenantId));
    if (!tenant) throw new TenantAccessDeniedError(input.userId, input.tenantId);

    // 2. Verify user exists
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) throw new UserNotFoundError(input.userId);

    // 3. Persist the membership in Prisma (source of truth for DB)
    await this.prisma.tenantMember.upsert({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: input.userId },
      },
      create: {
        tenantId: input.tenantId,
        userId: input.userId,
        role: input.role,
        createdAt: new Date(),
      },
      update: {
        role: input.role,
      },
    });

    // 4. Update domain entity (immutable pattern via withTenantMembership)
    const updatedUser = user.withTenantMembership({
      tenantId: TenantId.create(input.tenantId),
      role: RoleName.create(input.role),
      joinedAt: new Date(),
    });
    await this.userRepository.update(updatedUser);

    // 5. Events and audit
    await this.eventBus.publish(
      new UserAddedToTenantEvent(
        UserId.create(input.userId),
        TenantId.create(input.tenantId),
        input.role
      )
    );

    await this.auditService.log({
      type: 'MEMBER_ADDED_TO_TENANT',
      userId: input.requestedByUserId,
      tenantId: input.tenantId,
      metadata: { targetUserId: input.userId, role: input.role },
    });
  }
}

/**
 * ChangeUserRoleUseCase
 * Changes the role of an existing tenant member.
 * Uses withTenantMembership() — which replaces the existing membership for that tenant.
 */
export class ChangeUserRoleUseCase {
  constructor(
    private tenantRepository: ITenantRepository,
    private userRepository: IUserRepository,
    private prisma: PrismaClient,
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: ChangeUserRoleInput): Promise<void> {
    // 1. Verify tenant
    const tenant = await this.tenantRepository.findById(TenantId.create(input.tenantId));
    if (!tenant) throw new TenantAccessDeniedError(input.userId, input.tenantId);

    // 2. Verify user
    const user = await this.userRepository.findById(UserId.create(input.userId));
    if (!user) throw new UserNotFoundError(input.userId);

    // 3. Persist role change
    await this.prisma.tenantMember.update({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: input.userId },
      },
      data: { role: input.newRole },
    });

    // 4. Reflect role change in domain (withTenantMembership replaces if already present)
    const updatedUser = user.withTenantMembership({
      tenantId: TenantId.create(input.tenantId),
      role: RoleName.create(input.newRole),
      joinedAt: new Date(),
    });
    await this.userRepository.update(updatedUser);

    await this.auditService.log({
      type: 'MEMBER_ROLE_CHANGED',
      userId: input.requestedByUserId,
      tenantId: input.tenantId,
      metadata: { targetUserId: input.userId, newRole: input.newRole },
    });
  }
}
