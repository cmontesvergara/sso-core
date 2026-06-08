# 🗺️ Plan de Trabajo — Corrección de Inconsistencias IdP Core

> **Archivo vivo:** Se actualiza progresivamente a medida que avanzan las etapas.
> **Última actualización:** 2026-06-07
> **Estado general:** 0 / 5 etapas completadas

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
**Estado:** `🔄 En progreso — 4/12 archivos refactorizados`
**Bloqueante para:** Etapa 2

### Problema a resolver

12 archivos en `src-hex/application/` importan `PrismaClient` directamente desde `@prisma/client`. Esto rompe la regla de que `application/` solo puede depender de `domain/`.

### Archivos afectados

| #   | Archivo                                                   | Estado               | Uso actual de Prisma                             |
| --- | --------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| 1   | `application/services/SessionEnrichmentService.ts`        | ⏳ Pendiente         | Lee `Application` table para enriquecer sesiones |
| 2   | `application/use-cases/admin/AdminUserUseCases.ts`        | ⏳ Pendiente         | CRUD users, addresses, búsquedas complejas       |
| 3   | `application/use-cases/admin/AdminAppResourceUseCases.ts` | ⏳ Pendiente         | CRUD app resources                               |
| 4   | `application/use-cases/admin/AuthEventsUseCases.ts`       | ⏳ Pendiente         | Queries de auditoría                             |
| 5   | `application/use-cases/admin/AdminStatsUseCases.ts`       | ⏳ Pendiente         | Agregaciones de stats                            |
| 6   | `application/use-cases/admin/AdminRoleUseCases.ts`        | ⏳ Pendiente         | CRUD roles y permisos                            |
| 7   | `application/use-cases/admin/AdminTenantUseCases.ts`      | ⏳ Pendiente         | CRUD tenants y members                           |
| 8   | `application/use-cases/admin/AdminApplicationUseCases.ts` | ⏳ Pendiente         | CRUD applications                                |
| 9   | `application/use-cases/auth/RefreshTokenUseCase.ts`       | ✅ **Refactorizado** | ~~Transacción Prisma~~ → `IQueryRepository`      |
| 10  | `application/use-cases/auth/GetSessionContextUseCase.ts`  | ✅ **Refactorizado** | ~~Lookup app data~~ → `IQueryRepository`         |
| 11  | `application/use-cases/auth/ExchangeCodeUseCase.ts`       | ✅ **Refactorizado** | ~~Transacción atómica~~ → `IQueryRepository`     |
| 12  | `application/use-cases/tenant/TenantMemberUseCase.ts`     | ✅ **Refactorizado** | ~~Upsert TenantMember~~ → `IQueryRepository`     |

### Preguntas abiertas (responder antes de iniciar)

> **❓ P1.1 — Transacciones atómicas:**
> `RefreshTokenUseCase`, `ExchangeCodeUseCase` y `TenantMemberUseCase` usan transacciones Prisma (`$transaction`) para garantizar atomicidad. ¿Queremos:
>
> - **Opción A:** Crear un port `IUnitOfWork` que abstraiga transacciones (más limpio, más trabajo)?
> - **Opción B:** Aceptar que ciertos casos de uso lean/escriban directamente a través de un port genérico `IQueryRepository` (más pragmático)?
> - **Opción C:** Mover estos 3 casos de uso a `infrastructure/` y dejarlos como "application services" que sí pueden tocar Prisma (redefinir la regla)?

> **❓ P1.2 — Admin use cases:**
> Los 7 `Admin*UseCases` son esencialmente "query services" que hacen búsquedas complejas, agregaciones y listados. ¿Son realmente **casos de uso** o deberían renombrarse a `*QueryService` y vivir en `infrastructure/services/` o `application/services/`?

> **❓ P1.3 — SessionEnrichmentService:**
> Este servicio lee la tabla `Application` para agregar `audience`/`url` a una `AppSession`. ¿Debería:
>
> - Ser parte del `PrismaSessionRepository` (la sesión ya se enriquece al leerse)?
> - Ser un port `ISessionEnrichmentService` con implementación en infraestructura?
> - Mantenerse como está pero movido a `infrastructure/services/`?

