# 🧭 Guía de Decisión — Preguntas Abiertas del Plan de Inconsistencias

> **Archivo temporal de apoyo** para responder las preguntas abiertas del plan.
> Lee cada sección, revisa el código de referencia, y elige una opción.
> Luego comunica tus respuestas al agente para iniciar la implementación.

---

## 🔴 ETAPA 1 — Fundamentos de Arquitectura

---

### ❓ P1.1 — Transacciones atómicas: ¿Cómo manejamos Prisma en casos de uso críticos?

**Contexto:** 3 casos de uso usan `PrismaClient` directamente porque necesitan **transacciones atómicas** (operaciones que deben fallar o succeed juntas).

#### Código actual — `RefreshTokenUseCase.ts`

```typescript
export class RefreshTokenUseCase {
  constructor(
    private refreshTokenRepository: IRefreshTokenRepository,
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService,
    private prisma: PrismaClient // ← VIOLACIÓN
  ) {}

  async execute(input: RefreshTokenInput): Promise<LoginResult> {
    // ... validaciones ...

    // 8. Atomic transaction: revoke old + create new
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: oldId }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          /* nuevo token */
        },
      }),
    ]);

    return { accessToken, refreshToken: newRefreshToken, expiresIn };
  }
}
```

#### Código actual — `ExchangeCodeUseCase.ts`

```typescript
export class ExchangeCodeUseCase {
  constructor(
    private authCodeRepository: IAuthCodeRepository,
    private sessionRepository: ISessionRepository,
    private userRepository: IUserRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private tokenService: ITokenService,
    private auditService: IAuditService,
    private eventBus: IEventBus,
    private hashService: IHashService,
    private prisma: PrismaClient, // ← VIOLACIÓN
    private sessionEnrichmentService: SessionEnrichmentService
  ) {}

  async execute(input: ExchangeCodeInput): Promise<LoginResult> {
    // ... validaciones de auth code ...

    // Lee Application table directamente
    const appRecord = await this.prisma.application.findUnique({
      where: { appId: input.appId },
      select: { audience: true, id: true, url: true, backendUrl: true },
    });

    // Crea sesión + refresh token en transacción
    const [session, refreshToken] = await this.prisma.$transaction([
      this.prisma.appSession.create({
        data: {
          /* ... */
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          /* ... */
        },
      }),
    ]);
  }
}
```

#### Código actual — `TenantMemberUseCase.ts`

```typescript
export class AddUserToTenantUseCase {
  constructor(
    private tenantRepository: ITenantRepository,
    private userRepository: IUserRepository,
    private prisma: PrismaClient,  // ← VIOLACIÓN
    private auditService: IAuditService,
    private eventBus: IEventBus
  ) {}

  async execute(input: AddUserToTenantInput): Promise<void> {
    // Upsert atómico de membership
    await this.prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
      create: { tenantId: input.tenantId, userId: input.userId, role: input.role, createdAt: new Date() },
      update: { role: input.role },
    });

    // Actualiza entidad de dominio
    const updatedUser = user.withTenantMembership({ ... });
    await this.userRepository.update(updatedUser);
  }
}
```

#### Opciones

| Opción                          | Descripción                                                                                                                                                                        | Pros                                                                                                        | Contras                                                                                            | Esfuerzo |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| **A — `IUnitOfWork`**           | Crear un port `IUnitOfWork` que abstraiga transacciones. Los repos se registran en una "unidad de trabajo" y se commitean juntos.                                                  | Arquitectura pura. Testeable con mocks. Desacopla totalmente de Prisma.                                     | Más código. Requiere rediseñar todos los repos para soportar "deferred operations".                | 🔴 Alto  |
| **B — `IQueryRepository`**      | Crear un port genérico `IQueryRepository` / `IDatabaseService` con métodos como `transaction()`, `query()`, `upsert()`. La implementación usa Prisma.                              | Pragmático. Mantiene abstracción sin rediseñar todo. Fácil de testear con un mock que simule transacciones. | No es "Clean Architecture purista". La capa application conoce el concepto de "query/transacción". | 🟡 Medio |
| **C — Mover a infraestructura** | Renombrar estos 3 casos de uso a `*Service`, moverlos a `infrastructure/services/`, y permitir que usen Prisma directamente. Crear ports delgados en application que los consuman. | Mínimo esfuerzo. Reconoce que "orquestación atómica de DB" es infraestructura, no application.              | Rompe la convención de que "casos de uso viven en application". Puede confundir a futuros devs.    | 🟢 Bajo  |

#### 💡 Recomendación del agente

