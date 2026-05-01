# Validación: Entidades de Dominio vs Schema de Prisma

## Resumen Ejecutivo

| Entidad Dominio       | Tabla Prisma                | Estado        | Diferencias               |
| --------------------- | --------------------------- | ------------- | ------------------------- |
| **User**              | `User`                      | ✅ Compatible | Revisar campos opcionales |
| **Session**           | `SSOSession` + `AppSession` | ⚠️ Ajustar    | Separar en dos modelos    |
| **Tenant**            | `Tenant`                    | ⚠️ Revisar    | Faltan campos en dominio  |
| **RefreshToken**      | `RefreshToken`              | ✅ Compatible | Coincide bien             |
| **AuthCode**          | `AuthCode`                  | ⚠️ Ajustar    | Campos PKCE opcionales    |
| **Application**       | `Application`               | ✅ Compatible | Coincide bien             |
| **Role**              | `Role`                      | ✅ Compatible | Coincide bien             |
| **EmailVerification** | `EmailVerification`         | ✅ Compatible | Coincide bien             |
| **OtpSecret**         | `OTPSecret`                 | ⚠️ Renombrar  | Diferente case            |

---

## 1. User Entity

### Dominio (`src-hex/domain/entities/User.ts`)

```typescript
User {
  id: UserId
  email: Email
  nuid: NUID | null
  firstName: string
  lastName: string
  passwordHash: PasswordHash
  userStatus: 'active' | 'inactive' | 'pending' | 'suspended'
  systemRole: 'super_admin' | 'admin' | 'user'
  tenantMemberships: UserTenantMembership[]
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}
```

### Prisma (`prisma/schema.prisma`)

```prisma
model User {
  id               String @id
  email            String @unique
  firstName        String @map("first_name")
  secondName       String? @map("second_name")     // ❌ No en dominio
  lastName         String @map("last_name")
  secondLastName   String? @map("second_last_name") // ❌ No en dominio
  phone            String                           // ❌ No en dominio
  nuid             String @unique
  addresses        Address[]                        // ❌ No en dominio
  birthDate        DateTime? @map("birth_date")     // ❌ No en dominio
  gender           String?                          // ❌ No en dominio
  nationality      String?                          // ❌ No en dominio
  birthPlace       String? @map("place_of_birth")   // ❌ No en dominio
  placeOfResidence String? @map("place_of_residence") // ❌ No en dominio
  occupation       String?                          // ❌ No en dominio
  maritalStatus    String? @map("marital_status")  // ❌ No en dominio
  userStatus       String @default("disabled") @map("user_status")
  passwordHash     String @map("password_hash")
  recoveryPhone    String? @map("recovery_phone")  // ❌ No en dominio
  recoveryEmail    String? @map("recovery_email")  // ❌ No en dominio
  systemRole       SystemRole @default(user) @map("system_role")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // Relaciones omitidas
}

enum SystemRole {
  super_admin
  system_admin  // ⚠️ En Prisma: 'system_admin', en dominio: 'admin'
  user
}
```

### Análisis

- ✅ **Campos core presentes**: id, email, nuid, firstName, lastName, passwordHash, userStatus, systemRole, createdAt, updatedAt
- ⚠️ **Diferencias SystemRole**: Dominio usa `'admin'`, Prisma usa `'system_admin'`
- ❌ **Falta en Dominio**: phone (required en Prisma), secondName, secondLastName
- ❌ **Falta en Dominio**: Campos de información adicional (birthDate, gender, etc.)
- ❌ **Falta en Dominio**: recoveryPhone, recoveryEmail
- ❌ **Mapeo tenantMemberships**: En Prisma es `tenantMembers` (relación)

### Recomendación

```typescript
// Agregar a User entity:
- phone: string  // REQUIRED en Prisma
- secondName?: string
- secondLastName?: string
- recoveryPhone?: string
- recoveryEmail?: string
- birthDate?: Date
- gender?: string
- nationality?: string
- birthPlace?: string
- placeOfResidence?: string
- occupation?: string
- maritalStatus?: string

// O crear entidades separadas para:
- UserProfile (información adicional)
- UserRecovery (información de recuperación)
```

---

## 2. Session Entity

### Dominio (`src-hex/domain/entities/Session.ts`)

