# 📘 DEVELOPER GUIDE - SSO Backend

**Versión:** 2.3.0  
**Última actualización:** Enero 2026

---

## 📋 Índice

1. [Arquitectura Técnica](#arquitectura-técnica)
2. [Base de Datos](#base-de-datos)
3. [API Reference](#api-reference)
4. [Autenticación & Seguridad](#autenticación--seguridad)
5. [Multi-Tenancy](#multi-tenancy)
6. [Email System](#email-system)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura Técnica

### Stack Completo
| Componente | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| **Runtime** | Node.js | ≥18.0.0 | JavaScript runtime |
| **Language** | TypeScript | 5.3.3 | Type safety |
| **Framework** | Express | 4.22.1 | HTTP server |
| **ORM** | Prisma | 5.22.0 | Database access |
| **Database** | PostgreSQL | ≥14 | Persistence |
| **Migrations** | node-pg-migrate | 7.8.0 | Schema versioning |
| **Auth** | JWT (jsonwebtoken) | 9.0.2 | Stateless auth |
| **Password** | Argon2 | 0.30.0 | Password hashing |
| **2FA** | Speakeasy | 2.0.0 | TOTP generation |
| **Email** | Resend + Nodemailer | 6.7.0 + 6.9.7 | Transactional emails |
| **Validation** | Joi | 17.11.0 | Input validation |
| **Testing** | Jest | 29.7.0 | Unit + Integration |

### Estructura de Carpetas (Detallada)
```
new_sso_backend/
├── src/
│   ├── index.ts                      # App entry point
│   ├── server.ts                     # Express app configuration
│   │
│   ├── config/
│   │   └── index.ts                  # ENV loading, DB connection, JWT keys
│   │
│   ├── database/
│   │   └── prisma.ts                 # Prisma client singleton
│   │
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification middleware
│   │   ├── errorHandler.ts           # Global error handler
│   │   └── logging.ts                # Request logging
│   │
│   ├── routes/
│   │   ├── auth.ts                   # /api/v1/auth/* (signup, signin, refresh, signout)
│   │   ├── otp.ts                    # /api/v1/otp/* (2FA/TOTP endpoints)
│   │   ├── emailVerification.ts      # /api/v1/email-verification/*
│   │   ├── tenant.ts                 # /api/v1/tenants/* (CRUD + members)
│   │   ├── user.ts                   # /api/v1/users/* (profile management)
│   │   ├── session.ts                # /api/v1/sessions/* (session management)
│   │   ├── role.ts                   # /api/v1/roles/* (RBAC)
│   │   ├── metadata.ts               # /health, /ready
│   │   └── docs.ts                   # /.well-known/jwks.json
│   │
│   ├── services/
│   │   ├── auth.ts                   # Signup, signin, token generation
│   │   ├── email.ts                  # Email adapter (Resend, SMTP, Ethereal)
│   │   ├── tenant.ts                 # Tenant CRUD, member management
│   │   ├── jwt.ts                    # JWT signing/verification
│   │   ├── otp.ts                    # TOTP generation/validation
│   │   ├── session.ts                # Session lifecycle
│   │   ├── crypto.ts                 # Key generation, encryption
│   │   ├── migrator.ts               # Database migrations
│   │   └── prisma.ts                 # Prisma client wrapper
│   │
│   ├── repositories/
│   │   ├── userRepo.prisma.ts        # User CRUD operations
│   │   ├── refreshTokenRepo.prisma.ts # Token storage
│   │   ├── otpSecretRepo.prisma.ts   # 2FA secrets
│   │   └── emailVerificationRepo.prisma.ts # Email tokens
│   │
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   │
│   ├── utils/
│   │   └── helpers.ts                # Utility functions
│   │
│   └── exceptions/
│       └── index.ts                  # Custom error classes
│
├── prisma/
│   └── schema.prisma                 # Database schema definition
│
├── migrations/
│   ├── 001_init.js                   # Initial tables (users, tenants, roles, etc.)
│   ├── 002_add_otp_email_verification.js # OTP + email verification
│   └── 003_add_extended_user_fields.js   # Extended user model + addresses
│
├── keys/                             # JWT keys (gitignored)
│   ├── private.pem                   # RS256 private key
│   └── public.pem                    # RS256 public key
│
├── dist/                             # Compiled TypeScript (gitignored)
├── node_modules/                     # Dependencies (gitignored)
│
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Template for .env
├── package.json                      # Dependencies + scripts
├── tsconfig.json                     # TypeScript config
├── jest.config.json                  # Jest testing config
├── docker-compose.yml                # Local PostgreSQL
├── Dockerfile                        # Production image
└── README.md                         # Main documentation
```

### Flujo de Request Completo
```typescript
// 1. Request entrante
POST /api/v1/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
X-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
{ "firstName": "Alice" }

// 2. Middleware Stack (Express)
app.use(cors())                // CORS headers
app.use(rateLimit())           // Rate limiting
app.use(authMiddleware)        // JWT verification
app.use(tenantMiddleware)      // Tenant context

// 3. Route Handler
router.patch('/users/me', async (req, res) => {
  const userId = req.userId;        // Extraído de JWT
  const tenantId = req.tenantId;    // Extraído de header
  
  // 4. Service Layer
  const updated = await userService.updateProfile(userId, req.body, tenantId);
  
  // 5. Repository Layer
  // userRepo.update() llamado internamente
  
  // 6. Prisma ORM
  // Prisma genera SQL con tenant_id filter
  
  // 7. PostgreSQL RLS
  // RLS policy verifica tenant_id automáticamente
  
  // 8. Response
  res.json(updated);
});

// 9. Error Handling (si algo falla)
app.use((error, req, res, next) => {
  logger.error(error);
  res.status(error.statusCode || 500).json({ error: error.message });
});
```

---

## 🗄️ Base de Datos

### Esquema Completo (10 Tablas)

#### 1. **users** (Usuarios)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Información Básica
  first_name VARCHAR(255) NOT NULL,
  second_name VARCHAR(255),
  last_name VARCHAR(255) NOT NULL,
  second_last_name VARCHAR(255),
  phone VARCHAR(20),
  nuid VARCHAR(255) UNIQUE,  -- National ID
  
  -- Información Adicional
  birth_date DATE,
  gender VARCHAR(50),
  nationality VARCHAR(100),
  place_of_birth VARCHAR(255),
  place_of_residence VARCHAR(255),
  occupation VARCHAR(255),
  marital_status VARCHAR(50),
  user_status VARCHAR(50) DEFAULT 'active',
  
  -- Seguridad
  password_hash VARCHAR(255) NOT NULL,
  recovery_phone VARCHAR(20),
  recovery_email VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_users_email (email),
  INDEX idx_users_nuid (nuid)
);
```

#### 2. **addresses** (Direcciones - 1-to-Many con users)
```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  street VARCHAR(255),
  postal_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_addresses_user_id (user_id)
);
```

#### 3. **other_information** (Información flexible - 1-to-1 con users)
```sql
CREATE TABLE other_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  scope TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. **tenants** (Organizaciones)
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_tenants_slug (slug)
);
```

#### 5. **tenant_members** (Relación User-Tenant-Role)
```sql
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tenant_id),
  INDEX idx_tenant_members_user (user_id),
  INDEX idx_tenant_members_tenant (tenant_id)
);
```

#### 6. **roles** (Roles RBAC)
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Roles predefinidos: admin, member, viewer
  INDEX idx_roles_tenant (tenant_id)
);
```

#### 7. **permissions** (Permisos granulares)
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource VARCHAR(100) NOT NULL,  -- users, tenants, roles, etc.
  action VARCHAR(50) NOT NULL,     -- create, read, update, delete
  
  UNIQUE(role_id, resource, action),
  INDEX idx_permissions_role (role_id)
);
```

#### 8. **refresh_tokens** (Tokens de refresco)
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_token (token)
);
```

