import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Container } from '../../infrastructure/config/Container';
import { AdminTenantController } from '../../infrastructure/web/controllers/AdminTenantController';
import { AdminUserController } from '../../infrastructure/web/controllers/AdminUserController';
import { ApplicationsController } from '../../infrastructure/web/controllers/ApplicationsController';
import { ApplicationSyncController } from '../../infrastructure/web/controllers/ApplicationSyncController';
import { AppResourceController } from '../../infrastructure/web/controllers/AppResourceController';
import { RoleController } from '../../infrastructure/web/controllers/RoleController';
import { StatsController } from '../../infrastructure/web/controllers/StatsController';
import { errorHandlerMiddleware } from '../../infrastructure/web/middleware/ErrorHandlerMiddleware';
import { createAdminTenantRouter } from '../../infrastructure/web/routes/adminTenant.routes';
import { createAdminUserRouter } from '../../infrastructure/web/routes/adminUser.routes';
import { createApplicationsRouter } from '../../infrastructure/web/routes/applications.routes';
import { createApplicationSyncRouter } from '../../infrastructure/web/routes/applicationSync.routes';
import { createAppResourceRouter } from '../../infrastructure/web/routes/appResource.routes';
import { createRouter } from '../../infrastructure/web/routes/index';
import { createRoleRouter } from '../../infrastructure/web/routes/role.routes';
import { createStatsRouter } from '../../infrastructure/web/routes/stats.routes';
import { AuditLogCleanupJob } from '../../infrastructure/jobs/AuditLogCleanupJob';

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
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      standardHeaders: true,
      legacyHeaders: false,
skip: (req) => process.env.RATE_LIMIT_DISABLED === 'true' || req.ip === '127.0.0.1' || req.ip === '::1',
    })
  );

  // ── Infrastructure routes (public, no auth) ───────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', mode: 'hexagonal', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.json({ status: 'OK', mode: 'hexagonal', timestamp: new Date().toISOString() });
  });

  // JWKS endpoint — publicly accessible, no CORS restriction
  app.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
    try {
      const jwksString = container.get<any>('JwksProvider').getJwksString();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(jwksString);
    } catch (err: any) {
      res.status(500).json({ error: 'JWKS not initialized', message: err.message });
    }
  });

  // ── API v2/v3 (hexagonal auth + app core) ────────────────────────────────
  app.use('/api/v2', createRouter(container));

  // ── API v1 (Admin routes — controllers & requireAuth from Container) ──────
  const requireAuth = container.get<RequestHandler>('RequireAuth');

  app.use('/api/v1/tenant', createAdminTenantRouter(container.get<AdminTenantController>('TenantController'), requireAuth));
  app.use('/api/v1/user', createAdminUserRouter(container.get<AdminUserController>('AdminUserController'), requireAuth));
  app.use('/api/v1/applications', createApplicationsRouter(container.get<ApplicationsController>('ApplicationsController'), requireAuth));
  app.use('/api/v1/applications', createApplicationSyncRouter(container.get<ApplicationSyncController>('ApplicationSyncController'), requireAuth));
  app.use('/api/v1/role', createRoleRouter(container.get<RoleController>('RoleController'), requireAuth));
  app.use('/api/v1/stats', createStatsRouter(container.get<StatsController>('StatsController'), requireAuth));
  app.use('/api/v1/app-resources', createAppResourceRouter(container.get<AppResourceController>('AppResourceController'), requireAuth));

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