> **Opción B (`IQueryRepository`)** es el mejor balance. Permite mantener los casos de uso en `application/` (donde conceptualmente pertenecen) sin acoplar a Prisma. La implementación de `IQueryRepository` en infraestructura usa `$transaction`, y en tests se mockea fácilmente.

---

### ❓ P1.2 — Admin use cases: ¿Son realmente casos de uso?

**Contexto:** Los 7 `Admin*UseCases` son clases que hacen queries complejas, agregaciones y CRUD administrativo. Ninguno usa entidades de dominio — hablan directamente con Prisma.

#### Código actual — `AdminUserUseCases.ts` (ejemplo representativo)

```typescript
export class AdminUserUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(query: any) {
    // Búsqueda paginada con filtros
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, orderBy, select: { ... } }),
      this.prisma.user.count({ where }),
    ]);
    return { users, pagination: { total, page, limit, totalPages } };
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: { addresses: true } });
  }

  async getUserTenantsWithApps(userId: string) {
    // Joins complejos: tenantMember → tenant → userAppAccess → application
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      include: { tenant: true },
    });
    // ... más queries anidadas
  }
}
```

#### Lista completa de admin use cases

| Archivo                       | Qué hace                                                 |
| ----------------------------- | -------------------------------------------------------- |
| `AdminUserUseCases.ts`        | Listar, buscar, ver detalle de usuarios. CRUD addresses. |
| `AdminTenantUseCases.ts`      | CRUD tenants. Listar members.                            |
| `AdminApplicationUseCases.ts` | CRUD applications. Listar por tenant.                    |
| `AdminRoleUseCases.ts`        | CRUD roles y permisos. Asignar permisos a roles.         |
| `AdminStatsUseCases.ts`       | Agregaciones: conteos, gráficos, métricas.               |
| `AuthEventsUseCases.ts`       | Queries de auditoría filtradas por fecha/tenant/usuario. |
| `AdminAppResourceUseCases.ts` | CRUD de recursos/acciones por aplicación.                |

#### Opciones