#### 9. **otp_secrets** (Secretos 2FA/TOTP)
```sql
CREATE TABLE otp_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 10. **email_verifications** (Tokens verificación email)
```sql
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(10) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_email_verifications_user (user_id),
  INDEX idx_email_verifications_email (email)
);
```

### Row-Level Security (RLS)

**8 políticas activas** para aislamiento multi-tenant:

```sql
-- 1. users: Solo ver usuarios de mi tenant
CREATE POLICY tenant_isolation_users ON users
  USING (
    id IN (
      SELECT user_id FROM tenant_members 
      WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

-- 2. refresh_tokens: Solo mis tokens
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (user_id IN (
    SELECT user_id FROM tenant_members 
    WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

-- 3. tenant_members: Solo miembros de mi tenant
CREATE POLICY tenant_isolation_members ON tenant_members
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4. roles: Solo roles de mi tenant
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 5. permissions: Solo permisos de mis roles
CREATE POLICY tenant_isolation_permissions ON permissions
  USING (role_id IN (
    SELECT id FROM roles 
    WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

-- 6. otp_secrets: Solo mis secretos
CREATE POLICY tenant_isolation_otp ON otp_secrets
  USING (user_id IN (
    SELECT user_id FROM tenant_members 
    WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

-- 7. email_verifications: Solo mis verificaciones
CREATE POLICY tenant_isolation_email_verif ON email_verifications
  USING (user_id IN (
    SELECT user_id FROM tenant_members 
    WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ));

-- 8. addresses: Solo direcciones de usuarios de mi tenant
CREATE POLICY tenant_isolation_addresses ON addresses
  USING (user_id IN (
    SELECT user_id FROM tenant_members 
    WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ));
```

**Activar RLS:**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
```

**Uso en middleware:**
```typescript
// src/middleware/auth.ts
async function setTenantContext(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) return next(new Error('X-Tenant-ID header requerido'));
  
  // Establece variable de sesión PostgreSQL
  await prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;
  
  next();
}
```

### Migraciones

**Crear nueva migración:**
```bash
npm run migrate:create nombre_descriptivo
```

**Estructura de archivo migración:**
```javascript
// migrations/004_add_audit_log.js
exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'CASCADE',
    },
    action: { type: 'varchar(100)', notNull: true },
    resource: { type: 'varchar(100)', notNull: true },
    timestamp: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  
  pgm.createIndex('audit_logs', 'user_id');
  pgm.createIndex('audit_logs', 'timestamp');
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
};
```

**Aplicar migración:**
```bash
npm run migrate:up
```

**Rollback:**
```bash
npm run migrate:down
```

---

## 📡 API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Headers Comunes
```http
Authorization: Bearer <access_token>
X-Tenant-ID: <tenant_uuid>
Content-Type: application/json
```

### Endpoints Detallados

#### **POST /auth/signup** (Registro)
**Request:**
```json
{
  "email": "alice@ejemplo.com",
  "password": "SecurePass123!",
  "firstName": "Alice",
  "lastName": "Johnson"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@ejemplo.com",
    "firstName": "Alice",
    "lastName": "Johnson",
    "createdAt": "2026-01-18T10:30:00Z"
  },
  "message": "Email de verificación enviado"
}
```

**Errores:**
- `400`: Email ya registrado
- `400`: Password débil
- `500`: Error enviando email

---

#### **POST /auth/signin** (Login)
**Request:**
```json
{
  "email": "alice@ejemplo.com",
  "password": "SecurePass123!"
}
```

**Response (200) - Sin 2FA:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_abc123...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@ejemplo.com"
  }
}
```

**Response (200) - Con 2FA habilitado:**
```json
{
  "requiresOtp": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errores:**
- `401`: Credenciales incorrectas
- `403`: Email no verificado

---

#### **POST /otp/validate** (Validar código 2FA)
**Headers:**
```http
Authorization: Bearer <temp_token>
```

**Request:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_abc123...",
  "expiresIn": 900
}
```

**Errores:**
- `401`: Código inválido
- `401`: Código expirado

---

#### **POST /tenants** (Crear tenant)
**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp"
}
```

**Response (201):**
```json
{
  "id": "tenant-uuid",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "members": [
    {
      "userId": "creator-uuid",
      "role": "admin",
      "permissions": ["*:*"]
    }
  ],
  "createdAt": "2026-01-18T10:30:00Z"
}
```

---

#### **POST /tenants/:tenantId/members** (Invitar miembro)
**Headers:**
```http
Authorization: Bearer <access_token>
X-Tenant-ID: <tenant_uuid>
```

**Request:**
```json
{
  "userId": "user-uuid",
  "role": "member"
}
```

**Response (200):**
```json
{
  "message": "Miembro agregado exitosamente",
  "member": {
    "userId": "user-uuid",
    "tenantId": "tenant-uuid",
    "role": "member",
    "permissions": ["users:read", "users:write"]
  }
}
```

**Errores:**
- `403`: No tienes permiso (necesitas ser admin)
- `404`: Usuario no encontrado
- `409`: Usuario ya es miembro

---

### Códigos de Error Estándar
| Código | Descripción | Ejemplo |
|--------|-------------|---------|
| `400` | Bad Request | Datos inválidos |
| `401` | Unauthorized | Token expirado |
| `403` | Forbidden | Sin permisos |
| `404` | Not Found | Recurso no existe |
| `409` | Conflict | Email ya registrado |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Error inesperado |

### Rate Limiting
```
Auth endpoints: 10 requests/min por IP
OTP endpoints: 5 requests/min por usuario
General: 100 requests/min por usuario
```

---

## 🔐 Autenticación & Seguridad

### JWT (JSON Web Tokens)

**Generación de claves RS256:**
```bash
# Clave privada (2048 bits)
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048

# Clave pública
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

**Payload de Access Token:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@ejemplo.com",
  "tenantId": "tenant-uuid",
  "role": "member",
  "iat": 1705575600,
  "exp": 1705576500
}
```

**Implementación (src/services/jwt.ts):**
```typescript
import jwt from 'jsonwebtoken';
import fs from 'fs';

const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH, 'utf8');
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH, 'utf8');

export function signToken(payload: object): string {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  });
}

export function verifyToken(token: string): object {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
  });
}
```

**JWKS Endpoint (para apps externas):**
```typescript
// GET /.well-known/jwks.json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "sso-backend-2024",
      "n": "xGOr1X...",  // modulus
      "e": "AQAB"       // exponent
    }
  ]
}
```

### Password Hashing con Argon2

```typescript
import argon2 from 'argon2';

// Configuración recomendada
const argon2Options = {
  type: argon2.argon2id,  // Híbrido (resistente a GPU + side-channel)
  memoryCost: 65536,      // 64 MB
  timeCost: 3,            // 3 iteraciones
  parallelism: 4,         // 4 threads
};

// Hash al registrar
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Options);
}

// Verificar al login
async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

**¿Por qué Argon2 y no bcrypt?**
- Ganador Password Hashing Competition 2015
- Resistente a ataques GPU/ASIC
- Requiere memoria (costoso para atacantes)
- Adoptado por OWASP

### 2FA/TOTP Implementation

**Flujo completo:**
```typescript
// 1. Usuario solicita habilitar 2FA
POST /api/v1/otp/generate

// Backend genera secret
const secret = speakeasy.generateSecret({
  name: 'SSO App (alice@ejemplo.com)',
  issuer: 'SSO Backend',
});

// Response incluye:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "backupCodes": ["abc123", "def456", ...]
}

// 2. Usuario escanea QR con Google Authenticator

// 3. Usuario verifica código inicial
POST /api/v1/otp/verify
{ "token": "123456" }

// Backend verifica con speakeasy
const valid = speakeasy.totp.verify({
  secret: storedSecret,
  encoding: 'base32',
  token: userToken,
  window: 1,  // ±30 segundos tolerancia
});

// Si válido: OTPSecret.verified = true

// 4. En futuros logins, require código
POST /api/v1/auth/signin  → { requiresOtp: true }
POST /api/v1/otp/validate → tokens JWT
```

### Backup Codes

```typescript
// Generación (src/services/otp.ts)
import crypto from 'crypto';

function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

// Uso
// Usuario puede usar backup code en lugar de TOTP
// Cada código es de un solo uso
```

---

## 🏢 Multi-Tenancy

### Conceptos Clave

**Tenant:** Organización/equipo aislado con:
- Usuarios propios
- Roles personalizados (admin, member, viewer)
- Permisos granulares (users:read, users:write, etc.)
- Datos separados (RLS en PostgreSQL)

**Usuario multi-tenant:** Un usuario puede:
- Pertenecer a múltiples tenants
- Tener roles diferentes en cada tenant
- Ver solo datos del tenant activo (via header `X-Tenant-ID`)

### Flujo de Trabajo Típico

**Caso: Startup con 3 equipos**

```typescript
// 1. Carlos crea tenant "Engineering"
POST /api/v1/tenants
{
  "name": "Engineering Team",
  "slug": "engineering"
}
// Carlos es admin automáticamente

// 2. Carlos invita a Alice como member
POST /api/v1/tenants/{engineeringId}/members
{
  "userId": "{aliceId}",
  "role": "member"
}

// 3. Alice crea tenant "Marketing"
POST /api/v1/tenants
{
  "name": "Marketing Team",
  "slug": "marketing"
}
// Alice es admin de Marketing

// 4. Alice hace request a Engineering
GET /api/v1/users
Headers:
  X-Tenant-ID: {engineeringId}
// Ve usuarios de Engineering (role: member)

// 5. Alice hace request a Marketing
GET /api/v1/users
Headers:
  X-Tenant-ID: {marketingId}
// Ve usuarios de Marketing (role: admin)
```

### Implementación de Middleware

```typescript
// src/middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantId = req.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header requerido' });
  }
  
  // Verificar que usuario pertenece a este tenant
  const membership = await prisma.tenantMember.findFirst({
    where: {
      userId: req.userId,  // Del JWT
      tenantId: tenantId,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });
  
  if (!membership) {
    return res.status(403).json({ error: 'No perteneces a este tenant' });
  }
  
  // Establecer contexto PostgreSQL (para RLS)
  await prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;
  
  // Agregar a request
  req.tenantId = tenantId;
  req.role = membership.role.name;
  req.permissions = membership.role.permissions;
  
  next();
}
```

### Permission Checking

```typescript
// src/middleware/permission.ts
export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasPermission = req.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        error: `Requiere permiso: ${resource}:${action}`,
      });
    }
    
    next();
  };
}