```typescript
Session {
  id: SessionId
  userId: UserId
  tenantId: TenantId | null
  type: 'sso' | 'app'
  createdAt: Date
  expiresAt: Date
  deviceFingerprint: DeviceFingerprint
  isRevoked: boolean
  revokedAt?: Date
}
```

### Prisma

```prisma
// SSOSession
model SSOSession {
  id             String   @id
  sessionToken   String   @unique @map("session_token")
  userId         String   @map("user_id") @db.Uuid
  ip             String?
  userAgent      String?  @map("user_agent")
  expiresAt      DateTime @map("expires_at")
  createdAt      DateTime @default(now())
  lastActivityAt DateTime @default(now()) @map("last_activity_at")
  // ❌ No tiene: isRevoked, revokedAt
}

// AppSession
model AppSession {
  id             String   @id
  sessionToken   String   @unique @map("session_token")
  appId          String   @map("app_id")
  userId         String   @map("user_id")
  tenantId       String   @map("tenant_id")
  role           String
  ssoSessionId   String?  @map("sso_session_id")  // ❌ No en dominio
  ip             String?
  userAgent      String?  @map("user_agent")
  expiresAt      DateTime @map("expires_at")
  createdAt      DateTime @default(now())
  lastActivityAt DateTime @default(now())
  // ❌ No tiene: isRevoked, revokedAt
}
```

### Análisis

- ✅ **Estructura separada**: Prisma tiene SSOSession y AppSession separados
- ⚠️ **lastActivityAt**: Presente en Prisma, no en dominio
- ⚠️ **sessionToken**: Prisma tiene campo adicional (usado como sessionId)
- ❌ **role en AppSession**: No existe en dominio
- ❌ **ssoSessionId**: Referencia a sesión SSO en AppSession
- ❌ **isRevoked/revokedAt**: Soft delete no implementado en Prisma

### Recomendación

```typescript
// Agregar a Session entity:
+ lastActivityAt: Date
+ sessionToken: string  // Token único de la sesión

// Para AppSession específicamente:
+ role: string
+ ssoSessionId?: string

// Opciones para isRevoked:
1. Agregar campo a tablas Prisma (recomendado)
2. Usar expiresAt en el pasado para "revocar"
3. Mantener revocación solo en Redis
```

---

## 3. RefreshToken Entity

### Dominio

```typescript
RefreshToken {
  id: RefreshTokenId
  userId: UserId
  sessionId: SessionId
  tokenHash: string
  family: string
  createdAt: Date
  expiresAt: Date
  status: 'active' | 'revoked' | 'expired'
  revokedAt?: Date
  replacedBy?: RefreshTokenId
}
```

### Prisma

```prisma
model RefreshToken {
  id              String   @id
  userId          String   @map("user_id")
  tokenHash       String   @unique @map("token_hash")
  clientId        String?  @map("client_id")      // ⚠️ No en dominio
  createdAt       DateTime @default(now())
  expiresAt       DateTime @map("expires_at")
  revoked         Boolean  @default(false)
  previousTokenId String?  @map("previous_token_id")
  ip              String?                          // ⚠️ No en dominio
  userAgent       String?  @map("user_agent")     // ⚠️ No en dominio
}
```

### Análisis

- ⚠️ **sessionId**: En dominio hay sessionId, en Prisma no (solo userId)
- ⚠️ **family**: En dominio, en Prisma se deriva de previousTokenId
- ⚠️ **status**: En dominio es enum, en Prisma es `revoked` boolean
- ⚠️ **replacedBy**: En dominio, en Prisma es `previousTokenId` (invertido)
- ❌ **clientId, ip, userAgent**: En Prisma, no en dominio

### Recomendación

```typescript
// Sincronizar nombres:
- En dominio: previousTokenId en lugar de replacedBy (coincide con Prisma)
- O mantener replacedBy y mapear en repository

// Agregar a RefreshToken:
+ clientId?: string
+ ip?: string
+ userAgent?: string

// Considerar:
- Agregar sessionId a tabla Prisma (para relación directa)
- O mantener solo userId y buscar sesión por token
```

---

## 4. AuthCode Entity

### Dominio

```typescript
AuthCode {
  id: AuthCodeId
  userId: UserId
  tenantId: TenantId
  applicationId: ApplicationId
  challenge: AuthCodeChallenge
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'exchanged' | 'revoked'
  usedAt?: Date
}
```

