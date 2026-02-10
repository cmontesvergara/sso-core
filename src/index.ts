import 'dotenv/config';
import { createServer } from './server';
import { Logger } from './utils/logger';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

async function bootstrap(): Promise<void> {
  try {
    Logger.info('🚀 Starting SSO Server...');

    const app = await createServer();

    app.listen(PORT as number, HOST as string, () => {
      Logger.info(`✅ Server is running at http://${HOST}:${PORT}`);
      Logger.info(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
    });


    // Graceful shutdown
    process.on('SIGTERM', () => {
      Logger.info('SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      Logger.info('SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
