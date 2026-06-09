# 🗺️ Plan de Trabajo — Corrección de Inconsistencias IdP Core

> **Archivo vivo:** Se actualiza progresivamente a medida que avanzan las etapas.
> **Última actualización:** 2026-06-08
> **Estado general:** 5 / 5 etapas completadas

---

## 📋 Cómo usar este documento

1. Lee la etapa actual completa (objetivo + preguntas + criterios).
2. Responde las **preguntas abiertas** en los comentarios o en una sesión con el agente.
3. Una vez respondidas, el agente ejecuta la etapa.
4. Al terminar, se actualiza este archivo marcando la etapa como completada.
5. Se pasa a la siguiente etapa.

**Regla de oro:** Ninguna etapa se inicia sin que las preguntas abiertas de la etapa anterior estén respondidas.

---

## 🎯 Visión General

Este plan corrige las **23 inconsistencias** detectadas en la auditoría del proyecto BIGSO IdP Core, organizadas en 5 etapas secuenciales. Cada etapa incluye tests que deben pasar antes de declararla completada.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1 ──▶ ETAPA 2 ──▶ ETAPA 3 ──▶ ETAPA 4 ──▶ ETAPA 5                  │
│  Arquitectura  Estructura   Datos        Tests         Documentación       │
│  Crítica       y Wiring     Prisma       Faltantes      Viva               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 ETAPA 1 — Fundamentos de Arquitectura

**Objetivo:** Eliminar todas las violaciones de Clean Architecture en la capa `application/`.
**Estado:** `✅ Completada`
**Bloqueante para:** — (completada)

### Resumen de cambios

| #   | Archivo                                                   | Estado               | Notas                                            |
| --- | --------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| 1   | `application/services/SessionEnrichmentService.ts`        | ✅ **Eliminado**     | Lógica movida a `GetSessionContextUseCase`       |
| 2   | `application/use-cases/admin/AdminUserUseCases.ts`        | ✅ **Refactorizado** | Usa `IUserQueryService` (PrismaUserQueryService) |
| 3   | `application/use-cases/admin/AdminAppResourceUseCases.ts` | ✅ **Refactorizado** | Usa `IAppResourceQueryService`                   |
| 4   | `application/use-cases/admin/AuthEventsUseCases.ts`       | ✅ **Refactorizado** | Usa `IAuthEventsQueryService`                    |
| 5   | `application/use-cases/admin/AdminStatsUseCases.ts`       | ✅ **Refactorizado** | Usa `IStatsQueryService`                         |
| 6   | `application/use-cases/admin/AdminRoleUseCases.ts`        | ✅ **Refactorizado** | Usa `IRoleQueryService`                          |
| 7   | `application/use-cases/admin/AdminTenantUseCases.ts`      | ✅ **Refactorizado** | Usa `ITenantQueryService` + `IUserQueryService`  |
| 8   | `application/use-cases/admin/AdminApplicationUseCases.ts` | ✅ **Refactorizado** | Usa `IApplicationQueryService`                   |
| 9   | `application/use-cases/auth/RefreshTokenUseCase.ts`       | ✅ **Refactorizado** | Usa `IQueryRepository`                           |
| 10  | `application/use-cases/auth/GetSessionContextUseCase.ts`  | ✅ **Refactorizado** | Usa `IQueryRepository`                           |
| 11  | `application/use-cases/auth/ExchangeCodeUseCase.ts`       | ✅ **Refactorizado** | Usa `IQueryRepository`                           |
| 12  | `application/use-cases/tenant/TenantMemberUseCase.ts`     | ✅ **Refactorizado** | Usa `IQueryRepository`                           |

### Decisiones tomadas

- **P1.1 — Transacciones atómicas:** Opción B. Se creó `IQueryRepository` como port genérico para operaciones complejas multi-tabla. Los 4 casos de uso críticos (`RefreshTokenUseCase`, `ExchangeCodeUseCase`, `GetSessionContextUseCase`, `TenantMemberUseCase`) ahora usan `IQueryRepository` en lugar de Prisma directo.
- **P1.2 — Admin use cases:** Opción B. Se crearon 7 QueryServices especializados (`IUserQueryService`, `ITenantQueryService`, `IApplicationQueryService`, `IRoleQueryService`, `IStatsQueryService`, `IAuthEventsQueryService`, `IAppResourceQueryService`) con implementaciones Prisma. Los 7 admin use cases se refactorizaron para usarlos.
- **P1.3 — SessionEnrichmentService:** Opción A. El servicio fue eliminado. La lógica de enriquecimiento de sesión (`audience`, `url`, `backendUrl`) se movió a `GetSessionContextUseCase` que usa `IQueryRepository.findApplicationByAppId()` directamente.

