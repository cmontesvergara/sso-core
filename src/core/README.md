# Core Module

El módulo **Core** centraliza toda la arquitectura de dominio, tipos y contratos del sistema SSO. Está organizado en subcarpetas especializadas para mantener una separación clara de responsabilidades.

## 📁 Estructura

```
src/core/
├── entities/          # Entidades de dominio
│   ├── user.entity.ts
│   ├── auth.entity.ts
│   ├── tenant.entity.ts
│   ├── types.ts
│   └── index.ts
├── dtos/              # Data Transfer Objects
│   ├── user.dto.ts
│   ├── auth.dto.ts
│   ├── address.dto.ts
│   ├── tenant.dto.ts
│   ├── other-information.dto.ts
│   └── index.ts
├── interfaces/        # Contratos de servicios y repositorios
│   ├── repository.interface.ts
│   ├── service.interface.ts
│   └── index.ts
├── mappers/          # Funciones de transformación
│   ├── user.mapper.ts
│   ├── auth.mapper.ts
│   ├── address.mapper.ts
│   ├── tenant.mapper.ts
│   ├── other-information.mapper.ts
│   └── index.ts
├── schemas/          # Esquemas de validación Joi
│   ├── auth.schema.ts
│   ├── user.schema.ts
│   ├── address.schema.ts
│   ├── tenant.schema.ts
│   ├── otp.schema.ts
│   ├── email-verification.schema.ts
│   └── index.ts
└── index.ts          # Barrel export principal
```

## 📦 Módulos

### 1️⃣ Entities (Entidades)

**Propósito:** Representan la estructura de datos del dominio basada en el esquema de Prisma.

**Archivos:**

- `user.entity.ts` - User, UserBasicInfo, Address, OtherInformation
- `auth.entity.ts` - RefreshToken, EmailVerification, OTPSecret
- `tenant.entity.ts` - Tenant, TenantMember, Role, Permission
- `types.ts` - Tipos auxiliares (UserStatus, Gender, MaritalStatus, etc.)

**Uso:**

```typescript
import { User, Tenant, Role } from '@/core/entities';

const user: User = {
  id: '...',
  email: 'user@example.com',
  // ... otros campos
};
```

### 2️⃣ DTOs (Data Transfer Objects)

**Propósito:** Definen la estructura de datos para requests y responses de la API.

**Convención de nombres:**

- `CreateXDTO` - Para crear recursos
- `UpdateXDTO` - Para actualizar recursos
- `XResponseDTO` - Para respuestas de la API
- `XRequestDTO` - Para peticiones específicas

**Archivos:**

- `user.dto.ts` - CreateUserDTO, UpdateUserDTO, UserResponseDTO, UserDetailResponseDTO
- `auth.dto.ts` - SignupRequestDTO, SigninRequestDTO, TokenResponseDTO, etc.
- `address.dto.ts` - CreateAddressDTO, UpdateAddressDTO, AddressResponseDTO
- `tenant.dto.ts` - CreateTenantDTO, RoleResponseDTO, PermissionResponseDTO, etc.
- `other-information.dto.ts` - Usa tipos Prisma.JsonValue

**Uso:**

```typescript
import { CreateUserDTO, UserResponseDTO } from '@/core/dtos';

const createUserData: CreateUserDTO = {
  email: 'user@example.com',
  password: 'securepass',
  firstName: 'John',
  lastName: 'Doe',
};
```

### 3️⃣ Interfaces (Contratos)

**Propósito:** Definen contratos para servicios y repositorios.

**Archivos:**

- `repository.interface.ts` - Contratos para capa de datos
  - `IUserRepository`, `IAddressRepository`, `ITenantRepository`
  - `IRoleRepository`, `IPermissionRepository`
  - `IRefreshTokenRepository`, `IOTPSecretRepository`, `IEmailVerificationRepository`
- `service.interface.ts` - Contratos para lógica de negocio
  - `IAuthenticationService`, `IUserService`, `ITenantService`
  - `IOTPService`, `IEmailService`

**Uso:**

```typescript
import { IUserRepository } from '@/core/interfaces';

class UserRepositoryImpl implements IUserRepository {
  async createUser(data: unknown): Promise<unknown> {
    // Implementación
  }
  // ... otros métodos
}
```

### 4️⃣ Mappers (Transformadores)

**Propósito:** Transforman entidades de Prisma a DTOs para la API.

**Funciones principales:**

- `mapUserToResponse()` - User básico sin campos sensibles
- `mapUserToDetailResponse()` - User con información completa
- `mapAddressToResponse()` - Address a DTO
- `mapTenantToResponse()` - Tenant a DTO
- `mapTenantMemberToResponse()` - TenantMember con user opcional
- `mapRoleToResponse()` - Role con permissions opcionales
- `mapPermissionToResponse()` - Permission a DTO
- `mapEmailVerificationToResponse()` - EmailVerification a DTO
- `mapOtherInformationToResponse()` - OtherInformation a DTO
- `sanitizeUser()` - Remueve passwordHash

**Uso:**

```typescript
import { mapUserToResponse } from '@/core/mappers';
import { User as PrismaUser } from '@prisma/client';

const user: PrismaUser = await prisma.user.findUnique({ where: { id } });
const userDTO = mapUserToResponse(user); // Sin passwordHash
```