// Uso en rutas
router.delete('/users/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission('users', 'delete'),
  async (req, res) => {
    // Solo ejecuta si tiene permiso users:delete
    await userService.delete(req.params.id);
    res.status(204).send();
  }
);
```

---

## 📧 Email System

### Proveedores Soportados

| Proveedor | Uso | Configuración |
|-----------|-----|---------------|
| **Resend** | Producción | `RESEND_API_KEY` |
| **Nodemailer SMTP** | Self-hosted | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| **Ethereal** | Desarrollo | Auto-config (no API key) |

### Implementación (src/services/email.ts)

```typescript
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

class EmailService {
  private provider: 'resend' | 'smtp' | 'ethereal';
  private resend?: Resend;
  private transporter?: nodemailer.Transporter;
  
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER as any || 'ethereal';
    this.initialize();
  }
  
  private async initialize() {
    switch (this.provider) {
      case 'resend':
        this.resend = new Resend(process.env.RESEND_API_KEY);
        break;
      
      case 'smtp':
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        break;
      
      case 'ethereal':
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        break;
    }
  }
  
  async sendVerificationCode(email: string, code: string) {
    const subject = 'Verifica tu email';
    const html = `
      <h1>Código de verificación</h1>
      <p>Tu código es: <strong>${code}</strong></p>
      <p>Expira en 15 minutos.</p>
    `;
    
    return this.send(email, subject, html);
  }
  
  private async send(to: string, subject: string, html: string) {
    if (this.provider === 'resend') {
      return this.resend!.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to,
        subject,
        html,
      });
    } else {
      const info = await this.transporter!.sendMail({
        from: process.env.SMTP_FROM || 'noreply@sso.local',
        to,
        subject,
        html,
      });
      
      if (this.provider === 'ethereal') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }
      
      return info;
    }
  }
}