| Opción                                   | Descripción                                                                                                                                                   | Pros                                                                                                     | Contras                                                                                         | Esfuerzo |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| **A — Mantener como casos de uso**       | Dejarlos en `application/use-cases/admin/` pero inyectar `IQueryRepository` en lugar de `PrismaClient` (resuelve P1.1).                                       | Consistente con la estructura actual. No se mueven archivos.                                             | Conceptualmente incorrecto: no son "orquestación de dominio", son "queries de infraestructura". | 🟡 Medio |
| **B — Renombrar a QueryServices**        | Moverlos a `application/services/` como `AdminUserQueryService`, `AdminStatsQueryService`, etc.                                                               | Más semántico. "Services" pueden hacer queries libres.                                                   | Aún en application/, aún necesitan acceso a DB. No resuelve el problema fundamental.            | 🟡 Medio |
| **C — Mover a infrastructure/services/** | Crear `infrastructure/services/admin/` con `AdminUserService`, `AdminTenantService`, etc. Exponer interfaces en `application/ports/output/IAdmin*Service.ts`. | Arquitecturalmente correcto: queries complejas son infraestructura. Application solo consume interfaces. | Más carpetas. Más interfaces. Los controllers deben inyectar los nuevos ports.                  | 🔴 Alto  |
| **D — Híbrido: repos especializados**    | Crear repos en `domain/repositories/` como `IAdminUserRepository` con métodos `listUsers()`, `getUserTenantsWithApps()`. Implementar en Prisma.               | Mantiene todo en el patrón repository. Application depende de abstracciones.                             | Puede crear repos "gordos" con muchos métodos de query.                                         | 🟡 Medio |

#### 💡 Recomendación del agente

> **Opción D (repos especializados)** si queremos arquitectura pura. **Opción A** si queremos pragmatismo rápido. La diferencia real es mínima para el usuario final — ambas eliminan el import directo de `@prisma/client`.

---

### ❓ P1.3 — SessionEnrichmentService: ¿Dónde debe vivir?

**Contexto:** Este servicio lee la tabla `Application` para agregar `audience`, `url` y `backendUrl` a una `AppSession` cuando se crea o se lee.

#### Código actual

```typescript
export class SessionEnrichmentService {
  constructor(private prisma: PrismaClient) {}

  async enrich(session: Session): Promise<Session> {
    if (!(session instanceof AppSession)) return session;
    if (session.audience) return session; // ya enriquecida

    const appRecord = await this.prisma.application.findUnique({
      where: { appId: session.appId },
      select: { audience: true, url: true, backendUrl: true },
    });

    if (!appRecord) return session;

    // Crea NUEVA instancia de AppSession con datos enriquecidos
    return new AppSession(
      session.id,
      session.sessionToken,
      session.userId,
      session.tenantId,
      session.appId,
      session.role,
      session.ip,
      session.userAgent,
      session.expiresAt,
      session.createdAt,
      session.lastActivityAt,
      session.ssoSessionId,
      appRecord.audience ?? undefined,
      appRecord.url ?? undefined,
      appRecord.backendUrl ?? undefined
    );
  }
}
```

#### Opciones

| Opción                                    | Descripción                                                                                                                               | Pros                                                                                 | Contras                                                                                               | Esfuerzo |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| **A — Dentro de PrismaSessionRepository** | Al leer una `AppSession` desde el repo, automáticamente hacer el join con `Application` y devolver la sesión ya enriquecida.              | Un solo query. Transparente para el resto del código. No necesita servicio separado. | El repo de sesión se acopla al repo de aplicación. Si Application cambia, SessionRepo se ve afectado. | 🟢 Bajo  |
| **B — Port `ISessionEnrichmentService`**  | Definir `ISessionEnrichmentService` en `application/ports/output/`. Implementar en `infrastructure/services/SessionEnrichmentService.ts`. | Limpio arquitecturalmente. Application no conoce Prisma. Fácil de mockear.           | Más archivos (port + implementación).                                                                 | 🟡 Medio |
| **C — Mover a infrastructure/services/**  | Mover el archivo tal cual a `infrastructure/services/SessionEnrichmentService.ts`. No crear port (usar clase directamente).               | Mínimo cambio. Sale de application/.                                                 | No hay abstracción. Si cambia la implementación, hay que tocar los consumidores.                      | 🟢 Bajo  |

#### 💡 Recomendación del agente

> **Opción B (port + implementación)** si queremos seguir Clean Architecture al pie de la letra. **Opción A** si queremos menos complejidad y aceptamos que "leer una sesión implica leer su app".

---

## 🟠 ETAPA 2 — Estructura, Barrel Exports y Wiring

---

### ❓ P2.1 — Entry point (`index.ts`): ¿Qué hacemos con el modo legacy?

**Contexto:** El entry point tiene dos ramas idénticas.

#### Código actual — `index.ts`

```typescript
const MODE = (process.env.SSO_MODE ?? 'legacy').toLowerCase();

async function main(): Promise<void> {
  console.log(`\n🚀 SSO Core — mode: [${MODE.toUpperCase()}]\n`);

  if (MODE === 'hexagonal') {
    const { bootstrap } = await import('./src-hex/interfaces/http/Bootstrap');
    await bootstrap();
  } else {
    const { bootstrap } = await import('./src-hex/interfaces/http/Bootstrap');
    await bootstrap(); // ← EXACTAMENTE IGUAL
  }
}
```

#### Opciones

| Opción                                 | Descripción                                                                                        | Pros                                               | Contras                                                                                                               | Esfuerzo |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| **A — Eliminar legacy**                | Dejar solo `hexagonal`. Eliminar la variable `SSO_MODE` o ignorarla.                               | Simple. El proyecto ya está migrado. Menos código. | Si hay un frontend que envía `SSO_MODE=legacy`, fallará (aunque hoy ya fallaría igual porque apunta al mismo código). | 🟢 Bajo  |
| **B — Crear Bootstrap.legacy.ts**      | Si existe código `src/` en otro repo o rama, crear un entry point legacy real.                     | Soporta dualidad real.                             | Requiere que haya código legacy funcional. Si no existe, es trabajo innecesario.                                      | 🔴 Alto  |
| **C — Mantener ambos con diferencias** | `hexagonal` = servidor con todas las rutas. `legacy` = servidor con solo rutas v1 (sin `/api/v3`). | Permite despliegues paralelos.                     | Más mantenimiento. Dos configuraciones de servidor.                                                                   | 🟡 Medio |

#### 💡 Recomendación del agente

> **Opción A (eliminar legacy)**. El proyecto ya no tiene código `src/`. El modo legacy es un fantasma. Eliminarlo reduce confusión.

---

### ❓ P2.2 — Rutas legacy: ¿Dónde deben vivir?

**Contexto:** Las rutas legacy están montadas en DOS lugares.

#### Código actual — `Server.ts` monta en raíz

```typescript
// Server.ts
app.use('/role', createRoleRouter(roleController, requireAuth));
app.use('/applications', createApplicationsRouter(applicationsController, requireAuth));
app.use('/app-resources', createAppResourceRouter(appResourceController, requireAuth));
app.use('/metadata', createMetadataRouter(metadataController, requireAuth));
app.use('/applications', createApplicationSyncRouter(applicationSyncController, requireAuth));
app.use('/stats', createStatsRouter(statsController, requireAuth));
app.use('/util', createUtilRouter(utilController, requireAuth));
app.use('/user', createAdminUserRouter(userLegacyController, requireAuth));
app.use('/tenant', createAdminTenantRouter(tenantLegacyController, requireAuth));
```

#### Código actual — `routes/index.ts` monta en `/api/v3`

```typescript
// routes/index.ts (montado en /api/v3 en Server.ts)
router.use('/role', createRoleRouter(roleController, requireAuth));
router.use('/applications', createApplicationsRouter(applicationsController, requireAuth));
// ... mismas rutas
router.use('/user', createAdminUserRouter(userLegacyController, requireAuth));
router.use('/tenant', createAdminTenantRouter(tenantLegacyController, requireAuth));
```

#### Resultado: las rutas están en DOS paths

- `/role` y `/api/v3/role`
- `/applications` y `/api/v3/applications`
- etc.

#### Opciones

| Opción                  | Descripción                                                                                               | Pros                                                                                            | Contras                                                           | Esfuerzo                |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------- |
| **A — Solo `/api/v1/`** | Mover todas las rutas legacy a `/api/v1/`. Las rutas nuevas (login, register, etc.) quedan en `/api/v3/`. | Versionado explícito. Claro qué es legacy y qué es nuevo. Frontends antiguos saben que usan v1. | Requiere actualizar frontends que hoy usan `/role` (sin prefijo). | 🟡 Medio                |
| **B — Solo `/api/v3/`** | Eliminar el montaje en raíz de `Server.ts`. Todo queda en `/api/v3/`.                                     | Un solo path. Simple.                                                                           | Frontends antiguos que usan `/role` dejarán de funcionar.         | 🟢 Bajo                 |
| **C — Mantener ambas**  | Dejar las rutas en ambos paths "por compatibilidad".                                                      | Zero breaking changes.                                                                          | Desorden. Dos URLs para el mismo recurso. Documentación confusa.  | 🟢 Bajo (no hacer nada) |

#### 💡 Recomendación del agente

> **Opción B (solo `/api/v3/`)** si podemos coordinar con los frontends. **Opción A** si necesitamos mantener compatibilidad temporal y migrar frontends gradualmente.

---

### ❓ P2.3 — Container vs manual wiring: ¿Cómo resolvemos dependencias?

**Contexto:** En `routes/index.ts`, muchos casos de uso se instancian manualmente en lugar de resolverse del Container.

#### Código actual — `routes/index.ts`

```typescript
export function createRouter(container: Container): Router {
  // Estos se instancian MANUALMENTE (no del Container):
  const verifySessionUseCase = new VerifySessionUseCase(
    container.get('ISessionRepository'),
    container.get('ITokenService'),
    container.get('IAuditService')
  );

  const exchangeCodeUseCase = new ExchangeCodeUseCase(
    container.get('IAuthCodeRepository'),
    container.get('ISessionRepository'),
    // ... 8 dependencias más
    container.get('PrismaClient'),
    container.get<SessionEnrichmentService>('SessionEnrichmentService')
  );

  const authorizeUseCase = new AuthorizeUseCase(/* ... */);
  const updateProfileUseCase = new UpdateUserProfileUseCase(/* ... */);
  // ... etc

  // Estos SÍ vienen del Container:
  const loginUseCase = container.get('LoginUseCase');
  const logoutUseCase = container.get('LogoutUseCase');
}
```

#### Opciones

| Opción                          | Descripción                                                                                          | Pros                                                                                       | Contras                                                                                     | Esfuerzo                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------- |
| **A — Todo en Container**       | Registrar TODOS los casos de uso en `Container.ts` y solo usar `container.get()` en routes.          | Consistente. Un solo lugar para ver todas las dependencias. Fácil de testear el Container. | Container.ts se vuelve muy largo. Cada nuevo caso de uso requiere tocar Container + routes. | 🟡 Medio                |
| **B — Wiring manual en routes** | Dejar como está. Los casos de uso "simples" van al Container, los complejos se instancian en routes. | Flexible. Routes controla sus propias dependencias.                                        | Inconsistente. No hay un solo lugar para entender el wiring.                                | 🟢 Bajo (no hacer nada) |
| **C — Factory en Container**    | El Container expone factories: `container.createVerifySessionUseCase()`.                             | Best of both worlds. Container conoce cómo crear, routes decide cuándo.                    | Más código en Container. No es un patrón estándar de DI.                                    | 🟡 Medio                |

#### 💡 Recomendación del agente

> **Opción A (todo en Container)** para consistencia. El Container ya tiene ~40 registros; agregar 10 más no es un problema. La ventaja de tener TODO el wiring en un solo archivo supera el costo de un archivo más largo.

---

## 🟡 ETAPA 3 — Integridad del Schema Prisma

---

### ❓ P3.1 — Registro de usuarios: ¿phone y nuid obligatorios?

**Contexto:** En Prisma schema, `phone` y `nuid` son `String` (no opcionales). Esto fuerza a que todo registro incluya teléfono y número de identidad nacional.

#### Schema actual

```prisma
model User {
  id        String @id
  email     String @unique
  phone     String           // ← NO TIENE ? (obligatorio)
  nuid      String @unique   // ← NO TIENE ? (obligatorio)
  passwordHash String @map("password_hash")
  // ...
}
```

#### Implicaciones de cada opción

| Opción               | Impacto en registro                                                                                           | Impacto en DB                                                                            | Casos de uso afectados                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A — Opcionales**   | Registro rápido: email + password. Phone/nuid se piden luego (ej: en onboarding o verificación).              | Requiere migración: `phone String?` y `nuid String?` (quitar `@unique` o manejar nulls). | `RegisterUserUseCase`, frontend de signup, flujo de onboarding.        |
| **B — Obligatorios** | Registro completo desde el inicio. Más fricción, más datos desde día 1.                                       | Sin cambios en schema.                                                                   | Frontend de signup (ya debe enviar phone/nuid).                        |
| **C — Dos flujos**   | Registro rápido (email/pass) → cuenta "incompleta". Registro completo (con phone/nuid) → cuenta "verificada". | `phone String?`, `nuid String?`. Posible estado intermedio en User.                      | Más complejo: dos endpoints de registro, lógica de "completar perfil". |

#### 💡 Recomendación del agente

> **Opción A (opcionales)** si el producto busca reducir fricción de onboarding. **Opción B** si el negocio requiere identidad verificada desde el registro (ej: banca, gobierno).

---

### ❓ P3.2 — Estado inicial de usuarios: ¿disabled por defecto?

**Contexto:** `userStatus` default es `"disabled"`. Un usuario recién registrado **no puede hacer login** hasta que un administrador lo active.

#### Schema actual

```prisma
model User {
  // ...
  userStatus String @default("disabled") @map("user_status")
}
```

#### Flujo actual implícito

```
Usuario se registra → status = "disabled" → intenta login → ❌ RECHAZADO
                                    ↓
                              Admin lo activa → status = "active" → ✅ LOGIN OK
