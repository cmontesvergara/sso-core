import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

export async function initRefreshTokensRepo(): Promise<void> {
  // Tables are created by node-pg-migrate; Prisma just uses them
  Logger.info('Refresh tokens repository initialized (managed by migrations)');
}

export async function saveRefreshToken(params: {
  user_id: string;
  token_hash: string;
  client_id?: string | null;
  expires_at: Date;
  previous_token_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
}) {
  const prisma = getPrisma();
  const { user_id, token_hash, client_id, expires_at, previous_token_id, ip, user_agent } = params;

  return await prisma.refreshToken.create({
    data: {
      userId: user_id,
      tokenHash: token_hash,
      clientId: client_id || null,
      expiresAt: expires_at,
      previousTokenId: previous_token_id || null,
      ip: ip || null,
      userAgent: user_agent || null,
    },
  });
}

export async function findRefreshTokenByHash(token_hash: string) {
  const prisma = getPrisma();
  return await prisma.refreshToken.findUnique({
    where: { tokenHash: token_hash },
  });
}

export async function revokeRefreshTokenById(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.refreshToken.update({
    where: { id },
    data: { revoked: true },
  });
}

export async function revokeAllRefreshTokensForUser(user_id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.refreshToken.updateMany({
    where: { userId: user_id },
    data: { revoked: true },
  });
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance.$disconnect().catch(err => Logger.error('Error closing Prisma:', err));
  }
}