### 5️⃣ Schemas (Validación)

**Propósito:** Esquemas de validación Joi para endpoints de la API.

**Archivos:**

- `auth.schema.ts` - signupSchema, signinSchema, refreshSchema, signoutSchema, changePasswordSchema
- `user.schema.ts` - createUserSchema, updateUserSchema, userIdSchema, listUsersSchema
- `address.schema.ts` - createAddressSchema, updateAddressSchema, addressIdSchema
- `tenant.schema.ts` - createTenantSchema, createRoleSchema, createPermissionSchema
- `otp.schema.ts` - generateOTPSchema, verifyOTPSchema, enableOTPSchema
- `email-verification.schema.ts` - createEmailVerificationSchema, verifyEmailSchema

**Uso:**

```typescript
import { signupSchema, createUserSchema } from '@/core/schemas';

router.post('/signup', async (req, res, next) => {
  const { error, value } = signupSchema.validate(req.body);
  if (error) {
    // Manejar error de validación
  }
  // Procesar value validado
});
```

## 🎯 Patrones de Uso

### Crear un nuevo endpoint

1. **Definir DTO en `dtos/`**

```typescript
// src/core/dtos/feature.dto.ts
export interface CreateFeatureDTO {
  name: string;
  description: string;
}

export interface FeatureResponseDTO {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}
```

2. **Crear schema de validación en `schemas/`**

```typescript
// src/core/schemas/feature.schema.ts
import Joi from 'joi';

export const createFeatureSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
});
```

3. **Definir mapper en `mappers/`**

```typescript
// src/core/mappers/feature.mapper.ts
import { Feature as PrismaFeature } from '@prisma/client';
import { FeatureResponseDTO } from '../dtos';

export function mapFeatureToResponse(feature: PrismaFeature): FeatureResponseDTO {
  return {
    id: feature.id,
    name: feature.name,
    description: feature.description,
    createdAt: feature.createdAt,
  };
}
```

4. **Usar en ruta**

```typescript
// src/routes/feature.ts
import { createFeatureSchema } from '../core/schemas';
import { mapFeatureToResponse } from '../core/mappers';

router.post('/features', async (req, res, next) => {
  const { error, value } = createFeatureSchema.validate(req.body);
  if (error) throw new AppError(400, 'Invalid input');

  const feature = await featureService.create(value);
  const response = mapFeatureToResponse(feature);

  res.status(201).json({ success: true, data: response });
});
```

## 🔄 Flujo de Datos

```
Request → Route → Validation (Schema) → Service → Repository → Prisma → Database
                                           ↓
Response ← Route ← Mapper ← DTO ← Service ←─────────────────────┘
```

## 📝 Convenciones

### Nomenclatura

- **Entities**: Singular, sufijo `.entity.ts` (ej: `user.entity.ts`)
- **DTOs**: Sufijo `DTO`, archivo `.dto.ts` (ej: `CreateUserDTO`)
- **Interfaces**: Prefijo `I`, sufijo `.interface.ts` (ej: `IUserService`)
- **Mappers**: Prefijo `map`, sufijo `.mapper.ts` (ej: `mapUserToResponse`)
- **Schemas**: Sufijo `Schema`, archivo `.schema.ts` (ej: `signupSchema`)

### Exports

Cada subcarpeta tiene un `index.ts` que re-exporta todo:

```typescript
// src/core/index.ts
export * from './entities';
export * from './dtos';
export * from './interfaces';
export * from './mappers';
export * from './schemas';
```

Importa desde `@/core`:

```typescript
import { User, CreateUserDTO, mapUserToResponse, signupSchema } from '@/core';
```

### Tipos

- ✅ Usar tipos específicos de Prisma cuando sea necesario
- ✅ Usar `unknown` en interfaces genéricas en lugar de `any`
- ✅ Usar `| null` para campos opcionales de Prisma
- ✅ Usar `Record<string, unknown>` para objetos dinámicos simples
- ✅ Usar `Prisma.JsonValue` / `Prisma.InputJsonValue` para campos JSON de Prisma

## 🚀 Beneficios

1. **Organización**: Estructura clara y predecible
2. **Mantenibilidad**: Fácil encontrar y modificar código
3. **Reutilización**: Componentes compartidos entre módulos
4. **Type Safety**: TypeScript completo en toda la aplicación
5. **Validación**: Esquemas Joi centralizados
6. **Separación**: Clara separación entre entidades, DTOs y mappers
7. **Escalabilidad**: Fácil agregar nuevas funcionalidades

## 📚 Dependencias

- `@prisma/client` - Cliente ORM de Prisma
- `joi` - Validación de esquemas

## 🔗 Relacionado

- [PRISMA_ALIGNED_ARCHITECTURE.md](../PRISMA_ALIGNED_ARCHITECTURE.md) - Arquitectura completa
- [prisma/schema.prisma](../prisma/schema.prisma) - Esquema de base de datos

## 📌 Notas

- El módulo core **no debe** importar de otros módulos como `services/`, `repositories/` o `routes/`
- Otros módulos **deben** importar del core para tipos, DTOs y schemas
- Las interfaces son contratos - las implementaciones están en otros módulos
- Los mappers solo transforman, no contienen lógica de negocio
