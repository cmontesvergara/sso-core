import { PrismaClient } from '@prisma/client';

/**
 * PrismaClient singleton
 * Centralized Prisma client instance
 */
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

export async function initPrisma(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$connect();
}

export async function closePrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