### Prisma

```prisma
model AuthCode {
  id                   String   @id
  code                 String   @unique
  userId               String   @map("user_id")
  tenantId             String   @map("tenant_id")
  appId                String   @map("app_id")          // ⚠️ No ApplicationId
  redirectUri          String   @map("redirect_uri")    // ❌ No en dominio
  ssoSessionId         String?  @map("sso_session_id") // ❌ No en dominio
  used                 Boolean  @default(false)
  expiresAt            DateTime @map("expires_at")
  createdAt            DateTime @default(now())
  codeChallenge        String?  @map("code_challenge")
  codeChallengeMethod  String?  @map("code_challenge_method")
  state                String?
  nonce                String?
}
```

### Análisis

- ✅ **Campos core**: code, userId, tenantId, appId, expiresAt, createdAt
- ⚠️ **appId vs applicationId**: En Prisma es string, en dominio es ApplicationId
- ⚠️ **used**: En Prisma es boolean, en dominio es status enum
- ❌ **redirectUri**: En Prisma, no en dominio
- ❌ **ssoSessionId**: En Prisma, no en dominio
- ❌ **code, codeChallenge, codeChallengeMethod**: En Prisma como campos planos, en dominio encapsulados en `challenge: AuthCodeChallenge`

### Recomendación

```typescript
// Agregar a AuthCode:
+ code: string                    // El código real
+ redirectUri: string
+ ssoSessionId?: string
+ state?: string
+ nonce?: string

// El challenge en dominio puede construirse de:
- codeChallenge
- codeChallengeMethod
```

---

## 5. Application Entity

### Dominio

