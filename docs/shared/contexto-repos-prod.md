# 🧭 Contexto Adicional para Decisiones — Basado en Repos en Producción

> **Archivo temporal de apoyo** — Contiene el análisis real de los repos `sso-portal`, `ordamy-frontend` y `ordamy-middleware` para responder P1.2, P1.3 y P2.2 con datos concretos.

---

## 🔴 P1.2 — Admin Use Cases: ¿Son realmente casos de uso?

### 📊 Hallazgo clave: Son "Query Services Legacy" consumidos solo por controllers V1

Los 7 `Admin*UseCases` **no son consumidos por ningún caso de uso de application**. Solo son usados por controllers legacy que exponen rutas `/api/v1/*`.

#### ¿Quién los consume?

| Admin Use Case             | Controller que lo consume                            | Rutas V1 expuestas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminUserUseCases`        | `AdminUserController`                                | `GET /api/v1/user/list`, `GET /api/v1/user/profile`, `GET /api/v1/user/:userId`, `GET /api/v1/user/tenants`, `PUT /api/v1/user/profile`, `PUT /api/v1/user/:userId/status`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `AdminTenantUseCases`      | `AdminTenantController`                              | `POST /api/v1/tenant`, `GET /api/v1/tenant`, `GET /api/v1/tenant/:tenantId`, `GET /api/v1/tenant/:tenantId/members`, `POST /api/v1/tenant/:tenantId/members`, `PUT /api/v1/tenant/:tenantId/members/:memberId`, `DELETE /api/v1/tenant/:tenantId/members/:memberId`, `PUT /api/v1/tenant/:tenantId`, `DELETE /api/v1/tenant/:tenantId`, `GET /api/v1/tenant/:tenantId/apps`, `POST /api/v1/tenant/:tenantId/apps`, `DELETE /api/v1/tenant/:tenantId/apps/:applicationId`                                                                                                                                                                                          |
| `AdminApplicationUseCases` | `ApplicationsController`                             | `GET /api/v1/applications`, `POST /api/v1/applications`, `GET /api/v1/applications/:id`, `PUT /api/v1/applications/:id`, `DELETE /api/v1/applications/:id`, `GET /api/v1/applications/tenant/:tenantId`, `POST /api/v1/applications/tenant/:tenantId`, `DELETE /api/v1/applications/tenant/:tenantId/:applicationId`, `GET /api/v1/applications/tenant/:tenantId/:applicationId/users`, `POST /api/v1/applications/tenant/:tenantId/:applicationId/users`, `POST /api/v1/applications/tenant/:tenantId/:applicationId/users/bulk`, `DELETE /api/v1/applications/tenant/:tenantId/:applicationId/users/:userId`, `GET /api/v1/applications/user/:tenantId/my-apps` |
| `AdminRoleUseCases`        | `RoleController`                                     | `POST /api/v1/role`, `GET /api/v1/role/:tenantId`, `GET /api/v1/role`, `GET /api/v1/role/:roleId`, `PUT /api/v1/role/:roleId`, `DELETE /api/v1/role/:roleId`, `POST /api/v1/role/:roleId/permissions`, `GET /api/v1/role/:roleId/permissions`, `DELETE /api/v1/role/:roleId/permissions/:permissionId`, `DELETE /api/v1/role/:roleId/permissions`                                                                                                                                                                                                                                                                                                                 |
| `AdminStatsUseCases`       | `StatsController`                                    | `GET /api/v3/stats/global`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `AuthEventsUseCases`       | `StatsController`                                    | `GET /api/v3/stats/auth-events`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `AdminAppResourceUseCases` | `AppResourceController`, `ApplicationSyncController` | `POST /api/v1/app-resources`, `GET /api/v1/app-resources/:appId`, `GET /api/v1/app-resources/tenant/:tenantId`, `POST /api/v1/applications/sync/:appId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 🔗 ¿Qué frontends consumen estas rutas V1?

#### `sso-portal` (Angular) — Consume TODAS las rutas V1

