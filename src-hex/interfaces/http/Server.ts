import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Container } from '../../infrastructure/config/Container';
import { AuditLogCleanupJob } from '../../infrastructure/jobs/AuditLogCleanupJob';
import { errorHandlerMiddleware } from '../../infrastructure/web/middleware/ErrorHandlerMiddleware';
import { createRouter } from '../../infrastructure/web/routes/index';

/**
 * createHexServer
 * Builds the Express application for the hexagonal architecture mode.
 * All controllers and middlewares are resolved from the Container —
 * Server.ts is a pure composition root, no business logic here.
 */
export async function createHexServer(container: Container): Promise<Express> {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Rate limiting
  // handler: persists RATE_LIMIT_BLOCKED events into the audit log
  // so they show up in sso-manager's activity dashboard.
  const prismaForRateLimit = container.get<any>('PrismaClient');
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX ?? '2000', 10),
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => process.env.RATE_LIMIT_DISABLED === 'true' || req.ip === '127.0.0.1' || req.ip === '::1',
      handler: async (req: Request, res: Response) => {
        // Log the blocked request asynchronously — do not await so response is immediate
        prismaForRateLimit.auditLog.create({
          data: {
            action: 'RATE_LIMIT_BLOCKED',
            userId: null,
            tenantId: null,
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
            metadata: {
              method: req.method,
              path: req.path,
              origin: req.headers['origin'] ?? null,
            },
            createdAt: new Date(),
          },
        }).catch((err: any) => console.warn('[RateLimit] Failed to persist audit log:', err));

        res.status(429).json({
          error: 'Too many requests, please try again later.',
          retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10) / 1000),
        });
      },
    })
  );

  // ── Infrastructure routes (public, no auth) ───────────────────────────────
  const healthHandler = (_req: Request, res: Response) => {
    res.json({ status: 'OK', mode: 'hexagonal', timestamp: new Date().toISOString() });
  };

  app.get('/health', healthHandler);
  app.get('/idp/health', healthHandler);

  app.get('/ready', healthHandler);
  app.get('/idp/ready', healthHandler);

  // JWKS endpoint — publicly accessible, no CORS restriction
  const jwksHandler = (_req: Request, res: Response) => {
    try {
      const jwksString = container.get<any>('JwksProvider').getJwksString();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(jwksString);
    } catch (err: any) {
      res.status(500).json({ error: 'JWKS not initialized', message: err.message });
    }
  };

  app.get('/.well-known/jwks.json', jwksHandler);
  app.get('/idp/.well-known/jwks.json', jwksHandler);

  // ── API v2/v3 (hexagonal auth + app core) ────────────────────────────────
  const apiRouter = createRouter(container);
  app.use('/api/v2', apiRouter);
  app.use('/idp/v1', apiRouter);

  // ── 404 ──────────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandlerMiddleware);

  // ── Audit log cleanup cron job ───────────────────────────────────────────
  const prisma = container.get<any>('PrismaClient');
  new AuditLogCleanupJob(prisma).start();

  return app;
}