### Criterios de aceptación

- [ ] Ningún archivo en `application/` importa `@prisma/client`.
- [ ] Todos los casos de uso dependen solo de ports definidos en `domain/repositories/` o `application/ports/`.
- [ ] **Tests:** Todos los casos de uso afectados tienen tests unitarios con mocks (no tocan DB real).
- [ ] `npm run build` pasa sin errores.
- [ ] `npm test` pasa (tests existentes no se rompen).

### Tests a crear en esta etapa

| Test                               | Ubicación                                 | Qué valida                                         |
| ---------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| `ExchangeCodeUseCase.test.ts`      | `__tests__/application/use-cases/auth/`   | Intercambio PKCE con mocks de repos                |
| `GetSessionContextUseCase.test.ts` | `__tests__/application/use-cases/auth/`   | Recuperación de contexto de sesión                 |
| `TenantMemberUseCase.test.ts`      | `__tests__/application/use-cases/tenant/` | Add/change role con mocks                          |
| `RefreshTokenUseCase.test.ts`      | `__tests__/application/use-cases/auth/`   | Actualizar test existente para no usar Prisma real |

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
**Estado:** `⏳ No iniciada`
**Bloqueante para:** Etapa 4
**Depende de:** Etapa 2 completada

### Problemas a resolver

1. Campos obligatorios que deberían ser opcionales (`phone`, `nuid`, `passwordHash`).
2. Campos `String` libres sin restricción (`TenantMember.role`, `AppSession.role`).
3. `backupCodes` sin default.
4. `userStatus` default `"disabled"` — todos los usuarios nuevos quedan inactivos.
5. Inconsistencia `SystemRole`: dominio usa `'admin'`, Prisma usa `'system_admin'`.

### Preguntas abiertas (responder antes de iniciar)

> **❓ P3.1 — Registro de usuarios:**
> `phone` y `nuid` son obligatorios en Prisma. ¿El sistema debe soportar:
>
> - **Opción A:** Registro **solo** con email + password (phone/nuid opcionales, se piden luego)?
> - **Opción B:** Registro **completo** obligatorio (email + password + phone + nuid desde el inicio)?
> - **Opción C:** Dos flujos: registro rápido (email/pass) y registro completo (con phone/nuid)?

> **❓ P3.2 — Estado inicial de usuarios:**
> `userStatus` default es `"disabled"`. Esto significa que después de registrarse, un usuario **no puede hacer login** hasta que un admin lo active. ¿Es esto intencional?
>
> - ¿Debería ser `"pending"` (puede login pero con restricciones)?
> - ¿Debería ser `"active"` (puede login inmediatamente después de verificar email)?
> - ¿El flujo de verificación de email debería activar automáticamente la cuenta?

> **❓ P3.3 — Roles sin restricción:**
> `TenantMember.role` y `AppSession.role` son `String` libre. ¿Tenemos un catálogo fijo de roles?
>
> - ¿Debería ser un enum Prisma (`user`, `admin`, `super_admin`, `editor`, etc.)?
> - ¿O una tabla `Role` dinámica por tenant (como ya existe) y `TenantMember.role` debería ser una relación `@relation` a `Role` en lugar de un String?

> **❓ P3.4 — Password-less / SSO puro:**
> `passwordHash` es obligatorio. ¿Queremos soportar usuarios que nunca tengan password (ej: login solo por OTP, magic link, o federado)?
>
> - Si sí, `passwordHash` debe ser opcional.
> - Si no, mantener obligatorio.

### Criterios de aceptación

- [ ] El schema Prisma refleja las decisiones de negocio tomadas en las preguntas anteriores.
- [ ] Todos los campos `String` libres que representan roles/estados tienen restricciones (enum o relación).
- [ ] Migración Prisma generada y aplicada sin pérdida de datos.
- [ ] Entidades de dominio actualizadas para coincidir con el nuevo schema.
- [ ] **Tests:** Tests de integración con DB real verifican que las restricciones funcionan.

### Tests a crear en esta etapa

