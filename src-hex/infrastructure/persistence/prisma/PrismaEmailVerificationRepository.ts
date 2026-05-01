import { EmailVerification } from '../../../domain/entities/EmailVerification';
import { IEmailVerificationRepository } from '../../../domain/repositories/IEmailVerificationRepository';
import { UserId } from '../../../domain/value-objects/UserId';
import { Email } from '../../../domain/value-objects/Email';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaEmailVerificationRepository
 * Implementation of IEmailVerificationRepository using Prisma ORM
 * Aligned with Prisma schema: email_verifications table
 */
export class PrismaEmailVerificationRepository implements IEmailVerificationRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<EmailVerification | null> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async findPendingByUser(userId: UserId): Promise<EmailVerification | null> {
    const record = await this.prisma.emailVerification.findFirst({
      where: {
        userId: userId.value,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async findByToken(token: string): Promise<EmailVerification | null> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { token },
    });
    return record ? this.mapToDomain(record) : null;
  }

  async save(verification: EmailVerification): Promise<void> {
    await this.prisma.emailVerification.create({
      data: {
        id: verification.id,
        userId: verification.userId.value,
        email: verification.email.value,
        token: verification.token,
        verified: verification.status === 'verified',
        expiresAt: verification.expiresAt,
        createdAt: verification.createdAt,
      },
    });
  }

  async update(verification: EmailVerification): Promise<void> {
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: {
        verified: verification.status === 'verified',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.emailVerification.delete({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  async isEmailVerified(email: Email): Promise<boolean> {
    const count = await this.prisma.emailVerification.count({
      where: {
        email: email.value,
        verified: true,
      },
    });
    return count > 0;
  }

  private mapToDomain(raw: any): EmailVerification {
    const status = raw.verified ? 'verified' : new Date() > raw.expiresAt ? 'expired' : 'pending';
    return new EmailVerification(
      raw.id,
      UserId.create(raw.userId),
      Email.createUnsafe(raw.email),
      raw.token,
      raw.createdAt,
      raw.expiresAt,
      status as any,
      raw.verified ? raw.updatedAt : undefined
    );
  }
}