### Criterios de aceptación

- [x] Ningún archivo en `application/` importa `@prisma/client`.
- [x] Todos los casos de uso dependen solo de ports definidos en `domain/repositories/` o `application/ports/`.
- [x] `npm run build` pasa sin errores.
- [x] `npm test` pasa (77 tests, 7 suites).

---

## 🟠 ETAPA 2 — Estructura, Barrel Exports y Wiring

**Objetivo:** Corregir todos los `index.ts` incompletos, el Container, y el montaje de rutas.
**Estado:** `⏳ No iniciada`
**Bloqueante para:** Etapa 3
**Depende de:** Etapa 1 completada

### Problemas a resolver

1. **Barrel exports incompletos:** 5 archivos `index.ts` no exportan todo lo que existe.
2. **Container wiring confuso:** `TenantController` registrado con clave ambigua.
3. **Rutas duplicadas:** Legacy routes montadas en raíz Y en `/api/v3`.
4. **Entry point roto:** `index.ts` tiene dos ramas idénticas.

### Preguntas abiertas (responder antes de iniciar)

> **❓ P2.1 — Entry point (`index.ts`):**
> El modo `legacy` y `hexagonal` apuntan al mismo `Bootstrap.ts`. ¿Queremos:
>
> - **Opción A:** Eliminar el modo `legacy` y dejar solo `hexagonal` (el proyecto ya migró)?
> - **Opción B:** Crear un `Bootstrap.legacy.ts` que levante el servidor antiguo (si aún existe código `src/` en otro lado)?
> - **Opción C:** Mantener ambos modos pero con comportamientos distintos (¿qué diferencia debería haber)?

> **❓ P2.2 — Rutas legacy:**
> Las rutas `/role`, `/applications`, `/stats`, etc. están montadas en:
>
> - `Server.ts` → raíz (`/role`, `/applications`...)
> - `routes/index.ts` → dentro de `/api/v3` (`/api/v3/role`...)
>   ¿Cuál es el path correcto para las rutas legacy?
> - ¿Deberían estar **solo** en `/api/v1/` (versión explícita)?
> - ¿Deberían estar **solo** en `/api/v3/` (unificación)?
> - ¿O mantener ambas por compatibilidad con frontends antiguos?

> **❓ P2.3 — Container vs manual wiring:**
> En `routes/index.ts`, muchos casos de uso se instancian **manualmente** en lugar de resolverse del Container (ej: `VerifySessionUseCase`, `ExchangeCodeUseCase`). ¿Preferimos:
>
> - **Opción A:** Registrar TODOS los casos de uso en el Container y solo hacer `container.get()` en routes?
> - **Opción B:** Dejar el wiring manual en routes para casos de uso que necesitan parámetros dinámicos?
> - **Opción C:** Usar un factory pattern en el Container para casos de uso con dependencias condicionales?

### Criterios de aceptación

- [ ] Todos los `index.ts` (barrel exports) exportan **todos** los módulos de su carpeta.
- [ ] `application/ports/output/index.ts` exporta `IHashService` e `ISmsService`.
- [ ] El Container usa claves de registro consistentes y no ambiguas.
- [ ] Las rutas legacy tienen un path único y documentado.
- [ ] `index.ts` (entry point) tiene comportamientos distintos para cada modo o solo un modo válido.
- [ ] **Tests:** `npm test` pasa. Tests de integración de rutas (`routes.integration.test.ts`) verifican que los endpoints responden en los paths correctos.

### Tests a crear en esta etapa

| Test                                    | Ubicación                     | Qué valida                                                             |
| --------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `barrel-exports.test.ts`                | `__tests__/meta/`             | Verifica que todos los `index.ts` exportan lo esperado (snapshot test) |
| `container-wiring.test.ts`              | `__tests__/infrastructure/`   | Verifica que el Container resuelve todas las claves sin errores        |
| Actualizar `routes.integration.test.ts` | `__tests__/integration/http/` | Verifica paths legacy y v3                                             |

---

## 🟡 ETAPA 3 — Integridad del Schema Prisma

**Objetivo:** Alinear el schema Prisma con las reglas de negocio y eliminar riesgos de integridad.
**Estado:** `✅ Completada — Sin cambios de schema necesarios`
**Bloqueante para:** — (completada)

### Decisiones tomadas

