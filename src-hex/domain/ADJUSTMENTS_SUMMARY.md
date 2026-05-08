# Ajustes de Entidades de Dominio - Completados

## Resumen de Cambios

Todas las entidades han sido ajustadas para alinearse con el schema de Prisma.

### 1. User Entity ✅

**Cambios realizados:**

- ✅ Agregado `phone` (required en Prisma)
- ✅ Agregado `secondName`, `secondLastName`
- ✅ Agregado campos de información personal: `birthDate`, `gender`, `nationality`, `birthPlace`, `placeOfResidence`, `occupation`, `maritalStatus`
- ✅ Agregado `recoveryPhone`, `recoveryEmail`
- ✅ Agregado `addresses: Address[]` (embedded)
- ✅ Cambiado `systemRole`: `'admin'` → `'system_admin'` para coincidir con Prisma enum
- ✅ Agregado `'disabled'` a `UserStatus` (default en Prisma)
- ✅ Cambiado `nuid`: de `NUID | null` a `NUID` (required en Prisma)

**Nueva firma del constructor:**

```typescript
constructor(
  id: UserId,
  email: Email,
  nuid: NUID,              // Ahora required
  firstName: string,
  lastName: string,
  passwordHash: PasswordHash,
  userStatus: UserStatus,
  systemRole: SystemRole,   // 'system_admin' en lugar de 'admin'
  phone: string,            // NUEVO - required
  secondName: string | null,
  secondLastName: string | null,
  birthDate: Date | null,
  gender: string | null,
  nationality: string | null,
  birthPlace: string | null,
  placeOfResidence: string | null,
  occupation: string | null,
  maritalStatus: string | null,
  recoveryPhone: string | null,
  recoveryEmail: string | null,
  addresses: Address[],
  tenantMemberships: UserTenantMembership[],
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt?: Date
)
```

### 2. Session Entity ✅

**Cambios realizados:**

- ✅ Separado `Session` en dos clases distintas: `SSOSession` y `AppSession`
- ✅ Eliminado `isRevoked` y `revokedAt` (no existen en Prisma)
- ✅ Agregado `sessionToken: string` (el token único)
- ✅ Agregado `lastActivityAt: Date` (existe en Prisma)
- ✅ Agregado campos específicos de `AppSession`: `appId`, `role`, `ssoSessionId`
- ✅ Eliminado clase base `Session` abstracta, ahora son independientes

**Nueva estructura:**

```typescript
// SSOSession
constructor(
  id: SessionId,
  sessionToken: string,      // NUEVO
  userId: UserId,
  ip: string | null,
  userAgent: string | null,
  expiresAt: Date,
  createdAt: Date,
  lastActivityAt: Date       // NUEVO
)

// AppSession
constructor(
  id: SessionId,
  sessionToken: string,       // NUEVO
  userId: UserId,
  tenantId: TenantId,
  appId: string,             // NUEVO
  role: string,              // NUEVO
  ip: string | null,
  userAgent: string | null,
  expiresAt: Date,
  createdAt: Date,
  lastActivityAt: Date,        // NUEVO
  ssoSessionId?: string       // NUEVO
)
```

### 3. RefreshToken Entity ✅

**Cambios realizados:**

- ✅ Eliminado `sessionId` (no existe en Prisma)
- ✅ Eliminado `family` (no existe en Prisma)
- ✅ Eliminado `status` enum (Prisma usa `revoked: boolean`)
- ✅ Cambiado `replacedBy` → `previousTokenId` (mismo concepto, nombre de Prisma)
- ✅ Agregado `clientId`, `ip`, `userAgent` (existen en Prisma)
- ✅ Simplificado métodos de rotación

**Nueva firma:**

```typescript
constructor(
  id: RefreshTokenId,
  userId: UserId,
  tokenHash: string,
  createdAt: Date,
  expiresAt: Date,
  revoked: boolean = false,           // En lugar de status enum
  previousTokenId: RefreshTokenId | null = null,
  clientId: string | null = null,      // NUEVO
  ip: string | null = null,            // NUEVO
  userAgent: string | null = null      // NUEVO
)
```

