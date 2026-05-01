# Índice - Arquitectura Hexagonal sso-core

Estructura completa de la propuesta de arquitectura hexagonal basada en la implementación actual.

---

## 📚 Documentación

| Archivo              | Descripción                            |
| -------------------- | -------------------------------------- |
| `README.md`          | Visión general y diagramas de capas    |
| `MIGRATION_GUIDE.md` | Mapeo detallado de `src/` a `src-hex/` |
| `INDEX.md`           | Este archivo - índice de navegación    |

---

## 🏗️ Estructura de Carpetas

```
src-hex/
├── domain/
│   ├── README.md
│   ├── entities/           # Entidades de negocio (User, Session, etc)
│   ├── value-objects/      # Email, PasswordHash, JWTToken, etc
│   ├── repositories/         # Interfaces de repositorios (IUserRepository, etc)
│   ├── errors/               # Errores de dominio
│   ├── events/               # Eventos de dominio
│   └── services/             # Servicios de dominio puros
│
├── application/
│   ├── README.md
│   ├── use-cases/            # Casos de uso (LoginUseCase, etc)
│   ├── ports/
│   │   ├── input/            # Interfaces que expone la app
│   │   └── output/           # Interfaces que necesita de fuera
│   ├── dto/                  # DTOs de entrada/salida
│   ├── mappers/              # Conversores Entity ↔ DTO
│   └── services/             # Servicios de aplicación
│
├── infrastructure/
│   ├── README.md
│   ├── persistence/
│   │   ├── prisma/           # Implementaciones Prisma
│   │   └── redis/            # Implementaciones Redis
│   ├── web/
│   │   ├── controllers/      # Controllers Express
│   │   ├── middleware/         # Middlewares Express
│   │   └── routes/           # Definición de rutas
│   ├── external-services/
│   │   ├── email/            # ResendEmailService
│   │   ├── sms/              # TwilioSmsService
│   │   ├── audit/            # Servicios de auditoría
│   │   └── token/            # JwtTokenService
│   ├── security/             # Argon2PasswordHasher, PkceGenerator
│   └── config/               # Container DI, Clientes DB
│
└── interfaces/
    ├── README.md
    ├── http/
    │   ├── Server.ts         # Setup Express
    │   └── Bootstrap.ts      # Entry point
    ├── cli/
    │   └── commands/         # Comandos de administración
    └── events/
        └── handlers/           # Event listeners
```

---

## 🔄 Mapeo Rápido: Archivos Actuales → Hexagonal

### Servicios → Domain/Application

| Actual                          | Hexagonal                                        |
| ------------------------------- | ------------------------------------------------ |
| `services/session/*.service.ts` | `application/use-cases/` + `domain/services/`    |
| `services/authV2.ts`            | `application/use-cases/LoginUseCase.ts`          |
| `services/user.ts`              | `application/services/UserApplicationService.ts` |
| `services/tenant.ts`            | `application/use-cases/CreateTenantUseCase.ts`   |
| `services/role.ts`              | `domain/services/RoleService.ts`                 |
| `services/otp.ts`               | `application/use-cases/VerifyOtpUseCase.ts`      |

### Repositorios → Infrastructure

| Actual                     | Hexagonal                                          |
| -------------------------- | -------------------------------------------------- |
| `repositories/*.prisma.ts` | `infrastructure/persistence/prisma/*Repository.ts` |
| `repositories/redis*.ts`   | `infrastructure/persistence/redis/*Repository.ts`  |

### Rutas → Infrastructure

| Actual              | Hexagonal                                          |
| ------------------- | -------------------------------------------------- |
| `routes/v2/auth.ts` | `infrastructure/web/controllers/AuthController.ts` |
| `routes/user.ts`    | `infrastructure/web/controllers/UserController.ts` |
| `routes/*.ts`       | `infrastructure/web/controllers/*Controller.ts`    |

### Servicios Externos → Infrastructure

| Actual               | Hexagonal                                                      |
| -------------------- | -------------------------------------------------------------- |
| `services/email.ts`  | `infrastructure/external-services/email/ResendEmailService.ts` |
| `services/redis.ts`  | `infrastructure/config/RedisClient.ts`                         |
| `services/jwt.ts`    | `infrastructure/security/JwtTokenService.ts`                   |
| `services/crypto.ts` | `infrastructure/security/Argon2PasswordHasher.ts`              |

