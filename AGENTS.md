# AGENTS.md — Contexto para Agentes de IA

## 🎯 Descripción del Proyecto

BIGSO IdP Core es un **Identity Provider empresarial** open-source construido con arquitectura hexagonal. Proporciona autenticación centralizada (SSO), multi-tenancy con RLS, y RBAC granular.

**Stack principal:** TypeScript + Express + Prisma + PostgreSQL + Redis

**Repositorio:** `/Users/cmontes/BIGSO/sso/idp-core`

---

## 📁 Estructura del Proyecto

```
idp-core/
├── src-hex/                    # 🏗️ Código fuente principal (arquitectura hexagonal)
│   ├── domain/                 # Entidades, value objects, errores de dominio
│   ├── application/            # Casos de uso, DTOs, ports
│   ├── infrastructure/         # Implementaciones concretas (Prisma, Redis, Express)
│   ├── interfaces/             # Entry points (HTTP, CLI, Events)
│   └── __tests__/              # Tests organizados por capa
├── docs/shared/                # 📚 Documentación técnica
├── prisma/                     # Schema y migraciones de Prisma
├── migrations/                 # Migraciones SQL (node-pg-migrate)
├── keys/                       # Claves JWT (no commitear)
├── config.yaml                 # Configuración centralizada
└── index.ts                    # Entry point (selección de modo)
```

### Convenciones de Carpetas (src-hex/)

| Capa | Propósito | Regla de Dependencias |
|------|-----------|----------------------|
| `domain/` | Lógica de negocio pura | No importa de ninguna otra capa |
| `application/` | Orquestación de casos de uso | Solo importa de `domain/` |
| `infrastructure/` | Implementaciones de frameworks | Importa de `application/` y `domain/` |
| `interfaces/` | Adaptadores externos | Importa de `infrastructure/` |

---

## 🧠 Contexto de Arquitectura

### Clean Architecture / Ports & Adapters

Las dependencias siempre apuntan hacia adentro (hacia Domain):

```
Domain ← Application ← Infrastructure ← Interfaces
```

**Reglas absolutas:**
1. **Domain** no tiene imports externos (solo TypeScript puro)
2. **Application** solo importa de Domain
3. **Infrastructure** implementa los ports definidos en Application
4. **Interfaces** conecta el mundo exterior con Infrastructure

### Casos de Uso Principales

Ubicados en `src-hex/application/use-cases/`:

| Caso de Uso | Archivo | Descripción |
|-------------|---------|-------------|
| Login | `auth/LoginUseCase.ts` | Autenticación con credenciales |
| Register | `user/RegisterUserUseCase.ts` | Registro de usuarios |
| Refresh Token | `auth/RefreshTokenUseCase.ts` | Rotación de refresh tokens |
| Create Session | `session/CreateSessionUseCase.ts` | Crear sesión SSO |
| Authorize | `auth/AuthorizeUseCase.ts` | Generar authorization code |

### Entidades Principales (Domain)

Ubicadas en `src-hex/domain/entities/`:

| Entidad | Archivo | Responsabilidad |
|---------|---------|-----------------|
| User | `User.ts` | Usuario, credenciales, memberships |
| Session | `Session.ts` | Sesión SSO con expiry |
| Tenant | `Tenant.ts` | Organización y aislamiento |
| Role | `Role.ts` | Roles y permisos |
| Application | `Application.ts` | Aplicaciones registradas |

---

## 🔧 Tareas Comunes

### Agregar un Caso de Uso

```typescript
// 1. Crear en src-hex/application/use-cases/[modulo]/
// Ejemplo: src-hex/application/use-cases/user/UpdateProfileUseCase.ts

import { IUserRepository } from '../../ports/output/IUserRepository';
import { User } from '../../../domain/entities/User';

export class UpdateProfileUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(userId: string, data: UpdateProfileInput): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UserNotFoundError(userId);
    
    user.updateProfile(data);
    await this.userRepo.save(user);
  }
}

// 2. Crear DTOs input/output en src-hex/application/dto/
// 3. Crear o actualizar controller en src-hex/infrastructure/web/controllers/
// 4. Agregar ruta en src-hex/infrastructure/web/routes/
// 5. Registrar dependencias en src-hex/interfaces/http/Bootstrap.ts
```

### Agregar una Entidad de Dominio

```typescript
// src-hex/domain/entities/NewEntity.ts

export class NewEntity {
  constructor(
    public readonly id: string,
    // ... props
  ) {
    // Validaciones
  }
  
  // Métodos de dominio (sin imports externos)
  doSomething(): Result<void> {
    // lógica de negocio
  }
}

// Opcional: Agregar evento de dominio
// src-hex/domain/events/NewEntityCreatedEvent.ts
```