```

#### Opciones

| Opción                         | Descripción                                                                        | Impacto                                                       | Esfuerzo                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| **A — `"disabled"` (actual)**  | Requiere activación manual por admin. Máximo control. Alto fricción para usuarios. | Seguridad alta. Pero usuarios nuevos se frustran.             | Ninguno (ya es así).                                             |
| **B — `"pending"`**            | Puede hacer login pero con restricciones (ej: no acceder a ciertas apps).          | Balance. Permite explorar la plataforma mientras se verifica. | Medio: agregar lógica de "restricciones para pending".           |
| **C — `"active"`**             | Puede hacer login inmediatamente después de verificar email.                       | Mínima fricción. Estándar en SaaS.                            | Medio: cambiar default, agregar verificación de email como gate. |
| **D — Auto-activar con email** | `"disabled"` por defecto, pero al verificar email pasa a `"active"`.               | Automatiza la activación. No requiere admin.                  | Medio: modificar `VerifyEmailUseCase` para cambiar status.       |

#### 💡 Recomendación del agente

> **Opción D** si queremos automatización sin perder seguridad. **Opción C** si queremos el estándar SaaS (verificar email es suficiente). **Opción A** solo si hay un proceso de KYC/manual review obligatorio.

---

### ❓ P3.3 — Roles sin restricción: ¿Enum o tabla dinámica?

**Contexto:** `TenantMember.role` y `AppSession.role` son `String` libre. Cualquier valor es aceptado.

#### Schema actual

```prisma
model TenantMember {
  id       String @id
  tenantId String
  userId   String
  role     String   // ← SIN RESTRICCIÓN
}