El portal de SSO está configurado con `useV2Auth: true` para autenticación (login, refresh, exchange), pero para **management** usa rutas V1:

```typescript
// sso-portal/src/app/core/services/role-management.service.ts
// Línea 17
`POST /api/v1/role` // createRole
`GET /api/v1/role/tenant/${tenantId}` // getTenantRoles
`GET /api/v1/role/${roleId}` // getRole, updateRole, deleteRole
`POST /api/v1/role/${roleId}/permission` // addPermission
`GET /api/v1/role/${roleId}/permission` // getRolePermissions
`DELETE /api/v1/role/${roleId}/permission/${permissionId}` // removePermission
`DELETE /api/v1/role/${roleId}/permission` // removePermissionByResourceAction
// sso-portal/src/app/core/services/tenant-management.service.ts
// Línea 22
`GET /api/v1/tenant` // getAllTenants
`GET /api/v1/tenant/${tenantId}` // getTenant
`POST /api/v1/tenant` // createTenant
`PUT /api/v1/tenant/${tenantId}` // updateTenant
`GET /api/v1/tenant/${tenantId}/members` // getTenantMembers
`POST /api/v1/tenant/${tenantId}/members` // inviteMember
`PUT /api/v1/tenant/${tenantId}/members/${memberId}` // updateMemberRole
`DELETE /api/v1/tenant/${tenantId}/members/${memberId}` // removeMember
// sso-portal/src/app/core/services/application-management.service.ts
// Línea 20
`GET /api/v1/applications` // getAllApplications
`GET /api/v1/applications/${id}` // getApplication
`POST /api/v1/applications` // createApplication
`PUT /api/v1/applications/${id}` // updateApplication
`DELETE /api/v1/applications/${id}` // deleteApplication
`GET /api/v1/applications/by-app-id/${appId}` // getApplicationByAppId
`POST /api/v1/applications/${appId}/sync-resources` // syncResources
// sso-portal/src/app/core/services/user-management.service.ts
// Línea 28
`GET /api/v1/user/list` // getUsers
// sso-portal/src/app/core/services/stats-management.service.ts
// Línea 20
`GET /api/v1/stats` // getGlobalStats
// sso-portal/src/app/core/services/app-resource.service.ts
// Línea 20
`POST /api/v1/app-resources` // registerAppResources
`GET /api/v1/app-resources/${appId}` // getAppResources
`GET /api/v1/app-resources/tenant/${tenantId}/available`; // getAvailableResourcesForTenant
```

#### `ordamy-frontend` y `ordamy-middleware` — NO consumen rutas V1 directamente

- `ordamy-frontend` llama a su middleware (`middlewareBaseUrl`) para auth
- El middleware usa el SDK Node (`@bigso/auth-sdk`) que llama a `/api/v2/auth/*`
- **No hay referencias a `/api/v1/role`, `/api/v1/tenant`, `/api/v1/applications` en ordamy**

### 📋 Conclusión para P1.2

Los `Admin*UseCases` son **servicios de query legacy** que:

1. **No son casos de uso de dominio** (no orquestan reglas de negocio, solo hacen CRUD/listados)
2. **Son consumidos exclusivamente por controllers V1** que expone rutas legacy
3. **Son necesarios para `sso-portal`** — si se rompen, el portal de administración deja de funcionar
4. **Usan Prisma directamente** porque son queries complejas que no encajan en el patrón repository puro

**Recomendación:** Tratalos como **Application Services** (no casos de uso). Moverlos a `application/services/admin/` o `infrastructure/services/admin/` y exponer interfaces desde `application/ports/output/`. Esto mantiene la arquitectura limpia sin romper `sso-portal`.

---

## 🔴 P1.3 — SessionEnrichmentService: ¿Dónde debe vivir?

### 📊 Hallazgo clave: Solo 2 consumidores, y uno NO lo usa

#### ¿Quién lo consume?

