import { OtpSecret } from '../../../domain/entities/OtpSecret';
import { IOtpRepository } from '../../../domain/repositories/IOtpRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaOtpRepository
 * Implementation of IOtpRepository using Prisma ORM
 * Aligned with Prisma schema: otp_secrets table
 */
export class PrismaOtpRepository implements IOtpRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<OtpSecret | null> {
    const record = await this.prisma.oTPSecret.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async findActiveByUser(userId: UserId): Promise<OtpSecret | null> {
    const record = await this.prisma.oTPSecret.findFirst({
      where: {
        userId: userId.value,
        verified: true,
      },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async save(secret: OtpSecret): Promise<void> {
    await this.prisma.oTPSecret.create({
      data: {
        id: secret.id,
        userId: secret.userId.value,
        secret: secret.secret,
        backupCodes: [...secret.backupCodes],
        verified: secret.status === 'active',
        createdAt: secret.createdAt,
      },
    });
  }

  async update(secret: OtpSecret): Promise<void> {
    await this.prisma.oTPSecret.update({
      where: { id: secret.id },
      data: {
        backupCodes: [...secret.backupCodes],
        verified: secret.status === 'active',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.oTPSecret.delete({ where: { id } });
  }

  async deleteAllForUser(userId: UserId): Promise<number> {
    const result = await this.prisma.oTPSecret.deleteMany({
      where: { userId: userId.value },
    });
    return result.count;
  }

  async isEnabledForUser(userId: UserId): Promise<boolean> {
    const count = await this.prisma.oTPSecret.count({
      where: { userId: userId.value, verified: true },
    });
    return count > 0;
  }

  private mapToDomain(raw: any): OtpSecret {
    const status = raw.verified ? 'active' : 'inactive';
    return new OtpSecret(
      raw.id,
      UserId.create(raw.userId),
      raw.secret,
      raw.backupCodes ?? [],
      status as any,
      raw.createdAt,
      undefined, // lastUsedAt — not in current schema
      undefined  // verifiedAt — not in current schema
    );
  }
}
