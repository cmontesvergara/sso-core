# Interfaces Layer - Adaptadores al Mundo Exterior

> **Regla:** Esta capa adapta el mundo exterior (HTTP, CLI, Events) para que pueda hablar con la aplicación.

---

## 📁 http/

**Qué va aquí:** Configuración y bootstrap del servidor HTTP Express.

**Desde la implementación actual:**

- `server.ts` actual → `http/Server.ts`
- `index.ts` (entry point) → `http/Bootstrap.ts`

**Ejemplo:**

```typescript
// http/Server.ts
export class Server {
  private app: Express;
  private container: Container;

  constructor(container: Container) {
    this.app = express();
    this.container = container;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
      })
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(cookieParser());
    this.app.use(loggingMiddleware);
  }

  private setupRoutes(): void {
    // JWKS endpoint público
    this.app.get('/.well-known/jwks.json', (_req, res) => {
      const jwksProvider = this.container.get<JwksProvider>('JwksProvider');
      res.json(jwksProvider.getJwks());
    });

    // Health checks
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    this.app.get('/ready', (_req, res) => {
      // Verificar conexiones a DB, Redis, etc
      res.json({ status: 'OK' });
    });

    // API routes
    const routes = createRoutes(this.container);
    this.app.use('/api/v2', routes);

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });
  }

  private setupErrorHandling(): void {
    const errorHandler = this.container.get<ErrorHandlerMiddleware>('ErrorHandlerMiddleware');
    this.app.use(errorHandler);
  }

  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

// http/Bootstrap.ts (entry point)
import { setupContainer } from '../infrastructure/config/Container';
import { Server } from './Server';

async function bootstrap(): Promise<void> {
  // Validar variables de entorno
  validateEnv();

  // Setup dependency injection
  const container = setupContainer();

  // Crear y iniciar servidor
  const server = new Server(container);
  server.start(parseInt(process.env.PORT || '3000'));
}

bootstrap().catch(console.error);
```

---

## 📁 cli/

**Qué va aquí:** Comandos de CLI para administración.

**Desde la implementación actual:**

- Scripts de migración → `cli/commands/MigrateCommand.ts`
- Scripts de seed → `cli/commands/SeedCommand.ts`
- Scripts de limpieza → `cli/commands/CleanupCommand.ts`

**Ejemplo:**

```typescript
// cli/commands/MigrateCommand.ts
export class MigrateCommand {
  constructor(private migratorService: IMigratorService) {}

  async execute(): Promise<void> {
    console.log('Running migrations...');
    await this.migratorService.migrate();
    console.log('Migrations complete!');
  }
}

// cli/commands/CleanupExpiredSessionsCommand.ts
export class CleanupExpiredSessionsCommand {
  constructor(private sessionRepository: ISessionRepository) {}

  async execute(): Promise<void> {
    console.log('Cleaning up expired sessions...');
    const count = await this.sessionRepository.deleteExpired();
    console.log(`Deleted ${count} expired sessions`);
  }
}

// cli/Cli.ts (entry point para CLI)
import { Command } from 'commander';

const program = new Command();

program
  .command('migrate')
  .description('Run database migrations')
  .action(async () => {
    const container = setupContainer();
    const command = new MigrateCommand(container.get('IMigratorService'));
    await command.execute();
  });

program
  .command('cleanup:sessions')
  .description('Remove expired sessions')
  .action(async () => {
    const container = setupContainer();
    const command = new CleanupExpiredSessionsCommand(container.get('ISessionRepository'));
    await command.execute();
  });

program.parse();
```

---

## 📁 events/

**Qué va aquí:** Listeners para eventos de dominio.

**Desde la implementación actual:**

- Eventos de sesión → `events/handlers/SessionEventHandlers.ts`
- Eventos de usuario → `events/handlers/UserEventHandlers.ts`
- Eventos de seguridad → `events/handlers/SecurityEventHandlers.ts`

**Ejemplo:**

```typescript
// events/handlers/SessionEventHandlers.ts
export class SessionEventHandlers {
  constructor(
    private auditService: IAuditService,
    private emailService: IEmailService
  ) {}

  onUserLoggedIn(event: UserLoggedInEvent): Promise<void> {
    // Loguear auditoría
    await this.auditService.log({
      type: 'USER_LOGIN',
      userId: event.userId.value,
      tenantId: event.tenantId.value,
      timestamp: event.occurredAt,
    });

    // Enviar notificación de nuevo dispositivo si es necesario
    // ...
  }

  onSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    await this.auditService.logSecurity({
      type: 'SESSION_REVOKED',
      sessionId: event.sessionId.value,
      reason: event.reason,
    });
  }
}

// events/EventBus.ts
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, Function[]>();

  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.constructor.name) || [];
    await Promise.all(handlers.map((h) => h(event)));
  }
}

// events/setupEventHandlers.ts
export const setupEventHandlers = (container: Container): void => {
  const eventBus = container.get<IEventBus>('IEventBus');
  const sessionHandlers = new SessionEventHandlers(
    container.get('IAuditService'),
    container.get('IEmailService')
  );

  eventBus.subscribe('UserLoggedInEvent', sessionHandlers.onUserLoggedIn.bind(sessionHandlers));
  eventBus.subscribe('SessionRevokedEvent', sessionHandlers.onSessionRevoked.bind(sessionHandlers));
};
```

---

## Checklist Interfaces Layer

- [ ] `http/` configura Express y rutas sin lógica de negocio
- [ ] `cli/` provee comandos para tareas administrativas
- [ ] `events/` conecta eventos de dominio a handlers
- [ ] Todo es wiring/adaptación, no hay lógica de aplicación aquí
- [ ] Cada adaptador (HTTP, CLI, Events) puede coexistir sin conflicto
