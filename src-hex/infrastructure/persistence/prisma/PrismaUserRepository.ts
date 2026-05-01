import { User } from '../../../domain/entities/User';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { Email } from '../../../domain/value-objects/Email';
import { PasswordHash } from '../../../domain/value-objects/PasswordHash';
import { NUID } from '../../../domain/value-objects/NUID';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaUserRepository
 * Implementation of IUserRepository using Prisma ORM
 * Aligned with Prisma schema
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: UserId): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: id.value },
    });

    return user ? this.mapToDomain(user) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.value },
    });

    return user ? this.mapToDomain(user) : null;
  }

  async findByNUID(nuid: NUID): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { nuid: nuid.value },
    });

    return user ? this.mapToDomain(user) : null;
  }

  async findByTenant(tenantId: TenantId): Promise<User[]> {
    // Query users through tenantMembers relation
    const members = await this.prisma.tenantMember.findMany({
      where: { tenantId: tenantId.value },
      include: { user: true },
    });

    return members.map((m: any) => this.mapToDomain(m.user));
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id.value,
        email: user.email.value,
        nuid: user.nuid.value,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash.hash,
        userStatus: user.userStatus,
        systemRole: user.systemRole as any,
        // Required fields with defaults
        phone: user.phone || '',
        // Optional fields
        secondName: user.secondName,
        secondLastName: user.secondLastName,
        birthDate: user.birthDate,
        gender: user.gender,
        nationality: user.nationality,
        birthPlace: user.birthPlace,
        placeOfResidence: user.placeOfResidence,
        occupation: user.occupation,
        maritalStatus: user.maritalStatus,
        recoveryPhone: user.recoveryPhone,
        recoveryEmail: user.recoveryEmail,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id.value },
      data: {
        email: user.email.value,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash.hash,
        userStatus: user.userStatus,
        systemRole: user.systemRole as any,
        phone: user.phone,
        secondName: user.secondName,
        secondLastName: user.secondLastName,
        birthDate: user.birthDate,
        gender: user.gender,
        nationality: user.nationality,
        birthPlace: user.birthPlace,
        placeOfResidence: user.placeOfResidence,
        occupation: user.occupation,
        maritalStatus: user.maritalStatus,
        recoveryPhone: user.recoveryPhone,
        recoveryEmail: user.recoveryEmail,
        updatedAt: user.updatedAt,
      },
    });
  }

  async delete(id: UserId): Promise<void> {
    await this.prisma.user.delete({
      where: { id: id.value },
    });
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: email.value },
    });
    return count > 0;
  }

  async existsByNUID(nuid: NUID): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { nuid: nuid.value },
    });
    return count > 0;
  }

  async countByTenant(tenantId: TenantId): Promise<number> {
    return await this.prisma.tenantMember.count({
      where: { tenantId: tenantId.value },
    });
  }

  private mapToDomain(prismaUser: any): User {
    return new User(
      UserId.create(prismaUser.id),
      Email.createUnsafe(prismaUser.email),
      NUID.create(prismaUser.nuid),
      prismaUser.firstName,
      prismaUser.lastName,
      PasswordHash.createUnsafe(prismaUser.passwordHash),
      prismaUser.userStatus,
      prismaUser.systemRole ?? 'user',
      // Required field
      prismaUser.phone || '',
      // Optional fields
      prismaUser.secondName || null,
      prismaUser.secondLastName || null,
      prismaUser.birthDate || null,
      prismaUser.gender || null,
      prismaUser.nationality || null,
      prismaUser.birthPlace || null,
      prismaUser.placeOfResidence || null,
      prismaUser.occupation || null,
      prismaUser.maritalStatus || null,
      prismaUser.recoveryPhone || null,
      prismaUser.recoveryEmail || null,
      // Relations (would need to be loaded separately)
      [],
      [],
      prismaUser.createdAt,
      prismaUser.updatedAt,
      prismaUser.lastLoginAt
    );
  }
}