| #   | Archivo                       | Uso real                                                                          |
| --- | ----------------------------- | --------------------------------------------------------------------------------- |
| 1   | `GetSessionContextUseCase.ts` | **SÍ lo usa** — llama `this.sessionEnrichmentService.enrich(session)` en línea 73 |
| 2   | `ExchangeCodeUseCase.ts`      | **NO lo usa** — recibido por constructor pero **nunca invocado**                  |

#### ¿Qué hace exactamente?

```typescript
// SessionEnrichmentService.ts
async enrich(session: Session): Promise<Session> {
  if (!(session instanceof AppSession)) return session;
  if (session.audience) return session;  // ya enriquecida

  const appRecord = await this.prisma.application.findUnique({
    where: { appId: session.appId },
    select: { audience: true, url: true, backendUrl: true },
  });

  if (!appRecord) return session;

  // Crea NUEVA instancia de AppSession con datos enriquecidos
  return new AppSession(
    session.id, session.sessionToken, session.userId, session.tenantId,
    session.appId, session.role, session.ip, session.userAgent,
    session.expiresAt, session.createdAt, session.lastActivityAt,
    session.ssoSessionId,
    appRecord.audience ?? undefined,
    appRecord.url ?? undefined,
    appRecord.backendUrl ?? undefined
  );
}
```

#### 🔴 Hallazgo crítico: Duplicación de código

`ExchangeCodeUseCase.ts` (línea 76) hace **exactamente el mismo query** que `SessionEnrichmentService`, pero inline:

```typescript
// ExchangeCodeUseCase.ts — línea 76
const appRecord = await this.prisma.application.findUnique({
  where: { appId: input.appId },
  select: { audience: true, id: true, url: true, backendUrl: true },
});
```

Esto significa que:

1. `ExchangeCodeUseCase` recibe `SessionEnrichmentService` por constructor pero **nunca lo usa**
2. En su lugar, duplica la lógica de enriquecimiento con su propio query a Prisma
3. Hay **2 lugares** donde se hace el mismo query a `Application` (duplicación)

#### ¿Quién más hace queries a `Application` en application/?

| Archivo                       | Línea | Query                                                                                            |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `SessionEnrichmentService.ts` | 32    | `prisma.application.findUnique({ where: { appId }, select: { audience, url, backendUrl } })`     |
| `ExchangeCodeUseCase.ts`      | 76    | `prisma.application.findUnique({ where: { appId }, select: { audience, id, url, backendUrl } })` |
| `GetSessionContextUseCase.ts` | 123   | `prisma.application.findUnique({ where: { appId }, select: { id } })`                            |
| `RefreshTokenUseCase.ts`      | 192   | `prisma.application.findUnique({ where: { appId }, select: { id } })`                            |

#### 📋 Conclusión para P1.3

`SessionEnrichmentService` es un **servicio de infraestructura disfrazado de application**. Lo correcto es:

1. **Moverlo a `infrastructure/services/`** (donde puede usar Prisma libremente)
2. **Crear un port `ISessionEnrichmentService`** en `application/ports/output/` para que los casos de uso dependan de la abstracción
3. **Eliminar la duplicación en `ExchangeCodeUseCase`** — hacer que use `SessionEnrichmentService.enrich()` en lugar del query inline
4. **Eliminar `PrismaClient` de `GetSessionContextUseCase`** — inyectar `ISessionEnrichmentService` en su lugar

**Impacto en producción:** Ninguno. `ordamy` no usa `SessionEnrichmentService` directamente (va por SDK). `sso-portal` tampoco lo consume directamente.

---

## 🟠 P2.2 — Rutas Legacy: ¿Dónde deben vivir?

### 📊 Hallazgo clave: `sso-portal` depende de rutas V1 en raíz

#### ¿Cómo están montadas hoy?

En `Server.ts`:

```typescript
app.use('/role', createRoleRouter(...));           // → /role
app.use('/applications', createApplicationsRouter(...));  // → /applications
app.use('/app-resources', createAppResourceRouter(...));  // → /app-resources
app.use('/stats', createStatsRouter(...));         // → /stats
app.use('/user', createAdminUserRouter(...));      // → /user
app.use('/tenant', createAdminTenantRouter(...));  // → /tenant
```