| Test                                    | Ubicación                   | Qué valida                                           |
| --------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `user-registration-constraints.test.ts` | `__tests__/integration/db/` | Registro con/sin phone/nuid, comportamiento esperado |
| `role-enforcement.test.ts`              | `__tests__/integration/db/` | Insertar `TenantMember` con rol inválido debe fallar |
| `user-status-flow.test.ts`              | `__tests__/integration/db/` | Flujo: registro → verificación → activación          |

---

## 🟢 ETAPA 4 — Cobertura de Tests

**Objetivo:** Alcanzar cobertura mínima en todos los casos de uso críticos.
**Estado:** `⏳ No iniciada`
**Bloqueante para:** Etapa 5
**Depende de:** Etapa 3 completada

### Problema a resolver

Solo 7 tests existen. Faltan tests para 15+ casos de uso, especialmente los de autenticación (los más críticos para seguridad).

### Preguntas abiertas (responder antes de iniciar)

> **❓ P4.1 — Prioridad de tests:**
> Los casos de uso faltantes son muchos. ¿Cuál es el orden de prioridad para tu negocio?
>
> - **Opción A:** Auth primero (`AuthorizeUseCase`, `VerifySessionUseCase`, `CreateSSOSessionUseCase`) — seguridad es prioridad #1.
> - **Opción B:** Admin primero (`AdminStatsUseCases`, `AdminUserUseCases`) — dashboards y operaciones internas.
> - **Opción C:** User/Tenant primero (`UpdateUserUseCase`, `PasswordResetUseCase`, `TenantMemberUseCase`) — flujo de onboarding.

> **❓ P4.2 — Nivel de cobertura mínima:**
> `jest.config.json` define thresholds: branches 60%, functions 70%, lines 70%. ¿Queremos:
>
> - Mantener estos thresholds (pragmático)?
> - Subir a 80% en todo (estándar enterprise)?
> - Diferentes thresholds por capa (domain 90%, application 80%, infrastructure 60%)?

> **❓ P4.3 — Tests de integración vs unitarios:**
> ¿Preferimos:
>
> - **Opción A:** Tests unitarios con mocks para application, tests de integración solo para infrastructure.
> - **Opción B:** Tests de integración con DB real para todos los casos de uso (más lento, más confiable).
> - **Opción C:** Mix: unitarios para application, integración para infrastructure, e2e para flujos críticos (login → refresh → logout).

### Criterios de aceptación

- [ ] Todos los casos de uso en `auth/` tienen tests.
- [ ] Todos los casos de uso en `session/` tienen tests.
- [ ] Todos los casos de uso en `user/` tienen tests.
- [ ] Cobertura global cumple el threshold definido en P4.2.
- [ ] `npm test` pasa en CI/local sin intervención manual.

### Tests a crear en esta etapa

| Test                              | Ubicación                                  | Qué valida                                                                                                          |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `AuthorizeUseCase.test.ts`        | `__tests__/application/use-cases/auth/`    | Generación de auth code PKCE                                                                                        |
| `VerifySessionUseCase.test.ts`    | `__tests__/application/use-cases/auth/`    | Validación de token JWT                                                                                             |
| `CreateSSOSessionUseCase.test.ts` | `__tests__/application/use-cases/session/` | Creación de sesión SSO                                                                                              |
| `RevokeSessionUseCase.test.ts`    | `__tests__/application/use-cases/session/` | Revocación de sesión                                                                                                |
| `UpdateUserUseCase.test.ts`       | `__tests__/application/use-cases/user/`    | Update profile + change password                                                                                    |
| `PasswordResetUseCase.test.ts`    | `__tests__/application/use-cases/user/`    | Forgot + reset password flow                                                                                        |
| `VerifyEmailUseCase.test.ts`      | `__tests__/application/use-cases/user/`    | Verificación de email                                                                                               |
| `OtpUseCase.test.ts`              | `__tests__/application/use-cases/otp/`     | Generar + verificar OTP                                                                                             |
| `CreateTenantUseCase.test.ts`     | `__tests__/application/use-cases/tenant/`  | Creación de tenant                                                                                                  |
| `Domain entities tests`           | `__tests__/domain/entities/`               | Tests para `Session`, `Tenant`, `Role`, `Application`, `RefreshToken`, `AuthCode`, `EmailVerification`, `OtpSecret` |

