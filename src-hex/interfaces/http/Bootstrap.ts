import { Container } from '../../infrastructure/config/Container';
import { createHexServer } from './Server';

/**
 * bootstrap
 * Entry point for the hexagonal architecture mode.
 * Called from the root index.ts when SSO_MODE=hexagonal.
 */
export async function bootstrap(): Promise<void> {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
  const HOST = process.env.HOST ?? '0.0.0.0';

  console.log('🔷 [HEXAGONAL] Initializing container...');
  const container = new Container();
  await container.initialize();

  console.log('🔷 [HEXAGONAL] Building server...');
  const app = await createHexServer(container);

  const server = app.listen(PORT, HOST, () => {
    console.log(`✅ [HEXAGONAL] Server running at http://${HOST}:${PORT}`);
    console.log(`   API v3: http://${HOST}:${PORT}/api/v3`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[HEXAGONAL] ${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await container.dispose();
      console.log('[HEXAGONAL] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