```typescript
Application {
  id: ApplicationId
  name: string
  clientId: string
  description: string
  redirectUris: string[]
  allowedScopes: string[]
  status: 'active' | 'inactive' | 'pending_approval'
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Prisma

```prisma
model Application {
  id          String   @id
  appId       String   @unique @map("app_id")  // ⚠️ Coincide con clientId
  name        String
  url         String                           // ❌ No en dominio
  description String?
  logoUrl     String?  @map("logo_url")        // ❌ No en dominio
  backendUrl  String?  @map("backend_url")      // ❌ No en dominio
  isActive    Boolean  @default(true)          // ⚠️ vs status
  audience    String?                          // ❌ No en dominio
  scope       String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Análisis

- ⚠️ **clientId vs appId**: Mismo concepto, diferente nombre
- ⚠️ **isActive vs status**: Prisma usa boolean, dominio usa enum
- ❌ **url, logoUrl, backendUrl, audience**: En Prisma, no en dominio
- ⚠️ **redirectUris**: En dominio, no en Prisma (¿dónde se guardan?)

### Recomendación

```typescript
// Agregar a Application:
+ url: string
+ logoUrl?: string
+ backendUrl?: string
+ audience?: string
+ isActive: boolean  // Usar boolean en lugar de status enum

// Revisar:
- Dónde se guardan redirectUris en Prisma
```

---

## 6. Role Entity

### Dominio

```typescript
Role {
  id: RoleId
  name: RoleName
  description: string
  permissions: Permission[]
  isSystem: boolean
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}
```

### Prisma

```prisma
model Role {
  id        String   @id
  tenantId  String   @map("tenant_id")
  name      String
  createdAt DateTime @default(now())
  // ❌ No tiene: description, isSystem, status
  // permissions está en modelo separado Permission
}

model Permission {
  id            String
  roleId        String
  applicationId String
  resource      String
  action        String
  createdAt     DateTime
  // En dominio es parte de Role.permissions
}
```

### Análisis

- ⚠️ **tenantId**: En Prisma cada rol pertenece a un tenant, en dominio no está claro
- ⚠️ **description, isSystem, status**: En dominio, no en Prisma
- ⚠️ **permissions**: En dominio es array embebido, en Prisma es tabla separada

### Recomendación

```typescript
// Agregar campos a Role en Prisma:
+ description: string?
+ isSystem: Boolean @default(false)
+ isActive: Boolean @default(true)  // o status enum

// O mantener separación:
- permissions como tabla separada (más flexible)
- mapear en repository
```

---

## 7. EmailVerification Entity

### Dominio

```typescript
EmailVerification {
  id: string
  userId: UserId
  email: Email
  token: string
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'verified' | 'expired'
  verifiedAt?: Date
}
```

### Prisma

```prisma
model EmailVerification {
  id        String   @id
  userId    String   @map("user_id")
  token     String   @unique
  email     String
  verified  Boolean  @default(false)  // ⚠️ vs status
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now())
  // ❌ No tiene: verifiedAt
}
```

### Análisis

- ✅ **Campos core**: id, userId, token, email, expiresAt, createdAt
- ⚠️ **verified vs status**: Prisma usa boolean, dominio usa enum
- ❌ **verifiedAt**: En dominio, no en Prisma

### Recomendación

```typescript
// Opción 1: Agregar verifiedAt a Prisma
// Opción 2: Usar updatedAt como verifiedAt en caso de verified=true
```

---

## 8. OtpSecret Entity

### Dominio

```typescript
OtpSecret {
  id: string
  userId: UserId
  secret: string
  backupCodes: string[]
  status: 'active' | 'inactive'
  createdAt: Date
  lastUsedAt?: Date
  verifiedAt?: Date
}
```

### Prisma

```prisma
model OTPSecret {
  id          String   @id
  userId      String   @unique @map("user_id")
  secret      String
  verified    Boolean  @default(false)  // ⚠️ vs status
  backupCodes String[] @map("backup_codes")
  createdAt   DateTime @default(now())
  // ❌ No tiene: lastUsedAt, verifiedAt
}
```

### Análisis

- ✅ **Campos core**: id, userId, secret, backupCodes, createdAt
- ⚠️ **verified vs status**: Prisma usa boolean, dominio usa enum
- ❌ **lastUsedAt, verifiedAt**: En dominio, no en Prisma

### Recomendación

```typescript
// Agregar a OTPSecret (Prisma):
+ lastUsedAt DateTime? @map("last_used_at")
+ verifiedAt DateTime? @map("verified_at")
```

---

## Tabla Resumen de Ajustes

| Prioridad | Entidad      | Acción                             | Esfuerzo |
| --------- | ------------ | ---------------------------------- | -------- |
| Alta      | User         | Agregar campos opcionales          | Medio    |
| Alta      | Session      | Agregar isRevoked + lastActivityAt | Medio    |
| Media     | RefreshToken | Agregar sessionId                  | Bajo     |
| Media     | AuthCode     | Agregar PKCE campos a dominio      | Bajo     |
| Media     | Application  | Agregar campos URL                 | Bajo     |
| Baja      | Role         | Agregar description, isSystem      | Bajo     |
| Baja      | OTPSecret    | Renombrar + agregar timestamps     | Bajo     |

---

## Conclusión

La mayoría de las entidades de dominio son **compatibles** con el schema de Prisma, pero hay **diferencias menores** que deben ajustarse:

1. **Campos opcionales**: El dominio es más "puro" y omite campos opcionales que Prisma requiere
2. **Estados/Status**: Prisma usa booleanos (`isActive`, `verified`), dominio usa enums
3. **Timestamps**: Algunos campos de auditoría faltan en Prisma (`verifiedAt`, `lastUsedAt`)
4. **Relaciones**: Algunas relaciones están modeladas diferente (ej: permissions)

### Próximos Pasos Recomendados

1. **Sincronizar User**: Agregar campos requeridos por Prisma (phone, etc.)
2. **Sincronizar Session**: Agregar `isRevoked` y `lastActivityAt`
3. **Mapear enums a booleanos**: Crear helpers para convertir entre status enum y booleanos
4. **Agregar timestamps faltantes** a tablas Prisma si son necesarios para lógica de negocio
5. **Revisar relaciones**: Verificar si las diferencias en relaciones afectan la lógica

### Estrategia de Mapeo

En los repositories, usar mappers para manejar las diferencias:

```typescript
// Ejemplo de mapper
private mapToDomain(prismaUser: any): User {
  return new User(
    UserId.create(prismaUser.id),
    Email.createUnsafe(prismaUser.email),
    // Campos opcionales mapeados con valores por defecto si es necesario
    prismaUser.nuid ? NUID.create(prismaUser.nuid) : null,
    // ... resto de campos
  );
}
```