En `routes/index.ts` (montado en `/api/v3`):

```typescript
router.use('/role', createRoleRouter(...));        // → /api/v3/role
router.use('/applications', createApplicationsRouter(...)); // → /api/v3/applications
// ... etc
```

#### ¿Qué rutas consume `sso-portal`?

El `sso-portal` hace requests a:

- `/api/v1/role/*` — RoleManagementService
- `/api/v1/tenant/*` — TenantManagementService
- `/api/v1/applications/*` — ApplicationManagementService
- `/api/v1/user/*` — UserManagementService, ApplicationsService
- `/api/v1/stats` — StatsManagementService
- `/api/v1/app-resources/*` — AppResourceService

**PERO** el backend actual NO tiene prefijo `/api/v1/` para estas rutas. Están en:

- `/role` (raíz)
- `/tenant` (raíz)
- `/applications` (raíz)
- `/user` (raíz)
- `/stats` (raíz)
- `/app-resources` (raíz)

#### 🔴 Problema: ¿Cómo funciona hoy?

Hay dos posibilidades:

1. **Hay un proxy/nginx** que reescribe `/api/v1/*` → `/*` (raíz)
2. **El `sso-portal` apunta a una URL base diferente** que ya incluye el path

Revisando el código de `sso-portal`:

```typescript
// environments/environment.ts
baseUrl: 'https://sso-core.bigso.test'

// role-management.service.ts
this.http.post(`${environment.baseUrl}/api/v1/role`, ...)
```

Esto significa que el request va a `https://sso-core.bigso.test/api/v1/role`.

Si el backend NO tiene `/api/v1/role`, esto devolvería 404... **a menos que** haya un proxy/nginx que reescriba `/api/v1/*` → `/*`.

#### ¿Qué rutas consume `ordamy`?

`ordamy-frontend` y `ordamy-middleware` NO consumen rutas V1. Solo usan:

- `/api/v2/auth/*` (vía SDK Node)
- `/api/auth/*` (rutas propias del middleware)
- `/api/tenants/public/*` (rutas propias del middleware)

#### 📋 Conclusión para P2.2

**Opción recomendada: `/api/v1/` explícito**

1. Las rutas legacy deben estar en `/api/v1/` (no en raíz ni en `/api/v3/`)
2. Esto coincide con lo que `sso-portal` espera (`/api/v1/role`, `/api/v1/tenant`, etc.)
3. Elimina la duplicación (ya no estarán en raíz)
4. Las rutas V3 (`/api/v3/auth/login`, etc.) son las nuevas, limpias, hexagonales
5. Si hay un proxy/nginx reescribiendo hoy, podemos eliminar esa regla

**Impacto en producción:**

- `sso-portal`: ✅ Funciona sin cambios (ya usa `/api/v1/`)
- `ordamy`: ✅ Sin impacto (no usa rutas V1)
- `idp-core`: ✅ Más limpio, rutas versionadas explícitamente

---

## 📝 Resumen de Recomendaciones para tus Respuestas

| Pregunta | Recomendación basada en análisis de repos                               | Justificación                                                                                                         |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **P1.2** | Opción D (Repos especializados) **o** Opción C (Mover a infra/services) | Son query services, no casos de uso. Solo controllers V1 los consumen.                                                |
| **P1.3** | Opción B (Port + implementación en infra)                               | Servicio de infraestructura disfrazado. Duplicación con ExchangeCodeUseCase. Ningún frontend lo consume directamente. |
| **P2.2** | Opción A (Solo `/api/v1/`)                                              | `sso-portal` ya usa `/api/v1/*`. Elimina duplicación de rutas. `ordamy` no se ve afectado.                            |

---

_Documento generado el 2026-06-07 tras análisis de sso-portal, ordamy-frontend y ordamy-middleware._