### 4. AuthCode Entity ✅

**Cambios realizados:**

- ✅ Eliminado `AuthCodeChallenge` value object encapsulado
- ✅ Agregado campos planos: `code`, `redirectUri`, `codeChallenge`, `codeChallengeMethod`, `state`, `nonce`, `ssoSessionId`
- ✅ Cambiado `status` enum → `used: boolean` (Prisma usa boolean)
- ✅ Eliminado `applicationId` value object → `appId: string` (Prisma)

**Nueva firma:**

```typescript
constructor(
  id: AuthCodeId,
  code: string,                      // NUEVO
  userId: UserId,
  tenantId: TenantId,
  appId: string,                     // Cambiado de ApplicationId
  redirectUri: string,               // NUEVO
  expiresAt: Date,
  createdAt: Date,
  used: boolean = false,           // En lugar de status enum
  codeChallenge: string | null = null,
  codeChallengeMethod: string | null = null,
  state: string | null = null,
  nonce: string | null = null,
  ssoSessionId: string | null = null
)
```

### 5. Application Entity ✅

**Cambios realizados:**

- ✅ Eliminado `clientId` separado → ahora es `appId` (el identificador único)
- ✅ Eliminado `status` enum → `isActive: boolean` (Prisma)
- ✅ Agregado campos: `url`, `logoUrl`, `backendUrl`, `audience`, `scope`
- ✅ Eliminado `redirectUris: string[]` (no existe en Prisma como array)
- ✅ Eliminado `isPublic: boolean` (no existe en Prisma)
- ✅ Agregado `scope: string[]` (existe en Prisma)

**Nueva firma:**

```typescript
constructor(
  id: ApplicationId,
  appId: string,                    // Identificador único
  name: string,
  url: string,                       // NUEVO
  description: string | null,
  logoUrl: string | null,            // NUEVO
  backendUrl: string | null,         // NUEVO
  isActive: boolean,                // En lugar de status enum
  audience: string | null,           // NUEVO
  scope: string[],                   // NUEVO
  createdAt: Date,
  updatedAt: Date
)
```

### 6. TenantApplication Entity ✅

**Cambios realizados:**

- ✅ Agregado `id: string` (tiene ID propio en Prisma)
- ✅ Eliminado `customScopes: string[]` (no existe en Prisma)
- ✅ Eliminado `enabledAt`, `disabledAt` (no existen en Prisma)
- ✅ Agregado `config: Record<string, any> | null` (JSON en Prisma)
- ✅ Agregado `createdAt`, `updatedAt` timestamps

**Nueva firma:**

```typescript
constructor(
  id: string,                       // NUEVO
  tenantId: TenantId,
  applicationId: ApplicationId,
  isEnabled: boolean,
  config: Record<string, any> | null,  // NUEVO - JSON
  createdAt: Date,
  updatedAt: Date
)
```

### 7. Role Entity - Sin cambios mayores ✅

La entidad `Role` ya estaba bien alineada.

### 8. EmailVerification Entity - Sin cambios mayores ✅

Ya estaba bien alineada con `verified: boolean`.

### 9. OtpSecret Entity - Renombrar ✅

En Prisma es `OTPSecret` (mayúsculas), en dominio `OtpSecret`. Esto es solo convención de nomenclatura, no afecta la funcionalidad.

## Errores Esperados

Los siguientes archivos en Application Layer necesitan actualización:

1. **RegisterUserUseCase.ts** - Necesita proporcionar todos los nuevos campos required
2. **LoginUseCase.ts** - SSOSession constructor cambió
3. **LogoutUseCase.ts** - Session ya no tiene método `revoke()`
4. **RefreshTokenUseCase.ts** - RefreshToken ya no tiene `family`, `sessionId`
5. **CreateAppSessionUseCase.ts** - AppSession constructor cambió

## Próximos Pasos

1. Actualizar los use cases para usar las nuevas firmas de entidades
2. Actualizar los mappers en los repositories de Infrastructure
3. Verificar que todo compile correctamente

¿Quieres que proceda a actualizar los use cases también?