export const emailService = new EmailService();
```

### Templates

**Email de verificación:**
```typescript
// src/services/email.ts
async sendVerificationCode(email: string, code: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .code { font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Verifica tu email</h1>
        <p>Gracias por registrarte. Tu código de verificación es:</p>
        <div class="code">${code}</div>
        <p>Este código expira en 15 minutos.</p>
        <p>Si no solicitaste esto, ignora este email.</p>
      </div>
    </body>
    </html>
  `;
  
  return this.send(email, 'Verifica tu email', html);
}
```

**Invitación a tenant:**
```typescript
async sendTenantInvitation(email: string, tenantName: string, inviterName: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <div class="container">
        <h1>Has sido invitado a ${tenantName}</h1>
        <p>${inviterName} te ha invitado a unirte a su equipo.</p>
        <a href="${process.env.FRONTEND_URL}/accept-invite?token=..." 
           style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none;">
          Aceptar Invitación
        </a>
      </div>
    </body>
    </html>
  `;
  
  return this.send(email, `Invitación a ${tenantName}`, html);
}
```

---

## 🧪 Testing

### Configuración Jest

```javascript
// jest.config.json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### Tests Ejemplo

**Unit Test (Auth Service):**
```typescript
// src/services/__tests__/auth.test.ts
import { authService } from '../auth';
import { userRepo } from '../../repositories/userRepo.prisma';

jest.mock('../../repositories/userRepo.prisma');

describe('AuthService', () => {
  describe('signup', () => {
    it('debe hashear el password con Argon2', async () => {
      const mockUser = { id: '123', email: 'test@test.com' };
      (userRepo.create as jest.Mock).mockResolvedValue(mockUser);
      
      await authService.signup({
        email: 'test@test.com',
        password: 'Test1234!',
        firstName: 'Test',
        lastName: 'User',
      });
      
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.any(String),  // Hash Argon2
        })
      );
    });
    
    it('debe lanzar error si email ya existe', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ id: '123' });
      
      await expect(
        authService.signup({
          email: 'existing@test.com',
          password: 'Test1234!',
          firstName: 'Test',
          lastName: 'User',
        })
      ).rejects.toThrow('Email ya registrado');
    });
  });
});
```

**Integration Test (Full Auth Flow):**
```typescript
// src/__tests__/integration/auth.test.ts
import request from 'supertest';
import { app } from '../../server';
import { prisma } from '../../database/prisma';

describe('Auth Flow Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  
  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });
  
  it('debe completar signup → verify → signin', async () => {
    // 1. Signup
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'integration@test.com',
        password: 'Test1234!',
        firstName: 'Integration',
        lastName: 'Test',
      })
      .expect(201);
    
    expect(signupRes.body).toHaveProperty('user.id');
    
    // 2. Obtener código de verificación (desde BD)
    const verification = await prisma.emailVerification.findFirst({
      where: { email: 'integration@test.com' },
    });
    
    // 3. Verificar email
    await request(app)
      .post('/api/v1/email-verification/verify')
      .send({
        email: 'integration@test.com',
        token: verification!.token,
      })
      .expect(200);
    
    // 4. Signin
    const signinRes = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: 'integration@test.com',
        password: 'Test1234!',
      })
      .expect(200);
    
    expect(signinRes.body).toHaveProperty('accessToken');
    expect(signinRes.body).toHaveProperty('refreshToken');
  });
});
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Watch mode
npm run test:watch

# Con coverage
npm test -- --coverage

# Test específico
npm test -- auth.test.ts
```

---

## 🚀 Deployment

### Docker Production

**Dockerfile optimizado:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copiar solo lo necesario
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/migrations ./migrations

# Usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
```

**docker-compose.yml producción:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: sso_prod
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: sso_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sso_prod"]
      interval: 10s
      timeout: 5s
      retries: 5
  
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://sso_prod:${DB_PASSWORD}@postgres:5432/sso_prod
      JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private
      JWT_PUBLIC_KEY_PATH: /run/secrets/jwt_public
      EMAIL_PROVIDER: resend
      RESEND_API_KEY: ${RESEND_API_KEY}
      NODE_ENV: production
    secrets:
      - jwt_private
      - jwt_public
    depends_on:
      postgres:
        condition: service_healthy

secrets:
  jwt_private:
    file: ./keys/private.pem
  jwt_public:
    file: ./keys/public.pem

volumes:
  postgres_data:
```

### CI/CD (GitHub Actions)

```.yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: registry.ejemplo.com/sso-backend:latest
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        run: |
          ssh user@prod-server << 'EOF'
            cd /opt/sso-backend
            docker-compose pull
            docker-compose up -d
          EOF
```

---

## 🐛 Troubleshooting

### Errores Comunes

**1. "JWT verification failed"**
```
Causa: Clave pública incorrecta o token firmado con otra clave
Solución:
- Verificar JWT_PUBLIC_KEY_PATH apunta al archivo correcto
- Regenerar tokens si cambiaste las claves
```

**2. "Database connection refused"**
```
Causa: PostgreSQL no está corriendo o DATABASE_URL incorrecta
Solución:
- brew services start postgresql
- Verificar DATABASE_URL en .env
```

**3. "X-Tenant-ID header required"**
```
Causa: Endpoint protegido requiere header de tenant
Solución:
- Agregar header: X-Tenant-ID: <tenant-uuid>
- Obtener tenant-uuid de GET /api/v1/tenants
```

**4. "Email sending failed"**
```
Causa: Configuración de email incorrecta
Solución:
- EMAIL_PROVIDER=ethereal (para desarrollo)
- Verificar API key de Resend
- Verificar credenciales SMTP
```

**5. "RLS policy violation"**
```
Causa: Intentando acceder a datos de otro tenant
Solución:
- Verificar X-Tenant-ID corresponde a tu membresía
- Revisar TenantMember en BD
```

### Logs & Debugging

**Habilitar logs detallados:**
```bash
# .env
LOG_LEVEL=debug
```

**Ver logs en producción:**
```bash
docker logs -f sso-backend --tail 100
```

**Debugging con VS Code:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

---

## 📞 Soporte

- **Issues:** [GitHub Issues](https://github.com/...)
- **Email:** cmontes@empiresoft.com
- **Docs:** Ver README.md

---

**Última actualización:** 18 de enero de 2026  
**Versión:** 2.3.0