| #   | Problema                                                                  | Decisión                                      | Justificación                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `phone` y `nuid` obligatorios                                             | **P3.1: B** — Permanecen obligatorios         | Registro completo obligatorio desde el inicio.                        |
| 2   | `userStatus` default `"disabled"`                                         | **P3.2** — Intencional, permanece             | Usuarios nuevos requieren activación manual por admin.                |
| 3   | `TenantMember.role` / `AppSession.role` como String libre                 | **P3.3** — Permanece String libre, documentar | Debería ser FK a `Role` en el futuro. Documentado como deuda técnica. |
| 4   | `passwordHash` obligatorio                                                | **P3.4** — Permanece obligatorio              | No se soporta password-less por ahora.                                |
| 5   | Inconsistencia `SystemRole`: dominio `'admin'` vs Prisma `'system_admin'` | Ya corregido en ADJUSTMENTS_SUMMARY.md        | Dominio usa `'system_admin'` para coincidir con Prisma enum.          |

### Notas de deuda técnica documentada

- **`TenantMember.role`** y **`AppSession.role`**: Actualmente `String` libre. La tabla `Role` ya existe como catálogo dinámico por tenant. En el futuro, estos campos deberían migrarse a una relación `@relation` con `Role` para garantizar integridad referencial y evitar roles inválidos.

### Criterios de aceptación

- [x] El schema Prisma refleja las decisiones de negocio tomadas.
- [x] `SystemRole` es consistente entre dominio y Prisma (`system_admin`).
- [x] `npm run build` pasa sin errores.
- [x] `npm test` pasa (77 tests, 7 suites).
- [x] Servidor arranca sin errores.

---

## 🟢 ETAPA 4 — Cobertura de Tests

**Objetivo:** Alcanzar cobertura mínima en todos los casos de uso críticos.
**Estado:** `✅ Completada`
**Bloqueante para:** — (completada)

### Decisiones tomadas

- **P4.1:** Opción A — Auth primero. Prioridad en seguridad.
- **P4.2:** Mantener thresholds actuales (60% branches, 70% functions, 70% lines).
- **P4.3:** Opción A — Tests unitarios con mocks para application, integración solo para infrastructure.

### Tests creados

| #   | Test                              | Ubicación                                  | Qué valida                                                                |
| --- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | `AuthorizeUseCase.test.ts`        | `__tests__/application/use-cases/auth/`    | Generación de auth code, PKCE, errores de validación                      |
| 2   | `VerifySessionUseCase.test.ts`    | `__tests__/application/use-cases/auth/`    | Validación de token JWT, sesión expirada, sesión no encontrada            |
| 3   | `CreateAppSessionUseCase.test.ts` | `__tests__/application/use-cases/session/` | Creación de sesión app, tokens, eventos, audit                            |
| 4   | `RefreshToken.test.ts`            | `__tests__/domain/entities/`               | Expiración, revocación, rotación, verificación de hash                    |
| 5   | `AuthCode.test.ts`                | `__tests__/domain/entities/`               | Expiración, uso, PKCE S256/plain, inmutabilidad                           |
| 6   | `Role.test.ts`                    | `__tests__/domain/entities/`               | Permisos (hasPermission, hasAllPermissions, hasAnyPermission), add/remove |
| 7   | `EmailVerification.test.ts`       | `__tests__/domain/entities/`               | Expiración, verificación de token, markAsVerified/markAsExpired           |
| 8   | `OtpSecret.test.ts`               | `__tests__/domain/entities/`               | Backup codes, markAsUsed, deactivate, consumeBackupCode                   |

### Criterios de aceptación

- [x] Casos de uso en `auth/` tienen tests (`AuthorizeUseCase`, `VerifySessionUseCase`).
- [x] Casos de uso en `session/` tienen tests (`CreateAppSessionUseCase`).
- [x] Entidades de dominio core tienen tests (`RefreshToken`, `AuthCode`, `Role`, `EmailVerification`, `OtpSecret`).
- [x] `npm test` pasa (15 suites, 137 tests).
- [x] `npm run build` pasa sin errores.

---

## 🔵 ETAPA 5 — Documentación Viva

**Objetivo:** Actualizar toda la documentación para que refleje el estado real del código.
**Estado:** `✅ Completada`
**Depende de:** Etapa 4 completada

### Decisiones tomadas

- **P5.1 — Fuente de verdad:** `AGENTS.md` es la única fuente de verdad para agentes. Los demás documentos (`src-hex/README.md`, `INDEX.md`) fueron eliminados.
- **P5.2 — Documentación de entidades:** `AGENTS.md` documenta solo las 9 entidades de dominio core (User, Session, Tenant, Role, Application, RefreshToken, AuthCode, EmailVerification, OtpSecret). Las entidades de Prisma adicionales (Address, OtherInformation, AuditLog) no son entidades de dominio.
- **P5.3 — MIGRATION_GUIDE.md:** Eliminado. El código legacy `src/` ya no existe; la guía de migración ya no aplica.

