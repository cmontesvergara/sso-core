# Application Layer - Orquestación de Casos de Uso

> **Regla:** Solo importa de `domain/`. Es el conductor de la orquesta, no el músico.

---

## 📁 use-cases/

**Qué va aquí:** Cada caso de uso de negocio como una clase independiente.

**Desde la implementación actual:**

### Autenticación (de `services/authV2.ts`, `services/auth.ts`)

- `LoginUseCase` - Flujo completo de login (credenciales → session)
- `LogoutUseCase` - Revocar sesión y tokens
- `RefreshTokenUseCase` - Rotación de tokens
- `VerifySessionUseCase` - Validar token y obtener claims
- `ExchangeCodeUseCase` - Intercambio PKCE code → tokens

### Sesiones (de `services/session/*.service.ts`)

- `CreateSSOSessionUseCase` - Crear sesión SSO (15 min)
- `CreateAppSessionUseCase` - Crear sesión de aplicación
- `RevokeSessionUseCase` - Revocar sesión específica
- `RevokeAllUserSessionsUseCase` - Logout global
- `ValidateSessionUseCase` - Verificar si sesión está activa

### Usuarios (de `services/user.ts`)

- `RegisterUserUseCase` - Registro con validaciones
- `UpdateUserProfileUseCase` - Actualizar datos básicos
- `ChangePasswordUseCase` - Cambio de contraseña
- `DeactivateUserUseCase` - Desactivar cuenta

### Tenants (de `services/tenant.ts`)

- `CreateTenantUseCase` - Crear organización
- `AddUserToTenantUseCase` - Agregar miembro con rol
- `RemoveUserFromTenantUseCase` - Eliminar miembro
- `ChangeUserRoleUseCase` - Cambiar rol en tenant

### Códigos PKCE (de `services/authCodeV2.ts`)

- `GenerateAuthCodeUseCase` - Crear code_challenge
- `ValidateAuthCodeUseCase` - Verificar PKCE flow

**Estructura típica:**

```typescript
// use-cases/LoginUseCase.ts
export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private tokenService: ITokenService,
    private eventBus: IEventBus,
    private hasher: IPasswordHasher
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    // 1. Validar input (DTO ya validado)

    // 2. Buscar usuario
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      return Result.fail(new InvalidCredentialsError());
    }

    // 3. Verificar contraseña
    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      return Result.fail(new InvalidCredentialsError());
    }

    // 4. Verificar tenant access
    if (!user.canAccessTenant(input.tenantId)) {
      return Result.fail(new TenantAccessDeniedError());
    }

    // 5. Crear sesión
    const session = await this.sessionRepository.create({
      userId: user.id,
      tenantId: input.tenantId,
      deviceInfo: input.deviceInfo,
    });

    // 6. Generar tokens
    const tokens = await this.tokenService.generate(session);

    // 7. Publicar evento
    await this.eventBus.publish(new UserLoggedInEvent(user.id, input.tenantId));

    // 8. Retornar resultado
    return Result.ok({
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      expiresIn: tokens.expiresIn,
    });
  }
}
```

---

## 📁 ports/input/ (Incoming Ports)

**Qué va aquí:** Interfaces que la aplicación expone al mundo exterior.

**Desde la implementación actual:**

```typescript
// ports/input/IAuthPort.ts
export interface IAuthPort {
  login(input: LoginInput): Promise<LoginResult>;
  logout(sessionId: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<TokenResult>;
}

// ports/input/ISessionPort.ts
export interface ISessionPort {
  createSession(input: CreateSessionInput): Promise<SessionResult>;
  validateSession(token: string): Promise<ValidationResult>;
  revokeSession(sessionId: string): Promise<void>;
  getActiveSessions(userId: string): Promise<Session[]>;
}

// ports/input/IUserPort.ts
export interface IUserPort {
  register(input: RegisterInput): Promise<UserResult>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<void>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
}

// ports/input/ITenantPort.ts
export interface ITenantPort {
  createTenant(input: CreateTenantInput): Promise<TenantResult>;
  addMember(tenantId: string, input: AddMemberInput): Promise<void>;
  removeMember(tenantId: string, userId: string): Promise<void>;
}
```

**Nota:** Los controllers de infraestructura implementan estos ports.

---

## 📁 ports/output/ (Outgoing Ports)

**Qué va aquí:** Interfaces que la aplicación necesita del mundo exterior.

**Desde la implementación actual:**

