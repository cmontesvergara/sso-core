import { execSync } from 'child_process';
import { Logger } from '../utils/logger';

/**
 * Hybrid migration strategy using node-pg-migrate for schema + Prisma for runtime
 *
 * Responsibilities:
 * - node-pg-migrate: Schema versioning, RLS policies, DB-level constraints, security
 * - Prisma: Type-safe ORM, runtime queries, TypeScript integration
 */

export async function runMigrationsUp(): Promise<void> {
  try {
    Logger.info('Running database migrations...');
    // node-pg-migrate up (runs all pending migrations)
    execSync('npm run migrate:up', { stdio: 'inherit' });
    Logger.info('Migrations completed successfully');
  } catch (err) {
    Logger.error('Migration failed:', err);
    throw err;
  }
}

export async function generatePrismaClient(): Promise<void> {
  try {
    Logger.info('Generating Prisma client...');
    // Prisma generates TypeScript types based on schema.prisma
    execSync('npm run prisma:generate', { stdio: 'inherit' });
    Logger.info('Prisma client generated successfully');
  } catch (err) {
    Logger.error('Prisma generation failed:', err);
    throw err;
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    // Step 1: Run migrations (schema + RLS)
    await runMigrationsUp();

    // Step 2: Generate Prisma client types
    await generatePrismaClient();

    Logger.info('Database initialization complete (migrations + Prisma)');
  } catch (err) {
    Logger.error('Database initialization failed:', err);
    throw err;
  }
}
