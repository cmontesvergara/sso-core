# 🔍 Hallazgos P1.3 — SessionEnrichmentService

**Fecha:** 2026-06-08
**Scope:** `src-hex/application/services/SessionEnrichmentService.ts` + consumidores

---

## 1. ¿Qué hace?

`SessionEnrichmentService` enriquece una `AppSession` con datos de la tabla `Application`:

- `audience`
- `url`
- `backendUrl`

Solo actúa si:

1. La sesión es `AppSession` (no `SSOSession`)
2. La sesión **no** tiene ya `audience` poblado

Query exacto:

```typescript
prisma.application.findUnique({
  where: { appId: session.appId },
  select: { audience: true, url: true, backendUrl: true },
});
```

---

## 2. ¿Quién lo consume?

| Consumidor                 | Ubicación                     | ¿Lo usa?      | Nota                                                      |
| -------------------------- | ----------------------------- | ------------- | --------------------------------------------------------- |
| `GetSessionContextUseCase` | `application/use-cases/auth/` | ✅ **SÍ**     | Línea 73: `this.sessionEnrichmentService.enrich(session)` |
| `ExchangeCodeUseCase`      | `application/use-cases/auth/` | ❌ **NO**     | Recibe `queryRepository` y hace el query inline           |
| `Container`                | `infrastructure/config/`      | ✅ Registro   | `container.get('SessionEnrichmentService')`               |
| `routes/index.ts`          | `infrastructure/web/routes/`  | ✅ Resolución | Inyecta en `GetSessionContextUseCase`                     |

---

## 3. 🔴 Duplicación del query

El **mismo query** (`application.findUnique` por `appId` seleccionando `audience`, `url`, `backendUrl`) existe en **3 lugares**:

### A. SessionEnrichmentService.ts (línea 32)

```typescript
const appRecord = await this.prisma.application.findUnique({
  where: { appId: session.appId },
  select: { audience: true, url: true, backendUrl: true },
});
```

### B. PrismaQueryRepository.ts (línea 131)

```typescript
async findApplicationByAppId(appId: string): Promise<{ id: string; audience?: string | null; url?: string | null; backendUrl?: string | null } | null> {
  return this.prisma.application.findUnique({
    where: { appId },
    select: { id: true, audience: true, url: true, backendUrl: true },
  });
}
```

### C. ExchangeCodeUseCase.ts (línea 76)

```typescript
const appRecord = await this.queryRepository.findApplicationByAppId(input.appId);
const appAudience = appRecord?.audience ?? undefined;
const appUrl = appRecord?.url ?? undefined;
const appBackendUrl = appRecord?.backendUrl ?? undefined;
```

> **Conclusión:** El query ya está disponible vía `IQueryRepository.findApplicationByAppId()`. `SessionEnrichmentService` lo duplica.

---

## 4. 🔴 Inconsistencia de patrones

| Caso de Uso                | Patrón usado                        | Dónde vive el query                                           |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `ExchangeCodeUseCase`      | Query inline via `IQueryRepository` | `PrismaQueryRepository`                                       |
| `GetSessionContextUseCase` | Delega a `SessionEnrichmentService` | `SessionEnrichmentService` (que tiene su propio PrismaClient) |

**Problema:** Dos casos de uso que necesitan los mismos 3 campos de `Application` usan **dos mecanismos diferentes**.

---

## 5. 🔴 Violación de Clean Architecture

`SessionEnrichmentService` vive en `application/services/` pero:

- Importa `PrismaClient` directamente
- No tiene interfaz/port
- Es una implementación concreta, no una abstracción
- Los use cases dependen de la clase concreta (`import { SessionEnrichmentService } from '../../services/SessionEnrichmentService'`)

Esto viola la regla: **Application no debe conocer el ORM.**

---

## 6. 🟡 Origen probable

`SessionEnrichmentService` nació para **centralizar** la lógica de enriquecimiento que antes estaba duplicada. Pero:

- Se creó como clase concreta en `application/` en lugar de un port
- No se refactorizó `ExchangeCodeUseCase` para usarlo (sigue con query inline)
- Se le inyectó `PrismaClient` en lugar de depender de `IQueryRepository`

---

## 7. Opciones de solución

### Opción A — Eliminar SessionEnrichmentService, usar IQueryRepository

- `GetSessionContextUseCase` usa `queryRepository.findApplicationByAppId()` y reconstruye `AppSession` manualmente (como hace `ExchangeCodeUseCase`)
- **Pros:** Menos código, unifica patrón, no necesita nuevo port
- **Cons:** Lógica de "enriquecer si no tiene audience" se pierde o se duplica en el use case

### Opción B — Crear port ISessionEnrichmentService

- Definir `ISessionEnrichmentService` en `application/ports/output/`
- Implementar en `infrastructure/services/SessionEnrichmentService.ts` (con PrismaClient)
- Refactorizar `ExchangeCodeUseCase` para usarlo también
- **Pros:** Limpio arquitecturalmente, fácil de mockear, centraliza la lógica
- **Cons:** Más archivos (port + implementación)

### Opción C — Mover a infrastructure/services/ sin port

- Mover archivo tal cual a `infrastructure/services/`
- Los use cases siguen dependiendo de la clase concreta
- **Pros:** Mínimo cambio, sale de application/
- **Cons:** No hay abstracción, sigue violando Clean Architecture en sentido estricto

### Opción D — Fusionar con IQueryRepository

- Agregar método `enrichSession(session: Session): Promise<Session>` a `IQueryRepository`
- Implementar en `PrismaQueryRepository`
- Eliminar `SessionEnrichmentService`
- **Pros:** Un solo lugar para queries complejas
- **Cons:** `IQueryRepository` crece, mezcla "queries" con "enriquecimiento de entidades"

---

## 8. Recomendación

**Opción B (Port ISessionEnrichmentService)** es la más limpia porque:

1. La lógica de enriquecimiento es un **concepto de dominio** ("una sesión necesita metadatos de la app")
2. Vale la pena abstraerlo porque hay **2 casos de uso** que lo necesitan
3. Es fácil de mockear en tests (no necesitas Prisma)
4. Mantiene la regla de dependencias: Application define el port, Infrastructure implementa

---

## 9. Archivos a tocar si se elige Opción B

| Acción                | Archivo                                                          |
| --------------------- | ---------------------------------------------------------------- |
| Crear port            | `src-hex/application/ports/output/ISessionEnrichmentService.ts`  |
| Mover implementación  | `src-hex/infrastructure/services/SessionEnrichmentService.ts`    |
| Refactorizar use case | `src-hex/application/use-cases/auth/GetSessionContextUseCase.ts` |
| Refactorizar use case | `src-hex/application/use-cases/auth/ExchangeCodeUseCase.ts`      |
| Actualizar Container  | `src-hex/infrastructure/config/Container.ts`                     |
| Actualizar rutas      | `src-hex/infrastructure/web/routes/index.ts`                     |

---

## 10. Nota sobre ExchangeCodeUseCase

`ExchangeCodeUseCase` actualmente:

1. Hace `queryRepository.findApplicationByAppId(input.appId)`
2. Extrae `audience`, `url`, `backendUrl`
3. Pasa estos valores al constructor de `AppSession`

Esto es **más eficiente** que `SessionEnrichmentService` porque:

- Crea la sesión **ya enriquecida** desde el inicio
- No necesita reconstruir la entidad después

`GetSessionContextUseCase`, en cambio:

1. Carga la sesión de la BD (sin audience)
2. Llama `sessionEnrichmentService.enrich(session)`
3. El servicio reconstruye `AppSession` con los nuevos valores

> **Idea:** Unificar ambos patrones. Que `ExchangeCodeUseCase` también use `ISessionEnrichmentService` para obtener los valores, pero siga creando la sesión enriquecida desde el constructor.
