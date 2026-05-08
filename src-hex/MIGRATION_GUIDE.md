# Guía de Migración - De `src/` a `src-hex/`

Este documento mapea cada archivo de la implementación actual a su ubicación en la arquitectura hexagonal.

## Estructura General

```
src/                          src-hex/
├── services/                 ├── domain/
│   ├── session/*.ts    ───▶  │   ├── entities/Session.ts
│   ├── authV2.ts       ───▶  │   ├── entities/AuthCode.ts
│   ├── user.ts         ───▶  │   └── repositories/IUserRepository.ts
│   ├── jwt.ts          ───▶  │
│   └── ...                   │
├── repositories/             ├── application/
│   ├── *.prisma.ts     ───▶  │   ├── use-cases/LoginUseCase.ts
│   └── redis*.ts       ───▶  │   ├── ports/output/ITokenService.ts
│                             │   └── dto/LoginInput.ts
├── routes/                   │
│   ├── v2/auth.ts      ───▶  ├── infrastructure/
│   └── *.ts                  │   ├── web/controllers/AuthController.ts
│                             │   ├── web/routes/auth.routes.ts
├── services/                 │   ├── persistence/prisma/PrismaUserRepository.ts
│   ├── email.ts        ───▶  │   ├── persistence/redis/RedisSessionRepository.ts
│   ├── redis.ts        ───▶  │   └── external-services/email/ResendEmailService.ts
│   └── crypto.ts       ───▶  │
├── server.ts           ───▶  ├── interfaces/
│                             │   └── http/Server.ts
└── ...                       └── ...
```

---

## Mapeo Detallado por Carpeta

### `services/` → Domain + Application + Infrastructure

| Archivo Actual                                | Tipo    | Destino Hexagonal                                                   | Notas                      |
| --------------------------------------------- | ------- | ------------------------------------------------------------------- | -------------------------- |
| `services/session/sso-session.service.ts`     | Service | `application/use-cases/CreateSSOSessionUseCase.ts`                  | Separar lógica de creación |
| `services/session/app-session.service.ts`     | Service | `application/use-cases/CreateAppSessionUseCase.ts`                  | Idem para App Session      |
| `services/session/refresh-token.service.ts`   | Service | `application/use-cases/RefreshTokenUseCase.ts`                      | Lógica de rotación         |
| `services/session/token-validator.service.ts` | Service | `domain/services/TokenValidationService.ts`                         | Valida tokens (dominio)    |
| `services/session/session-revoker.service.ts` | Service | `application/use-cases/RevokeSessionUseCase.ts`                     | Revocación                 |
| `services/session/redis-session.service.ts`   | Infra   | `infrastructure/persistence/redis/RedisSessionService.ts`           | Cache Redis                |
| `services/authV2.ts`                          | Service | `application/use-cases/LoginUseCase.ts`                             | Lógica de login            |
| `services/auth.ts`                            | Service | `application/use-cases/LogoutUseCase.ts` + `ExchangeCodeUseCase.ts` | Separar logout/exchange    |
| `services/authCodeV2.ts`                      | Service | `application/use-cases/GenerateAuthCodeUseCase.ts`                  | PKCE                       |
| `services/user.ts`                            | Service | `application/services/UserApplicationService.ts`                    | Servicios de usuario       |
| `services/tenant.ts`                          | Service | `application/use-cases/CreateTenantUseCase.ts`                      | Casos de uso tenant        |
| `services/role.ts`                            | Service | `domain/services/RoleService.ts`                                    | Lógica de roles            |
| `services/otp.ts`                             | Service | `application/use-cases/VerifyOtpUseCase.ts`                         | Verificación 2FA           |
| `services/email.ts`                           | Infra   | `infrastructure/external-services/email/ResendEmailService.ts`      | Implementación email       |
| `services/redis.ts`                           | Infra   | `infrastructure/config/RedisClient.ts`                              | Cliente Redis              |
| `services/jwt.ts`                             | Infra   | `infrastructure/security/JwtTokenService.ts`                        | Servicio JWT               |
| `services/crypto.ts`                          | Infra   | `infrastructure/security/Argon2PasswordHasher.ts`                   | Hashing                    |
| `services/prisma.ts`                          | Infra   | `infrastructure/config/PrismaClient.ts`                             | Cliente Prisma             |
| `services/stats.ts`                           | App     | `application/services/StatsQueryService.ts`                         | Queries                    |
| `services/auditLog.ts`                        | Infra   | `infrastructure/external-services/audit/ConsoleAuditService.ts`     | Auditoría                  |