```typescript
// ports/output/ITokenService.ts
export interface ITokenService {
  generate(session: Session): Promise<Tokens>;
  validate(accessToken: string): Promise<TokenClaims>;
  revoke(tokenId: string): Promise<void>;
}

// ports/output/IEventBus.ts
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;
}

// ports/output/IEmailService.ts
export interface IEmailService {
  sendVerificationEmail(to: Email, token: string): Promise<void>;
  sendPasswordResetEmail(to: Email, token: string): Promise<void>;
  send2FAEmail(to: Email, code: string): Promise<void>;
}

// ports/output/ISmsService.ts
export interface ISmsService {
  send2FACode(phone: string, code: string): Promise<void>;
}

// ports/output/IAuditService.ts
export interface IAuditService {
  log(event: AuditEvent): Promise<void>;
  logSecurity(event: SecurityEvent): Promise<void>;
}

// ports/output/IPasswordHasher.ts
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hashed: string): Promise<boolean>;
}

// ports/output/ICacheService.ts
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

---

## 📁 dto/ (Data Transfer Objects)

**Qué va aquí:** Objetos planos para entrada/salida de casos de uso.

**Desde la implementación actual:**

### Input DTOs

```typescript
// dto/LoginInput.ts
export class LoginInput {
  email!: Email;
  password!: string;
  tenantId!: TenantId;
  deviceInfo?: DeviceInfo;
  appId?: string;
}

// dto/CreateSessionInput.ts
export class CreateSessionInput {
  userId!: UserId;
  tenantId!: TenantId;
  deviceInfo?: DeviceInfo;
  expiresIn?: number; // segundos
}

// dto/RegisterInput.ts
export class RegisterInput {
  email!: Email;
  password!: string;
  firstName!: string;
  lastName!: string;
  tenantName?: string;
}

// dto/ChangePasswordInput.ts
export class ChangePasswordInput {
  currentPassword!: string;
  newPassword!: string;
}
```

### Output DTOs

```typescript
// dto/LoginResult.ts
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: UserDto;
}

// dto/SessionResult.ts
export interface SessionResult {
  sessionId: string;
  accessToken: string;
  expiresAt: Date;
}

// dto/UserDto.ts (flat, no domain logic)
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: string;
  status: string;
}
```

---

## 📁 mappers/

**Qué va aquí:** Convierten entre entidades de dominio y DTOs.

**Desde la implementación actual:**

```typescript
// mappers/UserMapper.ts
export class UserMapper {
  static toDto(user: User): UserDto {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      systemRole: user.systemRole.value,
      status: user.userStatus,
    };
  }

  static toDomain(prismaUser: PrismaUser): User {
    return new User(
      UserId.create(prismaUser.id),
      Email.create(prismaUser.email),
      UserStatus.from(prismaUser.userStatus),
      SystemRole.from(prismaUser.systemRole),
      PasswordHash.from(prismaUser.passwordHash),
      prismaUser.tenantMemberships.map((m) => TenantMembershipMapper.toDomain(m))
    );
  }
}

// mappers/SessionMapper.ts
export class SessionMapper {
  static toDto(session: Session): SessionDto {
    return {
      id: session.id.value,
      userId: session.userId.value,
      tenantId: session.tenantId.value,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }
}
```

---

## 📁 services/ (Application Services)

**Qué va aquí:** Servicios que coordinan múltiples casos de uso o queries.

**Desde la implementación actual:**

```typescript
// services/AuthApplicationService.ts
export class AuthApplicationService {
  constructor(
    private loginUseCase: LoginUseCase,
    private logoutUseCase: LogoutUseCase,
    private refreshUseCase: RefreshTokenUseCase
  ) {}

  async authenticate(input: LoginInput): Promise<AuthResult> {
    // Coordinación de casos de uso
    const result = await this.loginUseCase.execute(input);

    if (result.isSuccess) {
      // Lógica adicional post-login
      await this.auditLogin(result.value);
    }

    return result;
  }

  async logout(sessionId: string, options?: LogoutOptions): Promise<void> {
    if (options?.global) {
      await this.logoutUseCase.executeGlobal(sessionId);
    } else {
      await this.logoutUseCase.execute(sessionId);
    }
  }
}

// services/SessionQueryService.ts
export class SessionQueryService {
  constructor(private sessionRepository: ISessionRepository) {}

  async getActiveSessionsForUser(userId: string): Promise<SessionDto[]> {
    const sessions = await this.sessionRepository.findActiveByUser(userId);
    return sessions.map(SessionMapper.toDto);
  }

  async getSessionStats(tenantId: string): Promise<SessionStats> {
    // Queries complejas que no son casos de uso
  }
}
```

---

## Checklist Application Layer

- [ ] Cada caso de uso es una clase con un solo método `execute`
- [ ] Casos de uso NO saben de HTTP, Express, JSON
- [ ] Usan DTOs para entrada/salida, no entidades directamente
- [ ] Mappers separan entidades de DTOs
- [ ] Ports definen interfaces claras para infraestructura
- [ ] Solo importan de `domain/`, nada de fuera
- [ ] Manejan errores de dominio y los convierten a resultados