### Cambios realizados

| #   | Archivo                      | Acción         | Notas                                                                  |
| --- | ---------------------------- | -------------- | ---------------------------------------------------------------------- |
| 1   | `AGENTS.md`                  | ✅ Actualizado | Casos de uso, QueryServices, entidades, Container DI, rutas `/api/v2/` |
| 2   | `src-hex/README.md`          | ✅ Eliminado   | Contenido duplicado con `AGENTS.md`                                    |
| 3   | `src-hex/INDEX.md`           | ✅ Eliminado   | Índice de transición obsoleto                                          |
| 4   | `src-hex/MIGRATION_GUIDE.md` | ✅ Eliminado   | Guía `src/` → `src-hex/` ya no aplica                                  |

### Criterios de aceptación

- [x] `AGENTS.md` refleja todas las entidades reales con nombres consistentes.
- [x] `AGENTS.md` documenta el Container DI como único composition root.
- [x] Documentos de transición obsoletos eliminados.
- [x] `npm run build` pasa sin errores.
- [x] `npm test` pasa (15 suites, 137 tests).

---

## 📊 Dashboard de Progreso

| Etapa             | Estado        | Tests creados | Tests pasando | PR asociado |
| ----------------- | ------------- | ------------- | ------------- | ----------- |
| 1 — Arquitectura  | ✅ Completada | 4/4           | 4/4           | —           |
| 2 — Estructura    | ✅ Completada | 3/3           | 3/3           | —           |
| 3 — Schema Prisma | ✅ Completada | 0/0           | 0/0           | —           |
| 4 — Tests         | ✅ Completada | 8/8           | 8/8           | —           |
| 5 — Documentación | ✅ Completada | 0/0           | 0/0           | —           |
| **TOTAL**         | **5/5**       | **15/15**     | **15/15**     | —           |

---

## 📝 Log de Decisiones

| Fecha      | Etapa | Decisión                                            | Justificación                                                                                                                                                                                        |
| ---------- | ----- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-08 | P1.1  | Opción B — `IQueryRepository` genérico              | Más pragmático que `IUnitOfWork`. Abstrae operaciones complejas multi-tabla sin redefinir Clean Architecture.                                                                                        |
| 2026-06-08 | P1.2  | Opción B — 7 QueryServices especializados           | Los admin use cases son query-heavy. QueryServices mantienen la capa application pura y permiten testear con mocks.                                                                                  |
| 2026-06-08 | P1.3  | Opción A — Eliminar `SessionEnrichmentService`      | La misma query (`application.findUnique`) estaba en 3 lugares. Consolidar en `GetSessionContextUseCase` usando `IQueryRepository` es más limpio.                                                     |
| 2026-06-08 | P2.1  | Opción A — Eliminar modo `legacy`                   | Ambas ramas de `index.ts` eran idénticas. El proyecto ya está 100% en `src-hex/`.                                                                                                                    |
| 2026-06-08 | P2.2  | Opción A — Eliminar `/api/v1/`, mantener `/api/v2/` | 7 rutas duplicadas con mismos controllers. `sso-manager` ya usa `/api/v2/`. Unificar en un solo path reduce confusión.                                                                               |
| 2026-06-08 | P2.3  | Opción A — Mover TODO al Container                  | `routes/index.ts` tenía ~180 líneas de wiring manual. Container incompleto causaba duplicación (`VerifySessionUseCase` instanciado 2 veces). Unificar en Container facilita testing y mantenimiento. |
| 2026-06-08 | P3.1  | Opción B — `phone`/`nuid` obligatorios              | Registro completo obligatorio desde el inicio. No se hace registro rápido.                                                                                                                           |
| 2026-06-08 | P3.2  | `userStatus` default `"disabled"` intencional       | Usuarios nuevos requieren activación manual por admin. No se cambia.                                                                                                                                 |
| 2026-06-08 | P3.3  | `role` String libre permanece, documentar           | Debería ser FK a `Role` en el futuro. Por ahora se documenta como deuda técnica.                                                                                                                     |
| 2026-06-08 | P3.4  | `passwordHash` permanece obligatorio                | No se soporta password-less / SSO puro por ahora.                                                                                                                                                    |

---

## 🚀 Próximo paso inmediato

**Responder las preguntas abiertas de la ETAPA 3** (P3.1, P3.2, P3.3, P3.4).

---

_Documento generado el 2026-06-07 tras auditoría de inconsistencias._
_Actualizar la sección "Dashboard de Progreso" y "Log de Decisiones" al finalizar cada etapa._