---

### `repositories/` → Infrastructure

| Archivo Actual                    | Destino Hexagonal                                                        | Implementa                             |
| --------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `userRepo.prisma.ts`              | `infrastructure/persistence/prisma/PrismaUserRepository.ts`              | `IUserRepository`                      |
| `ssoSessionRepo.prisma.ts`        | `infrastructure/persistence/prisma/PrismaSSOSessionRepository.ts`        | `ISessionRepository`                   |
| `appSessionRepo.prisma.ts`        | `infrastructure/persistence/prisma/PrismaAppSessionRepository.ts`        | `IAppSessionRepository`                |
| `refreshTokenRepo.prisma.ts`      | `infrastructure/persistence/prisma/PrismaRefreshTokenRepository.ts`      | `IRefreshTokenRepository`              |
| `tenantRepo.prisma.ts`            | `infrastructure/persistence/prisma/PrismaTenantRepository.ts`            | `ITenantRepository`                    |
| `roleRepo.prisma.ts`              | `infrastructure/persistence/prisma/PrismaRoleRepository.ts`              | `IRoleRepository`                      |
| `applicationRepo.prisma.ts`       | `infrastructure/persistence/prisma/PrismaApplicationRepository.ts`       | `IApplicationRepository`               |
| `authCodeRepo.prisma.ts`          | `infrastructure/persistence/prisma/PrismaAuthCodeRepository.ts`          | `IAuthCodeRepository`                  |
| `otpSecretRepo.prisma.ts`         | `infrastructure/persistence/prisma/PrismaOtpRepository.ts`               | `IOtpRepository`                       |
| `emailVerificationRepo.prisma.ts` | `infrastructure/persistence/prisma/PrismaEmailVerificationRepository.ts` | `IEmailVerificationRepository`         |
| `userAppAccessRepo.prisma.ts`     | `infrastructure/persistence/prisma/PrismaUserAppAccessRepository.ts`     | `IUserAppAccessRepository`             |
| `appResourceRepo.prisma.ts`       | `infrastructure/persistence/prisma/PrismaAppResourceRepository.ts`       | `IAppResourceRepository`               |
| `tenantAppRepo.prisma.ts`         | `infrastructure/persistence/prisma/PrismaTenantAppRepository.ts`         | `ITenantAppRepository`                 |
| `addressRepo.prisma.ts`           | `infrastructure/persistence/prisma/PrismaAddressRepository.ts`           | `IAddressRepository`                   |
| `otherInformationRepo.prisma.ts`  | `infrastructure/persistence/prisma/PrismaOtherInfoRepository.ts`         | `IOtherInformationRepository`          |
| `redisSessionRepo.ts`             | `infrastructure/persistence/redis/RedisSessionRepository.ts`             | `ICacheService` + `ISessionRepository` |
| `redisAuthCodeRepo.ts`            | `infrastructure/persistence/redis/RedisAuthCodeRepository.ts`            | `IAuthCodeRepository` (cache)          |

---

### `routes/` → Infrastructure / Web

| Archivo Actual                | Destino Hexagonal                                                                                  | Controlador Principal         |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `routes/v2/auth.ts`           | `infrastructure/web/routes/auth.routes.ts` + `controllers/AuthController.ts`                       | `AuthController`              |
| `routes/v2/role.ts`           | `infrastructure/web/routes/role.routes.ts` + `controllers/RoleController.ts`                       | `RoleController`              |
| `routes/v2/index.ts`          | `infrastructure/web/routes/index.ts`                                                               | Router aggregator             |
| `routes/user.ts`              | `infrastructure/web/routes/user.routes.ts` + `controllers/UserController.ts`                       | `UserController`              |
| `routes/tenant.ts`            | `infrastructure/web/routes/tenant.routes.ts` + `controllers/TenantController.ts`                   | `TenantController`            |
| `routes/session.ts`           | `infrastructure/web/routes/session.routes.ts` + `controllers/SessionController.ts`                 | `SessionController`           |
| `routes/applications.ts`      | `infrastructure/web/routes/application.routes.ts` + `controllers/ApplicationController.ts`         | `ApplicationController`       |
| `routes/appResource.ts`       | `infrastructure/web/routes/appResource.routes.ts` + `controllers/AppResourceController.ts`         | `AppResourceController`       |
| `routes/role.ts`              | `infrastructure/web/routes/role.routes.ts`                                                         | (merge con v2)                |
| `routes/stats.ts`             | `infrastructure/web/routes/stats.routes.ts` + `controllers/StatsController.ts`                     | `StatsController`             |
| `routes/otp.ts`               | `infrastructure/web/routes/otp.routes.ts` + `controllers/OtpController.ts`                         | `OtpController`               |
| `routes/emailVerification.ts` | `infrastructure/web/routes/email.routes.ts` + `controllers/EmailVerificationController.ts`         | `EmailVerificationController` |
| `routes/applicationSync.ts`   | `infrastructure/web/routes/applicationSync.routes.ts` + `controllers/ApplicationSyncController.ts` | `ApplicationSyncController`   |
| `routes/docs.ts`              | `infrastructure/web/routes/docs.routes.ts`                                                         | Docs serving                  |
| `routes/metadata.ts`          | `infrastructure/web/routes/metadata.routes.ts` + `controllers/MetadataController.ts`               | `MetadataController`          |
| `routes/util.ts`              | `infrastructure/web/routes/util.routes.ts` + `controllers/UtilController.ts`                       | `UtilController`              |

