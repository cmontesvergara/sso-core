# Domain Layer - La Capa del Corazón

> **Regla absoluta:** Esta capa NO importa nada de fuera. Cero dependencias externas.

---

## 📁 entities/

**Qué va aquí:** Entidades de negocio puras con lógica de dominio.

**Desde la implementación actual:**

- `User` (de `prisma.user`, `services/user.ts`)
- `Session` (SSO Session de `services/session/sso-session.service.ts`)
- `AppSession` (Application Session de `services/session/app-session.service.ts`)
- `RefreshToken` (de `services/session/refresh-token.service.ts`)
- `AuthCode` (PKCE code de `services/authCodeV2.ts`)
- `Tenant` (de `services/tenant.ts`)
- `Role` (de `services/role.ts`)
- `Application` (de `services/appResource.ts`)
- `EmailVerification` (de `repositories/emailVerificationRepo.prisma.ts`)
- `OtpSecret` (de `repositories/otpSecretRepo.prisma.ts`)

**Ejemplo:**

```typescript
// entities/User.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email, // Value Object
    public readonly userStatus: UserStatus,
    public readonly systemRole: SystemRole,
    public readonly passwordHash: PasswordHash,
    public readonly tenantMemberships: TenantMembership[]
  ) {}

  canAccessTenant(tenantId: string): boolean {
    // Lógica de dominio pura
    return this.tenantMemberships.some((m) => m.tenantId === tenantId);
  }

  isActive(): boolean {
    return this.userStatus === 'active';
  }
}
```

**NO debe tener:**

- Decoradores de Prisma (`@model`, etc)
- Imports de `ioredis`, `nodemailer`, etc
- Lógica de serialización JSON
- Referencias a Express Request/Response

---

## 📁 value-objects/

**Qué va aquí:** Objetos inmutables que representan conceptos del dominio.

**Desde la implementación actual:**

- `Email` (validación de emails de `services/email.ts`)
- `PasswordHash` (hashing de `services/crypto.ts`)
- `JWTToken` (tokens de `services/jwt.ts`)
- `DeviceFingerprint` (de `services/session/sso-session.service.ts`)
- `SessionToken` (token con JTI)
- `AuthCodeChallenge` (PKCE code_challenge de `services/authCodeV2.ts`)
- `TenantId`, `UserId`, `SessionId` (IDs tipados)
- `RoleName`, `Permission` (de `services/role.ts`)
- `NUID` (identificador único de usuario)

**Ejemplo:**

```typescript
// value-objects/Email.ts
export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Result<Email, InvalidEmailError> {
    if (!this.isValid(value)) {
      return Result.fail(new InvalidEmailError(value));
    }
    return Result.ok(new Email(value.toLowerCase().trim()));
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

---

## 📁 repositories/ (interfaces only!)

**Qué va aquí:** Contratos que definen qué operaciones de persistencia necesita el dominio.

**Desde la implementación actual:**

- `IUserRepository` (basado en `repositories/userRepo.prisma.ts`)
- `ISessionRepository` (basado en `services/session/sso-session.service.ts`)
- `IAppSessionRepository` (basado en `services/session/app-session.service.ts`)
- `IRefreshTokenRepository` (basado en `repositories/refreshTokenRepo.prisma.ts`)
- `IAuthCodeRepository` (basado en `services/authCodeV2.ts`)
- `ITenantRepository` (basado en `repositories/tenantRepo.prisma.ts`)
- `IRoleRepository` (basado en `repositories/roleRepo.prisma.ts`)
- `IApplicationRepository` (basado en `repositories/applicationRepo.prisma.ts`)
- `IOtpRepository` (basado en `services/otp.ts`)

**Ejemplo:**

```typescript
// repositories/IUserRepository.ts
export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findByNUID(nuid: NUID): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(email: Email): Promise<boolean>;
}
```

**Regla:** Solo interfaces, JAMÁS implementaciones.

---

## 📁 errors/

**Qué va aquí:** Errores específicos del dominio.

**Desde la implementación actual:**

- `DomainError` (clase base)
- `UserNotFoundError` (de errores en `services/user.ts`)
- `InvalidCredentialsError` (de `services/authV2.ts`)
- `SessionExpiredError` (de `services/session/token-validator.service.ts`)
- `TokenRevokedError` (de `services/session/session-revoker.service.ts`)
- `InvalidAuthCodeError` (de `services/authCodeV2.ts`)
- `TenantAccessDeniedError` (de lógica de tenant)
- `UserAlreadyExistsError` (de registro)
- `InvalidEmailError` (de validación de email)
- `WeakPasswordError` (de validación de contraseña)

**Ejemplo:**

```typescript
// errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
}

// errors/UserNotFoundError.ts
export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  readonly statusCode = 404;

  constructor(userId: string) {
    super(`User with id ${userId} not found`);
  }
}
```

---

## 📁 events/

**Qué va aquí:** Eventos de dominio para comunicación desacoplada.

**Desde la implementación actual:**

- `UserLoggedInEvent` (cuando login exitoso)
- `UserLoggedOutEvent` (cuando logout)
- `SessionRevokedEvent` (de `services/session/session-revoker.service.ts`)
- `TokenRefreshedEvent` (cuando refresh token)
- `TenantCreatedEvent` (de `services/tenant.ts`)
- `UserCreatedEvent` (registro)
- `PasswordChangedEvent` (cambio de password)

**Ejemplo:**

```typescript
// events/UserLoggedInEvent.ts
export class UserLoggedInEvent {
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly deviceInfo: DeviceInfo,
    public readonly ip: string
  ) {}
}
```

---

## 📁 services/ (domain services)

**Qué va aquí:** Lógica de negocio que no pertenece a una sola entidad.

**Desde la implementación actual:**

- `AuthenticationService` (lógica de verificación de credenciales)
- `SessionValidationService` (validación cruzada de sesiones)
- `PasswordPolicyService` (políticas de contraseñas)
- `TokenRotationPolicy` (política de rotación de tokens)

**Ejemplo:**

```typescript
// services/AuthenticationService.ts
export class AuthenticationService {
  constructor(private passwordHasher: PasswordHasher) {}

  async verifyCredentials(user: User, plainPassword: string): Promise<boolean> {
    return this.passwordHasher.verify(plainPassword, user.passwordHash);
  }
}
```

---

## Checklist Domain Layer

- [ ] Solo TypeScript puro, sin imports externos
- [ ] Entidades encapsulan su estado y comportamiento
- [ ] Value Objects son inmutables y validan al crearse
- [ ] Errores son específicos del dominio
- [ ] Repository interfaces definen contratos, no implementan
- [ ] Services de dominio orquestan múltiples entidades
