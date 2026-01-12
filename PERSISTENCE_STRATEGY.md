# Estrategia Híbrida: node-pg-migrate + Prisma

Este documento explica la arquitectura de persistencia del SSO backend.

## Visión General

La persistencia de datos combina dos herramientas complementarias:

- **node-pg-migrate**: Control explícito del esquema, migraciones versionadas, seguridad en BD (RLS)
- **Prisma**: ORM type-safe, tipado fuerte en TypeScript, productividad en runtime

## Responsabilidades

### node-pg-migrate (Seguridad & Esquema)

Ubicación: `migrations/*.js`

Responsable de:
- Crear/modificar tablas
- Definir constraints (unique, foreign keys, índices)
- Implementar Row-Level Security (RLS) y policies
- Control de acceso a nivel de base de datos
- Migraciones versionadas y reversibles

**Ejemplo**: `migrations/001_init.js`
- Crea tablas core (`users`, `refresh_tokens`, `tenants`, etc.)
- Habilita RLS en todas las tablas
- Define policies: usuarios ven solo sus registros, acceso multi-tenant

### Prisma (ORM Runtime)

Ubicación: `prisma/schema.prisma`, `src/**/*.prisma.ts`

Responsable de:
- Tipado fuerte de modelos (TypeScript)
- Queries type-safe en runtime
- Autocompletado en IDE
- Transacciones, relaciones, upserts
- Generación automática de tipos

**Ejemplo**: `src/repositories/userRepo.prisma.ts`
- Usa `PrismaClient` para CRUD tipado
- Beneficia de tipos generados desde schema
- Valida queries en compile-time

## Cómo Usar

### 1. Crear una nueva migración

```bash
npm run migrate:create -- --name add_new_feature
```

Edita `migrations/{timestamp}_add_new_feature.js` con SQL explícito:

```javascript
exports.up = (pgm) => {
  pgm.createTable('new_table', { /* ... */ });
  pgm.sql('CREATE POLICY ... ON new_table ...');
};

exports.down = (pgm) => {
  pgm.dropTable('new_table');
};
```

### 2. Actualizar Prisma schema

Edita `prisma/schema.prisma` para reflejar cambios en la BD:

```prisma
model NewTable {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // ... campos
  @@map("new_table")
}
```

### 3. Ejecutar migraciones

```bash
npm run migrate:up
```

Esto:
1. Corre node-pg-migrate (esquema + RLS)
2. Registra estado en tabla `pgmigrations`

### 4. Generar tipos Prisma

```bash
npm run prisma:generate
```

Genera `node_modules/.prisma/client` con tipos TypeScript derivados del schema.

### 5. Usar en código

```typescript
import { getPrismaClient } from '../services/prisma';

const prisma = getPrismaClient();
const user = await prisma.user.findUnique({ where: { email: 'a@b.com' } });
// TypeScript valida 'email' es campo válido, tipo de retorno es User | null
```

## Ejemplos de Patrones

### Multi-tenancy con RLS

**Migración** (node-pg-migrate):
```javascript
pgm.sql(`
  CREATE POLICY tenants_member_access ON tenants
  USING (EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_members.tenant_id = tenants.id
    AND tenant_members.user_id = current_setting('app.current_user_id')::uuid
  ))
`);
```

**Runtime** (Prisma):
```typescript
// Aplicación setea el context del usuario
prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`;

// Queries automáticamente filtran por RLS
const tenants = await prisma.tenant.findMany(); // Solo tenants del usuario
```

### Transacciones

```typescript
const prisma = getPrismaClient();

await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { ... } });
  const token = await tx.refreshToken.create({ data: { userId: user.id, ... } });
  return { user, token };
});
```

## Stack Completo

| Capa | Herramienta | Responsabilidad |
|------|-------------|-----------------|
| **Schema** | node-pg-migrate | Versioning, RLS, políticas, seguridad |
| **Runtime ORM** | Prisma | Type-safety, queries, relaciones |
| **Validation** | Joi | Input validation (rutas) |
| **Hashing** | Argon2 | Password security |
| **JWT** | jsonwebtoken + node-jose | Token signing, JWKS |

## Archivos Clave

- `migrations/001_init.js` — Esquema base + RLS policies
- `prisma/schema.prisma` — Modelos Prisma
- `src/repositories/*.prisma.ts` — Implementaciones CRUD
- `src/services/migrator.ts` — Orquestación migrations + Prisma
- `.pgmigratrc.json` — Configuración node-pg-migrate
- `.env` — DATABASE_URL usado por ambas herramientas

## Ventajas del Enfoque Híbrido

✅ **Separación de responsabilidades**: Schema (seguridad) vs ORM (productividad)  
✅ **Control fino de seguridad**: RLS y policies explícitas en SQL  
✅ **Type-safety en TypeScript**: Prisma genera tipos automáticos  
✅ **No lock-in**: Ambas herramientas son estándares de la industria  
✅ **Auditoria**: Migraciones versionadas en git, políticas de BD legibles  
✅ **Multi-tenancy**: RLS nativa de Postgres, no en aplicación  

## Próximos Pasos

- [ ] Implementar repositorios Prisma para todas las entidades
- [ ] Agregar migraciones para features (OTP, email verification)
- [ ] Integrar Prisma en `src/services/session.ts`
- [ ] Tests de integración con base de datos real
- [ ] Documentar políticas RLS por caso de uso

## Referencias

- [node-pg-migrate docs](https://github.com/salsita/node-pg-migrate)
- [Prisma docs](https://www.prisma.io/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
