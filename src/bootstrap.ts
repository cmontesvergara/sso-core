import { createServer } from './server';
import { closeRedis } from './services/redis';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? 'localhost';

/**
 * bootstrap
 * Entry point for the legacy architecture mode.
 * Extracted from src/index.ts so the root index.ts can import it dynamically.
 */
export async function bootstrap(): Promise<void> {
  console.log('🔶 [LEGACY] Starting SSO Server...');

  const app = await createServer();

  const server = app.listen(PORT, HOST, () => {
    console.log(`✅ [LEGACY] Server running at http://${HOST}:${PORT}`);
    console.log(`   API v1: http://${HOST}:${PORT}/api/v1`);
    console.log(`   API v2: http://${HOST}:${PORT}/api/v2`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[LEGACY] ${signal} received — shutting down gracefully...`);
    await closeRedis();
    server.close(() => {
      console.log('[LEGACY] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
