import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

export async function initPrisma(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    Logger.info('Prisma client connected to database');
  } catch (err) {
    Logger.error('Failed to connect Prisma client:', err);
    throw err;
  }
}

export async function closePrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Utility: Set current_user_id for RLS policies
export function setPrismaUserContext(userId: string): void {
  const client = getPrismaClient();
  // This sets the app.current_user_id variable used by RLS policies
  // Note: This is connection-based and works best with single connections
  // For advanced multi-tenant scenarios, use separate Prisma instances or middleware
  client.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`;
}

export async function clearPrismaUserContext(): Promise<void> {
  const client = getPrismaClient();
  await client.$executeRaw`SELECT set_config('app.current_user_id', '', false)`;
}