---

### `config/`, `server.ts` → Infrastructure / Interfaces

| Archivo Actual    | Destino Hexagonal                    | Propósito           |
| ----------------- | ------------------------------------ | ------------------- |
| `server.ts`       | `interfaces/http/Server.ts`          | Setup Express       |
| `index.ts`        | `interfaces/http/Bootstrap.ts`       | Entry point HTTP    |
| `config/index.ts` | `infrastructure/config/Container.ts` | DI container        |
| `middleware/*.ts` | `infrastructure/web/middleware/*.ts` | Express middlewares |

---

## Entidades del Dominio a Crear

Basado en los modelos Prisma actuales:

```
domain/entities/
├── User.ts                    (de prisma.user)
├── Session.ts                 (SSO Session - de services/session)
├── AppSession.ts              (App Session - de services/session)
├── RefreshToken.ts            (de repositories/refreshTokenRepo)
├── AuthCode.ts                (PKCE - de services/authCodeV2)
├── Tenant.ts                  (de prisma.tenant)
├── Role.ts                    (de prisma.role)
├── Application.ts             (de prisma.application)
├── TenantMembership.ts        (relación user-tenant)
├── EmailVerification.ts       (de repositories/emailVerificationRepo)
├── OtpSecret.ts               (de repositories/otpSecretRepo)
├── AppResource.ts             (de repositories/appResourceRepo)
├── UserAppAccess.ts           (de repositories/userAppAccessRepo)
└── TenantApplication.ts       (de repositories/tenantAppRepo)
```

---

## Casos de Uso a Crear

Basado en los servicios actuales:

```
application/use-cases/
├── auth/
│   ├── LoginUseCase.ts
│   ├── LogoutUseCase.ts
│   ├── RefreshTokenUseCase.ts
│   ├── VerifySessionUseCase.ts
│   └── ExchangeCodeUseCase.ts (PKCE)
├── session/
│   ├── CreateSSOSessionUseCase.ts
│   ├── CreateAppSessionUseCase.ts
│   ├── RevokeSessionUseCase.ts
│   └── RevokeAllUserSessionsUseCase.ts
├── user/
│   ├── RegisterUserUseCase.ts
│   ├── UpdateUserProfileUseCase.ts
│   ├── ChangePasswordUseCase.ts
│   └── DeactivateUserUseCase.ts
├── tenant/
│   ├── CreateTenantUseCase.ts
│   ├── AddUserToTenantUseCase.ts
│   ├── RemoveUserFromTenantUseCase.ts
│   └── ChangeUserRoleUseCase.ts
├── otp/
│   ├── GenerateOtpUseCase.ts
│   └── VerifyOtpUseCase.ts
└── pkce/
    ├── GenerateAuthCodeUseCase.ts
    └── ValidateAuthCodeUseCase.ts
```

---

## Puertos (Interfaces) a Crear

### Ports de Entrada (Input)

```
application/ports/input/
├── IAuthPort.ts              (login, logout, refresh)
├── ISessionPort.ts           (create, validate, revoke)
├── IUserPort.ts              (register, update, change password)
├── ITenantPort.ts            (create, add/remove member)
├── IOtpPort.ts               (generate, verify)
└── IApplicationPort.ts       (register app, sync)
```