### Entry Point → Interfaces

| Actual      | Hexagonal                      |
| ----------- | ------------------------------ |
| `server.ts` | `interfaces/http/Server.ts`    |
| `index.ts`  | `interfaces/http/Bootstrap.ts` |

---

## 🎯 Entidades del Dominio (a crear)

- `User` - Usuario del sistema
- `Session` - Sesión SSO
- `AppSession` - Sesión de aplicación
- `RefreshToken` - Token de refresco
- `AuthCode` - Código PKCE
- `Tenant` - Organización
- `Role` - Rol de usuario
- `Application` - Aplicación registrada
- `TenantMembership` - Membresía usuario-tenant
- `EmailVerification` - Verificación de email
- `OtpSecret` - Secreto 2FA

---

## ⚡ Casos de Uso Principales (a crear)

### Autenticación

- `LoginUseCase` - Login con credenciales
- `LogoutUseCase` - Cerrar sesión
- `RefreshTokenUseCase` - Rotar tokens
- `VerifySessionUseCase` - Validar token
- `ExchangeCodeUseCase` - Intercambio PKCE

### Sesiones

- `CreateSSOSessionUseCase` - Crear sesión SSO
- `CreateAppSessionUseCase` - Crear sesión app
- `RevokeSessionUseCase` - Revocar sesión
- `RevokeAllUserSessionsUseCase` - Logout global

### Usuarios

- `RegisterUserUseCase` - Registro
- `UpdateUserProfileUseCase` - Actualizar perfil
- `ChangePasswordUseCase` - Cambiar contraseña
- `DeactivateUserUseCase` - Desactivar cuenta

### Tenants

- `CreateTenantUseCase` - Crear organización
- `AddUserToTenantUseCase` - Agregar miembro
- `RemoveUserFromTenantUseCase` - Eliminar miembro
- `ChangeUserRoleUseCase` - Cambiar rol

---

## 🔌 Puertos (Interfaces)

### Entrada (La app expone)

- `IAuthPort` - login, logout, refresh
- `ISessionPort` - create, validate, revoke
- `IUserPort` - register, update
- `ITenantPort` - create, add member

### Salida (La app necesita)

- `ITokenService` - generar/validar JWT
- `IEmailService` - enviar emails
- `ISmsService` - enviar SMS
- `IAuditService` - auditoría
- `IEventBus` - eventos
- `IPasswordHasher` - hash de passwords
- `ICacheService` - cache Redis

---

## 📋 Checklist de Migración

### Fase 1: Domain

- [ ] Crear entidades basadas en Prisma schema
- [ ] Crear value objects (Email, PasswordHash, etc)
- [ ] Definir interfaces de repositorios
- [ ] Crear errores de dominio

### Fase 2: Application

- [ ] Definir puertos de entrada/salida
- [ ] Crear DTOs
- [ ] Implementar casos de uso
- [ ] Crear mappers

### Fase 3: Infrastructure

- [ ] Implementar repositorios Prisma
- [ ] Implementar repositorios Redis
- [ ] Implementar servicios externos
- [ ] Crear controllers Express
- [ ] Crear middlewares
- [ ] Configurar rutas
- [ ] Configurar container DI

### Fase 4: Interfaces

- [ ] Crear Server Express
- [ ] Crear Bootstrap
- [ ] Configurar entry point

### Fase 5: Testing & Deploy

- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Validar API compatible
- [ ] Deploy gradual

---

## 📖 Reglas Clave

1. **Domain no importa nada** - Solo TypeScript puro
2. **Application solo importa Domain**
3. **Infrastructure importa Application + Domain**
4. **Interfaces importa Infrastructure**
5. **Dependencias apuntan siempre hacia adentro**

---

## 🚀 Para Empezar

1. Lee `domain/README.md` para entender las entidades
2. Lee `application/README.md` para los casos de uso
3. Lee `infrastructure/README.md` para implementaciones
4. Consulta `MIGRATION_GUIDE.md` para el mapeo completo

---

_Generado basado en la implementación actual de sso-core_
_Fecha: 2026-04-22_
