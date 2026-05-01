# Infrastructure Layer - Implementación

La capa de infraestructura contiene todas las implementaciones concretas de las interfaces definidas en las capas superiores.

## Estructura

```
src-hex/infrastructure/
├── config/              # Configuración y DI
│   ├── PrismaClient.ts
│   ├── RedisClient.ts
│   └── Container.ts
│
├── persistence/         # Implementaciones de repositories
│   ├── prisma/
│   │   ├── PrismaUserRepository.ts
│   │   ├── PrismaSessionRepository.ts
│   │   ├── PrismaTenantRepository.ts
│   │   └── ...
│   └── redis/
│       ├── RedisSessionRepository.ts
│       └── RedisCacheService.ts
│
├── web/                # Express (Controllers, Routes, Middleware)
│   ├── controllers/
│   ├── routes/
│   └── middleware/
│
├── external-services/  # Servicios externos
│   ├── email/
│   ├── sms/
│   ├── audit/
│   └── token/
│
└── security/           # Seguridad
    ├── JwtTokenService.ts
    └── Argon2PasswordHasher.ts
```

## Notas de Implementación

### Repositories Prisma

Los repositories deben mapear entre entidades de Prisma y entidades de Dominio:

```typescript
// Ejemplo de mapeo
private mapToDomain(prismaUser: any): User {
  return new User(
    UserId.create(prismaUser.id),
    Email.createUnsafe(prismaUser.email),
    // ... resto de campos
  );
}
```

### Servicios Externos

Implementan los ports definidos en Application:

- `ITokenService` → `JwtTokenService`
- `IEmailService` → `ResendEmailService`
- `ICacheService` → `RedisCacheService`

### Controllers

Adaptan HTTP a casos de uso:

```typescript
// Extraen datos de Request
// Llaman al use case
// Devuelven Response
```

## Reglas

1. Esta capa **SÍ** tiene dependencias externas
2. Implementa las interfaces definidas en Application
3. Convierte entre formatos externos y entidades de dominio
4. Maneja errores de infraestructura (timeouts, disconnects)

## Implementación Actual

Se han creado las estructuras base:

- ✅ Configuración de Prisma
- ✅ Repositories base (requieren ajustes al schema real)
- ✅ Estructura de carpetas completa

**Nota**: Las implementaciones exactas de repositories dependen del schema de Prisma del proyecto. Se recomienda:

1. Revisar el schema actual en `prisma/schema.prisma`
2. Ajustar los mappers según las tablas reales
3. Implementar los servicios externos según proveedores usados
