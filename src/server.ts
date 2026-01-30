import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { loggingMiddleware } from './middleware/logging';
import applicationsRoutes from './routes/applications';
import docsRoutes from './routes/docs';
import emailVerificationRoutes from './routes/emailVerification';
import metadataRoutes from './routes/metadata';
import otpRoutes from './routes/otp';
import roleRoutes from './routes/role';
import sessionRoutes from './routes/session';
import tenantRoutes from './routes/tenant';
import userRoutes from './routes/user';
import utilRoutes from './routes/util';
import { JWT } from './services/jwt';
import { initPrisma } from './services/prisma';
import { initSessionSubsystem } from './services/session';

export async function createServer(): Promise<Express> {
  const app = express();

  // Load configuration
  await Config.load();

  // Trust proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: Config.get('cors.origin'),
      credentials: Config.get('cors.credentials'),
      methods: Config.get('cors.methods'),
    })
  );

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Logging middleware
  app.use(loggingMiddleware);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Readiness endpoint - verifies JWKS is available
  app.get('/ready', (_req: Request, res: Response) => {
    try {
      const jwks: any = JWT.getJWKS();
      if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0)
        throw new Error('keystore empty');
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'NOT_READY', message: 'Keystore not initialized' });
    }
  });

  // Rate limiter (global)
  const limiter = rateLimit({
    windowMs: Config.get('rateLimit.windowMs', 60 * 1000), // default 1 minute
    max: Config.get('rateLimit.max', 100), // default 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // JWKS endpoint
  app.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
    try {
      const jwks = JWT.getJWKS();
      res.json(jwks);
    } catch (err: any) {
      res.status(500).json({ error: 'JWKS not initialized', message: err.message });
    }
  });

  // API v1 routes
  const apiV1 = express.Router();

  // import auth routes after config is loaded (so route-level config like rate limits can read Config)
  const authModule = await import('./routes/auth');
  const authRoutes = authModule.default;
  apiV1.use('/auth', authRoutes);
  apiV1.use('/docs', docsRoutes);
  apiV1.use('/session', sessionRoutes);
  apiV1.use('/user', userRoutes);
  apiV1.use('/tenant', tenantRoutes);
  apiV1.use('/role', roleRoutes);
  apiV1.use('/otp', otpRoutes);
  apiV1.use('/email-verification', emailVerificationRoutes);
  apiV1.use('/metadata', metadataRoutes);
  apiV1.use('/applications', applicationsRoutes);
  apiV1.use('/util', utilRoutes);

  app.use('/api/v1', apiV1);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Initialize JWT keys before returning server (non-blocking if already initialized)
  try {
    await JWT.initKeys();
    // Initialize Prisma client
    try {
      await initPrisma();
    } catch (err) {
      console.warn('Prisma initialization failed; continuing...', err);
    }
    // initialize session subsystem
    try {
      await initSessionSubsystem();
    } catch (err) {
      console.warn('Session subsystem failed to init; continue without sessions for now.', err);
    }
  } catch (err) {
    console.error('Failed to initialize JWT keystore:', err);
    throw err;
  }

  return app;
}