### Ports de Salida (Output)

```
application/ports/output/
├── ITokenService.ts          (generar/validar JWT)
├── IEmailService.ts          (enviar emails)
├── ISmsService.ts            (enviar SMS)
├── IAuditService.ts          (logging de auditoría)
├── IEventBus.ts              (publicar/subscribir eventos)
├── IPasswordHasher.ts        (hash/verify passwords)
├── ICacheService.ts          (Redis cache)
└── IJwksProvider.ts          (JWKS endpoint)
```

---

## DTOs a Crear

```
application/dto/
├── input/
│   ├── LoginInput.ts
│   ├── LogoutInput.ts
│   ├── RefreshTokenInput.ts
│   ├── RegisterInput.ts
│   ├── UpdateProfileInput.ts
│   ├── ChangePasswordInput.ts
│   ├── CreateTenantInput.ts
│   ├── AddMemberInput.ts
│   ├── GenerateOtpInput.ts
│   └── VerifyOtpInput.ts
└── output/
    ├── LoginResult.ts
    ├── SessionResult.ts
    ├── UserDto.ts
    ├── TenantDto.ts
    └── TokenResult.ts
```

---

## Middlewares a Migrar

| Actual                       | Destino                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `middleware/errorHandler.ts` | `infrastructure/web/middleware/ErrorHandlerMiddleware.ts` |
| `middleware/logging.ts`      | `infrastructure/web/middleware/LoggingMiddleware.ts`      |
| `middleware/auth.ts`         | `infrastructure/web/middleware/AuthMiddleware.ts`         |
| Rate limiting en routes      | `infrastructure/web/middleware/RateLimitMiddleware.ts`    |

---

## Pasos de Migración Sugeridos

### Fase 1: Domain (Sin dependencias)

1. Crear `domain/entities/` con las entidades de negocio
2. Crear `domain/value-objects/` (Email, PasswordHash, etc)
3. Crear `domain/errors/` con errores específicos
4. Crear `domain/repositories/` con interfaces

### Fase 2: Application (Solo depende de Domain)

1. Crear `application/ports/output/` (interfaces de servicios externos)
2. Crear `application/dto/` con DTOs de entrada/salida
3. Crear `application/use-cases/` migrando lógica de `services/`
4. Crear `application/mappers/` para conversión

### Fase 3: Infrastructure (Depende de Application)

1. Crear `infrastructure/persistence/prisma/` con implementaciones de repos
2. Crear `infrastructure/persistence/redis/` con cache
3. Crear `infrastructure/external-services/` con emails, SMS, etc
4. Crear `infrastructure/web/controllers/` con controllers Express
5. Crear `infrastructure/web/middleware/` con middlewares
6. Crear `infrastructure/web/routes/` con rutas
7. Crear `infrastructure/config/Container.ts` con DI

### Fase 4: Interfaces (Capa más externa)

1. Crear `interfaces/http/Server.ts` con setup Express
2. Crear `interfaces/http/Bootstrap.ts` como entry point
3. Configurar `package.json` para usar nuevo entry point

### Fase 5: Testing

1. Tests unitarios de domain (sin mocks)
2. Tests de use cases (mockear repositories)
3. Tests de controllers (mockear use cases)
4. Tests de integración (end-to-end)

---

## Notas Importantes

1. **No eliminar `src/` todavía**: Mantener ambas estructuras mientras se migra
2. **Migrar gradualmente**: Un módulo a la vez (auth primero, luego sessions, etc)
3. **Mantener compatibilidad**: API routes deben seguir funcionando durante la migración
4. **Tests primero**: Escribir tests antes de migrar cada componente
5. **Code review**: Cada capa completa debe ser revisada antes de continuar

---

## Ejemplo de Flujo de Datos

```
HTTP Request
     │
     ▼
AuthController (infrastructure/web/controllers/)
     │
     ▼ (usa)
LoginUseCase (application/use-cases/)
     │
     ▼ (usa)
IUserRepository.findByEmail (domain/repositories/)
     │
     ▼ (implementa)
PrismaUserRepository.findByEmail (infrastructure/persistence/prisma/)
     │
     ▼ (usa)
Prisma Client (node_modules)
     │
     ▼
PostgreSQL Database
```

Las flechas SIEMPRE apuntan hacia adentro: Interfaces → Infrastructure → Application → Domain
