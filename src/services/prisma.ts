import { PrismaClient } from '@prisma/client';
import { Config } from '../config';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;

/**
 * Build DATABASE_URL from individual config values
 */
function buildDatabaseUrl(): string {
  const type = Config.get('database.type') || process.env.DATABASE_TYPE || 'postgresql';
  const host = Config.get('database.host') || process.env.DATABASE_HOST;
  const port = Config.get('database.port') || process.env.DATABASE_PORT || '5432';
  const name = Config.get('database.name') || process.env.DATABASE_NAME;
  const user = Config.get('database.user') || process.env.DATABASE_USER;
  const password = Config.get('database.password') || process.env.DATABASE_PASSWORD;
  const ssl = Config.get('database.ssl') ?? (process.env.DATABASE_SSL === 'true');

  if (!host || !port || !name || !user || !password) {
    throw new Error('Missing required database configuration');
  }

  // Encode user and password to handle special characters
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const sslMode = ssl ? 'require' : 'disable';
  
  const url = `${type}://${encodedUser}:${encodedPassword}@${host}:${port}/${name}?sslmode=${sslMode}`;
  
  Logger.info(`Connecting to database: ${type}://${encodedUser}:***@${host}:${port}/${name}`);
  
  return url;
}

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    // Build DATABASE_URL if not provided
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = buildDatabaseUrl();
      Logger.info('Built DATABASE_URL from config');
    }

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