---

## 🔵 ETAPA 5 — Documentación Viva

**Objetivo:** Actualizar toda la documentación para que refleje el estado real del código.
**Estado:** `⏳ No iniciada`
**Depende de:** Etapa 4 completada

### Problemas a resolver

1. `AGENTS.md` no documenta 7 entidades del schema Prisma.
2. `AGENTS.md` usa nombres inconsistentes (`TenantMembership` vs `TenantMember`, `Session` única vs dual).
3. `IMPLEMENTATION_SUMMARY.md` desactualizado (lista 3 casos de uso en auth, existen 7).
4. `MIGRATION_GUIDE.md` referencia archivos `src/` que ya no existen.

### Preguntas abiertas (responder antes de iniciar)

> **❓ P5.1 — Fuente de verdad:**
> Tenemos múltiples documentos que describen la arquitectura:
>
> - `AGENTS.md` (contexto para agentes)
> - `src-hex/README.md` (visión general hexagonal)
> - `src-hex/INDEX.md` (índice de navegación)
> - `docs/shared/architecture.md`
>   ¿Cuál debería ser la **única** fuente de verdad para la arquitectura? ¿Los demás deberían ser derivados o eliminados?

> **❓ P5.2 — Documentación de entidades:**
> ¿Queremos que `AGENTS.md` documente **todas** las entidades de Prisma (incluyendo `Address`, `OtherInformation`, `AuditLog`) o solo las "entidades de dominio core" (User, Session, Tenant, Role, Application)?

> **❓ P5.3 — MIGRATION_GUIDE.md:**
> Este archivo mapea `src/` → `src-hex/`, pero `src/` ya no existe en el workspace. ¿Debería:
>
> - Archivarse como histórico (`MIGRATION_GUIDE.archive.md`)?
> - Eliminarse?
> - Convertirse en una guía de "cómo migrar código legacy dentro de src-hex" (si aún hay código legacy por migrar)?

### Criterios de aceptación

- [ ] `AGENTS.md` refleja todas las entidades reales con nombres consistentes.
- [ ] `IMPLEMENTATION_SUMMARY.md` lista todos los casos de uso, DTOs, ports y servicios actuales.
- [ ] `MIGRATION_GUIDE.md` tiene un destino claro (actualizado, archivado o eliminado).
- [ ] Todos los READMEs internos (`domain/README.md`, `application/README.md`, `infrastructure/README.md`) son consistentes con el código.
- [ ] **Tests:** Un test "meta" verifica que `AGENTS.md` menciona al menos todas las entidades que existen en `domain/entities/` (opcional, pero recomendado).

---

## 📊 Dashboard de Progreso

| Etapa             | Estado         | Tests creados | Tests pasando | PR asociado |
| ----------------- | -------------- | ------------- | ------------- | ----------- |
| 1 — Arquitectura  | ⏳ No iniciada | 0/4           | 0/4           | —           |
| 2 — Estructura    | ⏳ No iniciada | 0/3           | 0/3           | —           |
| 3 — Schema Prisma | ⏳ No iniciada | 0/3           | 0/3           | —           |
| 4 — Tests         | ⏳ No iniciada | 0/10          | 0/10          | —           |
| 5 — Documentación | ⏳ No iniciada | 0/1           | 0/1           | —           |
| **TOTAL**         | **0/5**        | **0/21**      | **0/21**      | —           |

---

## 📝 Log de Decisiones

> Espacio para registrar decisiones importantes tomadas durante la ejecución del plan.
> Cada entrada debe incluir fecha, etapa, pregunta respondida, y decisión tomada.

| Fecha | Etapa | Decisión | Justificación |
| ----- | ----- | -------- | ------------- |
| —     | —     | —        | —             |

---

## 🚀 Próximo paso inmediato

**Responder las preguntas abiertas de la ETAPA 1** (P1.1, P1.2, P1.3).

Una vez respondidas, el agente puede iniciar la implementación de la Etapa 1.

---

_Documento generado el 2026-06-07 tras auditoría de inconsistencias._
_Actualizar la sección "Dashboard de Progreso" y "Log de Decisiones" al finalizar cada etapa._
