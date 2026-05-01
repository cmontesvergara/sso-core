import { AuthCode } from '../../../domain/entities/AuthCode';
import { IAuthCodeRepository } from '../../../domain/repositories/IAuthCodeRepository';
import { AuthCodeId } from '../../../domain/value-objects/Ids';
import { UserId } from '../../../domain/value-objects/UserId';
import { TenantId } from '../../../domain/value-objects/TenantId';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaAuthCodeRepository
 * Implementation of IAuthCodeRepository using Prisma ORM
 * Aligned with Prisma schema: auth_codes table
 */
export class PrismaAuthCodeRepository implements IAuthCodeRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: AuthCodeId): Promise<AuthCode | null> {
    const code = await this.prisma.authCode.findUnique({
      where: { id: id.value },
    });
    return code ? this.mapToDomain(code) : null;
  }

  async findByCode(code: string): Promise<AuthCode | null> {
    const authCode = await this.prisma.authCode.findUnique({
      where: { code },
    });
    return authCode ? this.mapToDomain(authCode) : null;
  }

  async save(authCode: AuthCode): Promise<void> {
    await this.prisma.authCode.create({
      data: {
        id: authCode.id.value,
        code: authCode.code,
        userId: authCode.userId.value,
        tenantId: authCode.tenantId.value,
        appId: authCode.appId,
        redirectUri: authCode.redirectUri,
        used: authCode.used,
        expiresAt: authCode.expiresAt,
        createdAt: authCode.createdAt,
        codeChallenge: authCode.codeChallenge,
        codeChallengeMethod: authCode.codeChallengeMethod,
        state: authCode.state,
        nonce: authCode.nonce,
        ssoSessionId: authCode.ssoSessionId,
      },
    });
  }

  async update(authCode: AuthCode): Promise<void> {
    await this.prisma.authCode.update({
      where: { id: authCode.id.value },
      data: { used: authCode.used },
    });
  }

  async delete(id: AuthCodeId): Promise<void> {
    await this.prisma.authCode.delete({ where: { id: id.value } });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.authCode.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  async findPendingByUser(userId: UserId): Promise<AuthCode[]> {
    const codes = await this.prisma.authCode.findMany({
      where: {
        userId: userId.value,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    return codes.map((c: any) => this.mapToDomain(c));
  }

  async countActiveForUserInTenant(userId: UserId, tenantId: TenantId): Promise<number> {
    return this.prisma.authCode.count({
      where: {
        userId: userId.value,
        tenantId: tenantId.value,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private mapToDomain(raw: any): AuthCode {
    return new AuthCode(
      AuthCodeId.create(raw.id),
      raw.code,
      UserId.create(raw.userId),
      TenantId.create(raw.tenantId),
      raw.appId,
      raw.redirectUri ?? '',
      raw.expiresAt,
      raw.createdAt,
      raw.used ?? false,
      raw.codeChallenge ?? null,
      raw.codeChallengeMethod ?? null,
      raw.state ?? null,
      raw.nonce ?? null,
      raw.ssoSessionId ?? null
    );
  }
}