model AppSession {
  id       String @id
  userId   String
  role     String   // ← SIN RESTRICCIÓN
}
```

#### Pero ya existe una tabla `Role` con permisos

```prisma
model Role {
  id       String @id
  tenantId String
  name     String
  permissions Permission[]
}
```

#### Opciones

| Opción                           | Descripción                                                                                   | Pros                                                                                 | Contras                                                                                                     | Esfuerzo |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | --------------------------------------------------- | ------- |
| **A — Enum Prisma**              | `role SystemRole` donde `SystemRole = user                                                    | admin                                                                                | super_admin                                                                                                 | editor`. | Simple. Validación en DB. Rápido de implementar. | Rígido. No permite roles personalizados por tenant. | 🟢 Bajo |
| **B — Relación a tabla `Role`**  | `TenantMember.role` deja de ser String y se convierte en `@relation` a `Role`.                | Flexible. Cada tenant define sus propios roles. Consistente con el resto del schema. | Migración más compleja. Requiere datos de migración (asignar un Role existente a cada TenantMember actual). | 🟡 Medio |
| **C — Validación en aplicación** | Mantener `String` en Prisma pero validar en `TenantMemberUseCase` contra una lista permitida. | Máxima flexibilidad. No toca schema.                                                 | Sin integridad referencial en DB. Riesgo de datos inconsistentes.                                           | 🟢 Bajo  |

#### 💡 Recomendación del agente

> **Opción B (relación a tabla `Role`)** si el producto necesita RBAC flexible por tenant. **Opción A** si los roles son fijos globalmente (ej: solo user/admin/super_admin).

---

### ❓ P3.4 — Password-less / SSO puro: ¿passwordHash opcional?

**Contexto:** `passwordHash` es obligatorio. Esto impide usuarios que nunca establecen password (login por OTP, magic link, Google OAuth, etc.).

#### Schema actual

```prisma
model User {
  // ...
  passwordHash String @map("password_hash")  // ← OBLIGATORIO
}
```

#### Opciones

| Opción                       | Descripción                       | Casos habilitados                                                                                        | Esfuerzo                                                         |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **A — Mantener obligatorio** | Todo usuario debe tener password. | Login clásico email+pass. OTP como 2FA, no como método primario.                                         | Ninguno.                                                         |
| **B — Opcional**             | `passwordHash String?`            | Login por OTP primario. Magic links. Federado (Google, SAML). Usuarios "invitados" sin password inicial. | Bajo: cambiar schema + ajustar `LoginUseCase` para manejar null. |

#### 💡 Recomendación del agente

> **Opción B** si el roadmap incluye passwordless o federado. **Opción A** si el producto es 100% email+password con OTP como 2FA secundario.

---

## 🟢 ETAPA 4 — Cobertura de Tests

---

### ❓ P4.1 — Prioridad de tests

**Contexto:** 15+ casos de uso sin tests. ¿Por dónde empezar?

#### Casos de uso sin tests, agrupados por criticidad

| Crítico (Seguridad)                                      | Alto (Onboarding)                                      | Medio (Admin)         |
| -------------------------------------------------------- | ------------------------------------------------------ | --------------------- |
| `AuthorizeUseCase` — Genera auth codes PKCE              | `RegisterUserUseCase` — Ya tiene test, pero incompleto | `AdminStatsUseCases`  |
| `VerifySessionUseCase` — Valida JWT                      | `UpdateUserUseCase` — Update profile + password        | `AdminUserUseCases`   |
| `CreateSSOSessionUseCase` — Sesión central               | `PasswordResetUseCase` — Forgot + reset flow           | `AdminTenantUseCases` |
| `ExchangeCodeUseCase` — PKCE exchange                    | `VerifyEmailUseCase` — Verificación de email           | `AdminRoleUseCases`   |
| `RefreshTokenUseCase` — Tiene test, pero usa Prisma real | `TenantMemberUseCase` — Add/change role                | `AuthEventsUseCases`  |

#### Opciones

| Opción                      | Orden                                                                                           | Justificación                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **A — Auth primero**        | 1. `AuthorizeUseCase`, `VerifySessionUseCase`, `ExchangeCodeUseCase`, `CreateSSOSessionUseCase` | Seguridad es lo más importante. Un bug en auth expone datos.          |
| **B — Admin primero**       | 1. `AdminStatsUseCases`, `AdminUserUseCases`, etc.                                              | Dashboards y operaciones internas son lo que usa el equipo día a día. |
| **C — User/Tenant primero** | 1. `UpdateUserUseCase`, `PasswordResetUseCase`, `TenantMemberUseCase`                           | Flujo de onboarding afecta conversión de usuarios.                    |

#### 💡 Recomendación del agente

> **Opción A (Auth primero)**. Los bugs en autenticación son los más costosos. Un usuario que no puede registrarse es molesto; un atacante que puede suplantar sesiones es un desastre.

---

### ❓ P4.2 — Nivel de cobertura mínima

**Contexto:** `jest.config.json` actual:

```json
"coverageThreshold": {
  "global": {
    "branches": 60,
    "functions": 70,
    "lines": 70
  }
}
```

#### Opciones

| Opción                    | Thresholds                                         | Justificación                                                                                        | Esfuerzo                                                   |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **A — Mantener actuales** | 60% branches, 70% functions/lines                  | Pragmático. No bloquea CI mientras se agregan tests.                                                 | Ninguno.                                                   |
| **B — Subir a 80% todo**  | 80% en todo                                        | Estándar enterprise. Asegura calidad consistente.                                                    | Alto: requiere escribir muchos tests para alcanzarlo.      |
| **C — Por capa**          | domain: 90%, application: 80%, infrastructure: 60% | Refleja prioridad: domain es pura lógica de negocio, debe estar 100% testeada. Infra es más volátil. | Medio: ajustar config de Jest para thresholds por carpeta. |

#### 💡 Recomendación del agente

> **Opción C** si queremos calidad diferenciada. **Opción A** si queremos avanzar rápido sin que CI nos bloquee.

---

### ❓ P4.3 — Tests de integración vs unitarios

#### Opciones

| Opción                          | Estrategia                                                                                               | Pros                                                                      | Contras                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **A — Unitarios con mocks**     | Application: mocks. Infrastructure: tests con DB real.                                                   | Rápidos. Aislados. Fáciles de debuggear.                                  | Los mocks pueden no reflejar la realidad de la DB.                          |
| **B — Integración con DB real** | Todos los casos de uso con DB real.                                                                      | Máxima confianza. Prueban queries reales.                                 | Lentos. Requieren setup/teardown de DB. Flaky en CI si la DB no está lista. |
| **C — Mix**                     | Unitarios para application. Integración para infra. E2E para flujos críticos (login → refresh → logout). | Balance. Los flujos críticos tienen máxima confianza. El resto es rápido. | Más configuración de Jest (diferentes setups).                              |

#### 💡 Recomendación del agente

> **Opción C (Mix)**. Es el estándar de la industria: unitarios para lógica de negocio, integración para persistencia, e2e para flujos críticos.

---

## 🔵 ETAPA 5 — Documentación Viva

---

### ❓ P5.1 — Fuente de verdad

**Contexto:** Hay 4+ documentos describiendo la arquitectura:

- `AGENTS.md` — Contexto para agentes de IA
- `src-hex/README.md` — Visión general hexagonal
- `src-hex/INDEX.md` — Índice de navegación
- `docs/shared/architecture.md` — Documentación técnica

#### Opciones

| Opción                                | Fuente de verdad                                     | Destino de los demás                                         |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | --- |
| **A — `AGENTS.md`**                   | Es el que leen los agentes. Debe ser el más preciso. | Los demás son derivados o se eliminan.                       |     |
| **B — `docs/shared/architecture.md`** | Documento "humano", más detallado.                   | `AGENTS.md` se genera a partir de él (resumen para agentes). |     |
| **C — READMEs internos**              | Cada capa documenta su propia estructura.            | Documento raíz es solo un índice.                            |     |

#### 💡 Recomendación del agente

> **Opción A**. `AGENTS.md` es el que los agentes leen en cada sesión. Si está desactualizado, las decisiones del agente serán incorrectas. Los demás documentos pueden ser derivados o archivados.

---

### ❓ P5.2 — Documentación de entidades

**Contexto:** `AGENTS.md` documenta 9 entidades. Prisma tiene 18 modelos.

#### Entidades documentadas vs reales

| Documentadas en AGENTS.md                                                                       | Reales en Prisma                                                                                               | Faltan en AGENTS.md |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| User, Session, Tenant, RefreshToken, Role, Application, TenantApp, EmailVerification, OtpSecret | + Address, OtherInformation, Permission, AppResource, UserAppAccess, AuditLog, AuthCode, SSOSession/AppSession | 7 modelos           |

#### Opciones

| Opción            | Qué documentar                                         | Justificación                                                                                                        |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **A — Solo core** | User, Session, Tenant, Role, Application, RefreshToken | Son las entidades de dominio puras. El resto son "tablas de soporte".                                                |
| **B — Todas**     | Las 18 entidades                                       | Un agente que no conoce `AuditLog` o `UserAppAccess` puede tomar decisiones incorrectas al tocar código relacionado. |

#### 💡 Recomendación del agente

> **Opción B (todas)**. El costo de documentar 7 entidades más es bajo. El costo de un agente desconociendo `AuditLog` y rompiendo auditoría es alto.

---

### ❓ P5.3 — MIGRATION_GUIDE.md

**Contexto:** Este archivo mapea `src/` → `src-hex/`, pero `src/` ya no existe.

#### Opciones

| Opción             | Acción                                                               | Justificación                                                                               |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **A — Archivar**   | Renombrar a `MIGRATION_GUIDE.archive.md`                             | Conserva historia. No confunde a nuevos devs.                                               |
| **B — Eliminar**   | Borrar el archivo                                                    | El proyecto ya migró. No aporta valor.                                                      |
| **C — Repurponer** | Convertirlo en guía de "cómo migrar código legacy dentro de src-hex" | Si aún hay código legacy por migrar (ej: los admin use cases que usan Prisma directamente). |

#### 💡 Recomendación del agente

> **Opción A (archivar)**. Ocupa poco espacio y puede ser útil para entender decisiones históricas. Renombrar a `.archive.md` deja claro que no es documentación activa.

---

## ✅ Cheat Sheet — Resumen rápido para responder

Copia esta tabla, marca tus elecciones, y envíala al agente.

| Pregunta                   | Opción A                | Opción B                 | Opción C            | Opción D                  |
| -------------------------- | ----------------------- | ------------------------ | ------------------- | ------------------------- |
| **P1.1** Transacciones     | `IUnitOfWork`           | `IQueryRepository` ⭐    | Mover a infra       | —                         |
| **P1.2** Admin use cases   | Mantener en application | Renombrar a services     | Mover a infra       | Repos especializados ⭐   |
| **P1.3** SessionEnrichment | En PrismaSessionRepo    | Port + implementación ⭐ | Mover a infra       | —                         |
| **P2.1** Entry point       | Eliminar legacy ⭐      | Bootstrap.legacy         | Mantener ambos      | —                         |
| **P2.2** Rutas legacy      | Solo `/api/v1/`         | Solo `/api/v3/` ⭐       | Mantener ambas      | —                         |
| **P2.3** Container wiring  | Todo en Container ⭐    | Manual en routes         | Factory             | —                         |
| **P3.1** phone/nuid        | Opcionales ⭐           | Obligatorios             | Dos flujos          | —                         |
| **P3.2** Estado inicial    | `"disabled"`            | `"pending"`              | `"active"`          | Auto-activar con email ⭐ |
| **P3.3** Roles             | Enum Prisma             | Relación a `Role` ⭐     | Validación en app   | —                         |
| **P3.4** passwordHash      | Obligatorio             | Opcional ⭐              | —                   | —                         |
| **P4.1** Prioridad tests   | Auth primero ⭐         | Admin primero            | User/Tenant primero | —                         |
| **P4.2** Cobertura         | Mantener 60-70%         | 80% todo                 | Por capa ⭐         | —                         |
| **P4.3** Tipo de tests     | Unitarios mocks         | Integración DB real      | Mix ⭐              | —                         |
| **P5.1** Fuente de verdad  | `AGENTS.md` ⭐          | `architecture.md`        | READMEs internos    | —                         |
| **P5.2** Entidades         | Solo core               | Todas ⭐                 | —                   | —                         |
| **P5.3** MIGRATION_GUIDE   | Archivar ⭐             | Eliminar                 | Repurponer          | —                         |

> ⭐ = Recomendación del agente (puedes ignorarla)

---

## 🚀 Cómo responder

1. Lee cada sección arriba.
2. Marca tus opciones en el Cheat Sheet.
3. Copia las filas que elegiste y pégalo en el chat con el agente.
4. El agente iniciará la **Etapa 1** con tus decisiones.

**Ejemplo de respuesta:**

```
Mis respuestas:
- P1.1: Opción B (IQueryRepository)
- P1.2: Opción D (Repos especializados)
- P1.3: Opción B (Port + implementación)
- P2.1: Opción A (Eliminar legacy)
- P2.2: Opción B (Solo /api/v3/)
- P2.3: Opción A (Todo en Container)
- P3.1: Opción A (phone/nuid opcionales)
- P3.2: Opción D (Auto-activar con email)
- P3.3: Opción B (Relación a Role)
- P3.4: Opción B (passwordHash opcional)
- P4.1: Opción A (Auth primero)
- P4.2: Opción C (Por capa)
- P4.3: Opción C (Mix)
- P5.1: Opción A (AGENTS.md)
- P5.2: Opción B (Todas)
- P5.3: Opción A (Archivar)
```

---

_Documento generado el 2026-06-07 como apoyo para el plan de inconsistencias._