### Agregar un Puerto (Port)

```typescript
// src-hex/application/ports/output/INewService.ts

export interface INewService {
  doSomething(input: string): Promise<Result<string>>;
}

// Implementar en infrastructure:
// src-hex/infrastructure/external-services/NewServiceImpl.ts
```

### Agregar una Ruta HTTP

```typescript
// src-hex/infrastructure/web/routes/new.routes.ts

import { Router } from 'express';
import { NewController } from '../controllers/NewController';

export const createNewRoutes = (controller: NewController): Router => {
  const router = Router();
  
  router.post('/new-endpoint', controller.handle.bind(controller));
  
  return router;
};

// Registrar en src-hex/infrastructure/web/routes/index.ts
// y proporcionar controller en Bootstrap.ts
```

---

## 🗄️ Base de Datos

### Schema Prisma

Ubicado en `prisma/schema.prisma`:

**Modelos principales:**
- `User` - Usuarios del sistema
- `Tenant` - Organizaciones
- `TenantMembership` - Relación usuario-tenant con rol
- `Session` - Sesiones activas
- `RefreshToken` - Tokens de refresco
- `Application` - Apps registradas
- `TenantApp` - Apps habilitadas por tenant
- `Role` - Roles predefinidos
- `EmailVerification` - Verificaciones de email pendientes
- `OtpSecret` - Secrets 2FA

### Migraciones

Usamos dos sistemas:
1. **Prisma Migrate** para cambios de schema
2. **node-pg-migrate** para data migrations y seeds

```bash
# Generar migración Prisma
npx prisma migrate dev --name nombre_cambio

# Crear migración SQL personalizada
npm run migrate:create mi_migracion
```

---

## 🔐 Seguridad

### Autenticación

- **JWT RS256:** Firma asimétrica (private key solo en IdP)
- **Cookies HttpOnly:** Inmunes a XSS
- **Refresh Token Rotation:** Tokens de refresco rotan en cada uso
- **Device Fingerprint:** Detección de dispositivos nuevos

### Autorización

- **RBAC:** Role-Based Access Control
- **RLS:** Row-Level Security en PostgreSQL para aislamiento de tenants
- **Permission Pattern:** `resource:action` (ej: `user:read`, `tenant:admin`)

### Rate Limiting

Configurado en `config.yaml`:

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `/auth/signup` | 1 hora | 5 |
| `/auth/signin` | 15 min | 4 |
| `/auth/refresh` | 1 min | 30 |

---

## 🧪 Testing

### Estructura de Tests

```
src-hex/__tests__/
├── domain/           # Tests de entidades puras
├── application/      # Tests de casos de uso (con mocks)
├── infrastructure/   # Tests de implementaciones
└── integration/      # Tests e2e con DB real
```

### Ejemplos de Test

```typescript
// Unit test de caso de uso
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase';

describe('LoginUseCase', () => {
  it('should return tokens for valid credentials', async () => {
    // Arrange
    const mockUserRepo = { findByEmail: jest.fn() };
    // ...
    
    // Act
    const result = await useCase.execute(input);
    
    // Assert
    expect(result.isSuccess).toBe(true);
  });
});
```

### Correr Tests

```bash
npm test                    # Todos los tests
npm test -- --watch       # Modo watch
npm test -- user          # Tests que contienen "user"
```

---

## 🚀 Deployment

### Docker

```bash
# Build
docker build -t idp-core:latest .

# Run
docker run -p 3567:3567 \
  -e DB_HOST=postgres \
  -e JWT_SECRET=secret \
  idp-core:latest
```

### Variables de Entorno Críticas

| Variable | Producción | Descripción |
|----------|------------|-------------|
| `NODE_ENV` | `production` | Modo ejecución |
| `JWT_SECRET` | Generar nuevo | Secret JWT |
| `DB_PASSWORD` | Fuerte | Password PostgreSQL |
| `REDIS_PASSWORD` | Fuerte | Password Redis |
| `DEFAULT_APP_ID` | Configurar | App por defecto |
| `DEFAULT_TENANT_ID` | Configurar | Tenant por defecto |

### Health Checks

- `GET /health` - Servidor funcionando
- `GET /ready` - BD y dependencias listas

---

## 📝 Patrones y Conventions

### Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Clases | PascalCase | `LoginUseCase` |
| Interfaces | I + PascalCase | `IUserRepository` |
| Variables | camelCase | `userRepository` |
| Constantes | SCREAMING_SNAKE | `MAX_RETRY` |
| Archivos | PascalCase.ts | `LoginUseCase.ts` |

### Error Handling

```typescript
// Domain errors en src-hex/domain/errors/
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

// Uso en casos de uso
if (!user) {
  return Result.fail(new UserNotFoundError(userId));
}

// Manejo en controllers
// Usar ErrorHandlerMiddleware para conversión a HTTP
```

### Result Pattern

```typescript
import { Result } from '../shared/Result';

// Éxito
return Result.ok(data);

// Error
return Result.fail(new DomainError('...'));

// Consumo
const result = await useCase.execute(input);
if (result.isFailure) {
  // manejar error
}
```

---

## 🔗 Referencias Externas

- [Prisma Docs](https://www.prisma.io/docs/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [OAuth 2.0](https://oauth.net/2/)
- [JWT.io](https://jwt.io/)

---

## 🆘 Troubleshooting Común

### "Cannot find module"

```bash
# Regenerar cliente Prisma
npm run prisma:generate

# Recompilar
npm run build
```

### "Connection refused" PostgreSQL

```bash
# Verificar PostgreSQL corriendo
pg_isready -h localhost

# Verificar variables de entorno
env | grep DB_
```

### "JWT verification failed"

```bash
# Regenerar claves
rm keys/*.pem
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

---

## 🎯 Checklist para Agentes

Antes de modificar código:

- [ ] Entender la capa: ¿es domain, application, infrastructure o interface?
- [ ] Verificar imports: ¿solo importo de capas permitidas?
- [ ] Revisar tests: ¿existe test para el comportamiento que modifico?
- [ ] Actualizar docs: ¿necesito actualizar AGENTS.md o README.md?

Después de modificar código:

- [ ] Compilar: `npm run build`
- [ ] Tests: `npm test`
- [ ] Lint: `npm run lint`
- [ ] Verificar dependencias: no imports prohibidos

---

**Última actualización:** 2025-06-07  
**Versión del documento:** 1.0.0

---

## 🗑️ Cambios Recientes: Eliminación de Soporte V2 (2025-06-07)

### Resumen
Se eliminó el soporte para tokens V2 (legacy) en `RefreshTokenUseCase`. 

### Motivación
- Auditoría confirmó 0 tokens V2 activos en producción
- El código V2 representaba deuda técnica y riesgo de seguridad
- Simplifica la lógica de refresh tokens

### Cambios Realizados

#### 1. RefreshTokenUseCase
**Antes:**
```typescript
if (!refreshToken) {
  // V2 fallback - aceptaba tokens JWT no registrados
  return this.handleV2Refresh(resolvedInput, claims);
}
```

**Después:**
```typescript
if (!refreshToken) {
  // Token not found - reject (legacy V2 tokens no longer supported)
  await this.auditService.log({
    type: 'REFRESH_FAILURE',
    metadata: { reason: 'Token not found in refresh token table' }
  });
  throw new InvalidCredentialsError('Token not recognized. Please login again.');
}
```

#### 2. Tests Actualizados
- Eliminado: Test de "V2 fallback"
- Agregado: Test de "reject token not found in refresh token table"

#### 3. AuthEventsUseCases
- Eliminado: `TOKEN_REFRESH_V2` de la lista de acciones de auditoría

#### 4. Script de Auditoría
Creado `scripts/audit-v2-tokens.js` para verificar si existen tokens V2 antes de futuros cambios.

### Impacto
- **Breaking Change:** Tokens V2 antiguos ahora devuelven error 401
- **Solución:** Usuarios deben iniciar sesión nuevamente para obtener tokens hexagonales
- **Seguridad mejorada:** No hay bypass de rotación de tokens

### Decisiones de Arquitectura

#### ¿Por qué no migración automática?
Se consideró migrar tokens V2 a la tabla hexagonal automáticamente, pero:
1. La auditoría mostró 0 tokens activos
2. La migración automática escondería tokens potencialmente comprometidos
3. Es más seguro forzar re-autenticación

#### ¿Por qué no soft deprecation?
Se optó por hard rejection porque:
1. El sistema está en fase de desarrollo activo
2. No hay usuarios en producción con tokens V2
3. Reduce la complejidad del código

### Verificación
```bash
# Ejecutar auditoría
node scripts/audit-v2-tokens.js

# Resultado esperado:
# 🚨 Activas: 0
# ✅ Seguro eliminar V2
```
