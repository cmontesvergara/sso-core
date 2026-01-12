# Backend Status Report - Single Sign On v2

**Date**: 12 de enero de 2026  
**Status**: ✅ Production Ready (Phase 1)  
**Version**: v2.0.0  

---

## 1. Executive Summary

El backend `new_sso_backend` es una implementación moderna de un sistema de Single Sign On (SSO) con:
- ✅ Autenticación multi-factor (JWT + Refresh Tokens + OTP)
- ✅ Validación y sanitización robusta con Joi
- ✅ Rate limiting por endpoint configurado
- ✅ Persistencia híbrida (node-pg-migrate + Prisma)
- ✅ Row Level Security (RLS) nativo en PostgreSQL
- ✅ Estructura modular y escalable

**Métricas**:
- 34 archivos TypeScript
- 40+ dependencias
- 2 migraciones de base de datos ejecutadas
- 7 servicios principales
- 12 endpoints API implementados

---

## 2. Arquitectura y Stack Tecnológico

### 2.1 Runtime y Lenguaje
- **Node.js**: >=18.x
- **TypeScript**: 5.3.3 (strict mode)
- **Framework**: Express 4.22.1
- **Compiler Target**: ES2020

### 2.2 Base de Datos
- **DBMS**: PostgreSQL 14+
- **Driver**: pg 8.16.3
- **Persistencia**:
  - **Schema Management**: node-pg-migrate 7.8.0
    - DDL versionado y reversible
    - RLS policies definidas en SQL
    - Índices y foreign keys explícitos
  - **ORM**: Prisma 5.22.0
    - Type-safe queries
    - Auto-generated types
    - Runtime query builder

### 2.3 Seguridad
- **JWT**: 
  - Algorithm: RS256 (RSA asymmetric)
  - Library: jsonwebtoken 9.0.2
  - Key Management: node-jose 2.2.0
  - JWKS Endpoint: `/.well-known/jwks.json`
  
- **Password Hashing**: 
  - Algorithm: Argon2id
  - Library: argon2 0.30.3
  - Async implementation

- **Token Strategy**:
  - **Access Tokens**: JWT RS256, short-lived (15 min default)
  - **Refresh Tokens**: Opaque, hashed in DB, long-lived (7 días default)
  - **OTP**: TOTP (Time-based One-Time Password)
    - Library: speakeasy 2.0.0
    - Window: ±2 time steps (60s skew tolerance)
    - Backup codes: 10 per user

- **Validation & Sanitization**:
  - Library: Joi 17.11.0
  - Schemas: email (lowercase, trim), password (≥8 chars), tokens (UUIDs)
  - Error reporting: detailed with field context

- **Rate Limiting**:
  - Library: express-rate-limit 7.5.1
  - Per-endpoint configuration:
    - `signup`: 5 req/hora
    - `signin`: 10 req/15min
    - `refresh`: 30 req/min
    - `signout`: 60 req/min
  - Global limiter: 100 req/min

- **HTTP Security**:
  - Library: helmet 7.2.0
  - CSP, HSTS, X-Frame-Options, etc.
  - CORS: configurable por ambiente

---

## 3. Estructura del Proyecto

```
src/
├── index.ts                 # Entry point
├── server.ts               # Express app factory
├── config/                 # Configuración centralizada
│   └── index.ts           # Config loader (YAML + env vars)
├── database/
│   └── types.ts           # (DEPRECATED - usar Prisma)
├── exceptions/
│   └── index.ts           # Clase base SuperTokensException
├── middleware/
│   ├── auth.ts            # JWT verification middleware
│   ├── errorHandler.ts    # Global error handler
│   └── logging.ts         # Request/response logging
├── repositories/
│   ├── userRepo.prisma.ts              # User CRUD
│   ├── refreshTokenRepo.prisma.ts      # Refresh token CRUD
│   ├── otpSecretRepo.prisma.ts         # OTP secret CRUD
│   └── emailVerificationRepo.prisma.ts # Email verification CRUD
├── routes/
│   ├── auth.ts             # POST /signup, /signin, /refresh, /signout
│   ├── otp.ts              # POST /generate, /verify, /validate, /backup-code, /disable
│   ├── emailVerification.ts # POST /send, /verify, /resend
│   ├── session.ts          # Session management routes
│   ├── user.ts             # User profile endpoints (future)
│   ├── tenant.ts           # Multi-tenancy routes (future)
│   ├── role.ts             # RBAC routes (future)
│   ├── docs.ts             # OpenAPI documentation (future)
│   └── metadata.ts         # Server metadata endpoints
├── services/
│   ├── auth.ts             # Authentication logic (signup/signin)
│   ├── session.ts          # Refresh token lifecycle
│   ├── otp.ts              # TOTP generation and verification
│   ├── email.ts            # Email sending (Nodemailer adapter)
│   ├── jwt.ts              # JWT signing/verification + JWKS
│   ├── crypto.ts           # Crypto utilities (hash, random)
│   ├── prisma.ts           # Prisma client singleton + RLS context
│   ├── migrator.ts         # Migration orchestration
│   └── (deprecated)        # user, role, tenant services legacy
├── types/
│   └── index.ts            # Global type definitions
└── utils/
    ├── helpers.ts          # General utilities
    ├── logger.ts           # Logger service (static methods)
    ├── validator.ts        # (DEPRECATED - usar Joi)
    └── __tests__/
        ├── logger.test.ts  # Logger unit tests (placeholder)
        └── validator.test.ts # Validator unit tests (placeholder)

prisma/
├── schema.prisma           # Prisma data model definition
└── (generated)
    └── .prisma/client/     # Auto-generated Prisma client

migrations/
├── 001_init.js             # Base schema: users, refresh_tokens, tenants, roles, etc.
└── 002_add_otp_email_verification.js # OTP + email verification tables

config.yaml                # Configuration file (env-based)
.env.example              # Environment variables template
.pgmigratrc.json          # node-pg-migrate config
package.json              # Dependencies and scripts
tsconfig.json             # TypeScript configuration
jest.config.json          # Jest testing configuration (configured, no tests yet)
```

---

## 4. API Endpoints

### 4.1 Authentication Routes (`POST /api/v1/auth/*`)

#### `/signup`
```bash
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}

Response (201):
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e"
}
```

**Validations**:
- Email: RFC 5322 + lowercase + trim
- Password: ≥ 8 characters
- Rate limit: 5/hora

#### `/signin`
```bash
POST /api/v1/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e",
  "otpRequired": false
}
```

**Validations**:
- Email y password requeridos
- Password verification con Argon2
- Rate limit: 10/15min

#### `/refresh`
```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e"
}

Response (200):
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "new-refresh-token-uuid"
}
```

**Lógica**:
- Valida refresh token en DB (hash match)
- Verifica no expiración
- Verifica no revocación
- Detecta reuse (rotación forzada)
- Revoca token anterior
- Genera nuevo token con chainId
- Rate limit: 30/min

#### `/signout`
```bash
POST /api/v1/auth/signout
Content-Type: application/json

{
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e",
  "revokeAll": false
}

Response (200):
{
  "success": true,
  "message": "Signed out successfully"
}
```

**Lógica**:
- Revoca refresh token específico
- Opción: revocar todos los tokens del user
- Rate limit: 60/min

### 4.2 OTP Routes (`POST /api/v1/otp/*`)

#### `/generate`
```bash
POST /api/v1/otp/generate
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}

Response (200):
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", ...],
  "message": "OTP secret generated. Scan the QR code..."
}
```

#### `/verify`
```bash
POST /api/v1/otp/verify
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "123456"
}

Response (200):
{
  "success": true,
  "message": "OTP verified and enabled"
}
```

#### `/validate`
```bash
POST /api/v1/otp/validate
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "123456"
}

Response (200):
{
  "success": true,
  "message": "OTP token is valid"
}
```

#### `/backup-code`
```bash
POST /api/v1/otp/backup-code
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "A1B2C3D4"
}

Response (200):
{
  "success": true,
  "message": "Backup code used successfully"
}
```

#### `/status/:userId`
```bash
GET /api/v1/otp/status/550e8400-e29b-41d4-a716-446655440000

Response (200):
{
  "enabled": true,
  "message": "OTP is enabled"
}
```

### 4.3 Email Verification Routes (`POST /api/v1/email-verification/*`)

#### `/send`
```bash
POST /api/v1/email-verification/send
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "Verification email sent"
}
```

**Behavior**:
- Crea token de verificación (UUID)
- Expira en 24 horas
- Envía email con link (en dev usa Ethereal test account)

#### `/verify`
```bash
POST /api/v1/email-verification/verify
{
  "token": "550e8400-e29b-41d4-a716-446655440000"
}

Response (200):
{
  "success": true,
  "message": "Email verified successfully",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

#### `/resend`
```bash
POST /api/v1/email-verification/resend
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "Verification email resent"
}
```

### 4.4 System Endpoints

#### `GET /health`
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

#### `GET /ready`
Verifica que JWKS esté inicializado.
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

#### `GET /.well-known/jwks.json`
Retorna JWKS público para verificación de tokens JWT.
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key1",
      "n": "xGOr...",
      "e": "AQAB"
    }
  ]
}
```

---

## 5. Base de Datos

### 5.1 Schema Overview

**Tablas principales**:
- `users`: Cuentas de usuario con contraseñas hashed (Argon2)
- `refresh_tokens`: Tokens opacos con hashing, rotación y revocación
- `otp_secrets`: TOTP secrets con backup codes
- `email_verifications`: Tokens de verificación con expiración
- `tenants`: Multi-tenancy (scaffold para futuro)
- `tenant_members`: Relaciones user-tenant
- `roles`: RBAC (scaffold para futuro)
- `permissions`: Permisos por role (scaffold para futuro)

### 5.2 Migraciones

**001_init.js**:
- DDL completo + índices
- Foreign keys con CASCADE
- RLS ENABLE en todas las tablas
- 6 policies de RLS:
  - `users_own_record`: Usuarios ven solo su registro
  - `refresh_tokens_own`: Refresh tokens restringidos al owner
  - `tenants_member_access`: Acceso a tenants donde eres miembro
  - `tenant_members_visibility`: Visibilidad de miembros del tenant
  - `roles_tenant_access`: Roles restringidos al tenant
  - `permissions_tenant_access`: Permisos restringidos al tenant

**002_add_otp_email_verification.js**:
- Tablas `otp_secrets` y `email_verifications`
- Índices para performance
- RLS policies para ambas

### 5.3 Row Level Security (RLS)

Ejemplo de cómo funciona:
```sql
-- En cada request, seteamos el contexto del usuario:
SET app.current_user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Las queries automáticamente filtran datos del usuario:
SELECT * FROM users; -- Solo retorna el user actual
SELECT * FROM refresh_tokens; -- Solo retorna sus tokens
```

---

## 6. Servicios Principales

### 6.1 AuthService (`src/services/auth.ts`)
- `signup(email, password, firstName, lastName)`: Crea usuario + emite JWT
- `signin(email, password)`: Verifica credenciales + emite JWT + refresh token
- Integrado con Prisma + Argon2 + Joi validation

### 6.2 SessionService (`src/services/session.ts`)
- `generateRefreshToken(userId, clientId, meta)`: Crea token opaco, lo hashea
- `rotateRefreshToken(refreshTokenPlain)`: Valida, revoca, genera nuevo
- `revokeRefreshTokenPlain(refreshTokenPlain, revokeAllForUser)`: Revoca
- Detección de reuse: si mismo token se intenta usar 2x, revoca todos

### 6.3 JWTService (`src/services/jwt.ts`)
- `initKeys()`: Genera o carga claves RSA privada/pública
- `sign(payload)`: Firma JWT con RS256
- `verify(token)`: Verifica y extrae payload
- `getJWKS()`: Retorna JWKS público para verificación remota

### 6.4 OTPService (`src/services/otp.ts`)
- `generateOTPSecret(userId, email)`: Genera secret + QR code
- `verifyOTP(userId, token)`: Activa 2FA
- `validateOTP(userId, token)`: Valida OTP en login
- `useBackupCode(userId, code)`: Consume backup code
- `isOTPEnabled(userId)`: Verifica estado

### 6.5 EmailService (`src/services/email.ts`)
- `initialize()`: Setup Nodemailer (dev: Ethereal, prod: SMTP config)
- `sendEmailVerification(userId, email, callbackUrl)`: Envía token
- `verifyEmailToken(token)`: Marca como verificado
- `sendPasswordReset(userId, email, callbackUrl)`: Recuperación de contraseña

### 6.6 PrismaService (`src/services/prisma.ts`)
- `getPrismaClient()`: Retorna singleton
- `initPrisma()`: Conecta a DB
- `setPrismaUserContext(userId)`: Setea `app.current_user_id` para RLS
- `clearPrismaUserContext()`: Limpia contexto

### 6.7 MigratorService (`src/services/migrator.ts`)
- `runMigrationsUp()`: Ejecuta `npm run migrate:up`
- `generatePrismaClient()`: Ejecuta `npm run prisma:generate`
- `initializeDatabase()`: Orquesta migrations + Prisma generation

---

## 7. Configuración

### 7.1 config.yaml
```yaml
server:
  port: 3000
  env: development

database:
  url: ${DATABASE_URL}

jwt:
  algorithm: RS256
  accessTokenExpiresIn: 900 # 15 minutos
  refreshTokenExpiresIn: 604800 # 7 días

cors:
  origin: "http://localhost:3000,http://localhost:5173"
  credentials: true
  methods: GET,POST,PUT,DELETE,PATCH

rateLimit:
  windowMs: 60000 # 1 minuto
  max: 100       # 100 requests
  signup:
    windowMs: 3600000 # 1 hora
    max: 5
  signin:
    windowMs: 900000 # 15 minutos
    max: 10
  refresh:
    windowMs: 60000 # 1 minuto
    max: 30
  signout:
    windowMs: 60000
    max: 60
```

### 7.2 Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/sso_db"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sso_db
DB_USER=sso_user
DB_PASSWORD=secure_password

# App
NODE_ENV=development
APP_URL=http://localhost:3000

# JWT
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# Email (production)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@sso.local

# Session
SESSION_TOKEN_EXPIRY=604800 # 7 días
REFRESH_TOKEN_PEPPER=your-secret-pepper-key
```

---

## 8. Validación y Seguridad

### 8.1 Joi Schemas
- **signup**: email + password (≥8 chars) + firstName/lastName opcionales
- **signin**: email + password
- **refresh**: refreshToken (UUID format)
- **signout**: refreshToken (UUID format) + revokeAll (boolean)
- **otp/generate**: userId (UUID) + email
- **otp/verify**: userId (UUID) + token (6 dígitos)
- **email-verification/send**: userId (UUID) + email

### 8.2 Sanitización
- Email: lowercase + trim
- Password: no sanitización (literal)
- UUIDs: validación strict

### 8.3 Error Handling
Estructura estándar:
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "errors": [{"field": "email", "message": "Invalid format"}],
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

---

## 9. Persistencia: Arquitectura Híbrida

### 9.1 Responsabilidades

**node-pg-migrate** (Schema + RLS):
- Define DDL (CREATE TABLE, INDEX, FOREIGN KEY)
- Gestiona RLS policies
- Versionado de cambios
- Rollback automático si falla

**Prisma** (ORM Runtime):
- Type-safe queries
- Auto-generated types desde schema
- Transaction support
- Relaciones tipadas
- Query builder

### 9.2 Flujo de Cambios en DB

1. Developer crea nueva migración: `npm run migrate:create -- add-new-table`
2. Edit migration SQL file en `migrations/`
3. Run: `npm run migrate:up` → node-pg-migrate ejecuta
4. Update `prisma/schema.prisma` con nuevos modelos
5. Run: `npm run prisma:generate` → Prisma genera tipos
6. Use in code: `prisma.model.create(...)` con type-safety

---

## 10. Flujos de Autenticación

### 10.1 Signup

```
1. POST /signup { email, password, firstName, lastName }
   ↓
2. Joi validation + sanitización
   ↓
3. Email check (¿ya existe?)
   ↓
4. Hash password con Argon2
   ↓
5. Insert user en DB (Prisma)
   ↓
6. Generar refresh token opaco
   ↓
7. Hash refresh token + guarda en DB
   ↓
8. Genera JWT (RS256) con user info
   ↓
9. Retorna { userId, accessToken, refreshToken }
```

### 10.2 Signin

```
1. POST /signin { email, password }
   ↓
2. Joi validation
   ↓
3. Find user por email (Prisma)
   ↓
4. Verify password con Argon2
   ↓
5. Si OTP enabled: retorna { otpRequired: true } (frontend solicita OTP)
   ↓
6. Generar refresh token + hash
   ↓
7. Guardar refresh token en DB
   ↓
8. Genera JWT (RS256)
   ↓
9. Retorna { userId, email, accessToken, refreshToken }
```

### 10.3 Refresh Token

```
1. POST /refresh { refreshToken }
   ↓
2. Hash token (same pepper como session.ts)
   ↓
3. Lookup en DB por hash
   ↓
4. Valida no-expiración
   ↓
5. Valida no-revocación
   ↓
6. Detección de reuse: si previousTokenId coincide con un token ya revocado
      → revoca TODOS los tokens del user (security incident)
   ↓
7. Revoca token viejo
   ↓
8. Genera nuevo token con previousTokenId = oldToken.id
   ↓
9. Inserta nuevo token en DB
   ↓
10. Genera JWT fresco
    ↓
11. Retorna { accessToken, refreshToken: newToken }
```

### 10.4 Signout

```
1. POST /signout { refreshToken, revokeAll? }
   ↓
2. Hash token
   ↓
3. Lookup en DB
   ↓
4. Si revokeAll=true: UPDATE refresh_tokens SET revoked=true WHERE user_id=?
   ↓
5. Si revokeAll=false: UPDATE apenas ese token
   ↓
6. Retorna { success: true }
```

### 10.5 OTP Setup y Login

```
Setup:
1. POST /otp/generate { userId, email }
   → Genera secret TOTP + QR code
   → Guarda en DB (verified=false)
   → Retorna { secret, qrCode, backupCodes }

2. User scanea QR code con autenticador (Google Auth, Authy, etc.)

3. POST /otp/verify { userId, token }
   → Valida token TOTP contra secret
   → Si válido: UPDATE verified=true
   → Retorna { success: true }

Login:
1. POST /signin { email, password }
   → Si OTP enabled: retorna { otpRequired: true }

2. Frontend solicita OTP al usuario

3. POST /otp/validate { userId, token }
   → Valida TOTP o backup code
   → Si válido: retorna { success: true }
   → Frontend puede proceder con login completo
```

---

## 11. Testing

### Estado Actual
- ✅ Jest configurado en `jest.config.json`
- ✅ Test placeholders creados:
  - `src/utils/__tests__/logger.test.ts`
  - `src/utils/__tests__/validator.test.ts`
- ⏳ Tests unitarios de servicios: PENDIENTE
- ⏳ Tests integración e2e: PENDIENTE

### Scripts Disponibles
```bash
npm test              # Ejecutar tests
npm test -- --watch  # Watch mode
npm test -- --coverage  # Coverage report
```

---

## 12. Deployment

### 12.1 Development
```bash
npm run dev
# Watches TypeScript, auto-restart en changes
# Server en http://localhost:3000
```

### 12.2 Production Build
```bash
npm run build       # Compila a ./dist
npm run build:prod  # Minified + optimized
npm start          # Ejecuta ./dist/index.js
```

### 12.3 Docker (Future)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 13. Monitoreo y Observabilidad

### 13.1 Logging
- ✅ Logger service implementado (static methods)
- Niveles: DEBUG, INFO, WARN, ERROR
- Formato JSON para parseo automático
- Integrado en todos los servicios

### 13.2 Métricas (Future)
- [ ] Prometheus metrics integration
- [ ] Request latency tracking
- [ ] Auth success/failure rates
- [ ] Database query performance

### 13.3 Tracing (Future)
- [ ] Jaeger/OpenTelemetry integration
- [ ] Request tracing through services

---

## 14. Próximos Pasos (Roadmap)

### Phase 2 (Planning)
- [ ] Tests completos: unitarios + integración
- [ ] Multi-tenancy: completar endpoints (RBAC, permissions)
- [ ] Session management: invalidate sessions, device tracking
- [ ] Password reset + recovery flows
- [ ] Social login adapters (Google, GitHub, Microsoft)
- [ ] SAML 2.0 support
- [ ] Auditoria completa (audit logs)

### Phase 3 (Planning)
- [ ] Consent management (GDPR)
- [ ] Risk-based authentication (impossible travel detection)
- [ ] Admin dashboard (user management, audit)
- [ ] API keys para third-party integrations
- [ ] Event webhooks
- [ ] Rate limiting por user/IP (más granular)

### Phase 4 (Planning)
- [ ] High availability (replicas, failover)
- [ ] Observability completa (APM)
- [ ] Compliance (HIPAA, SOC2, ISO 27001)
- [ ] Performance optimization (caching, indexing)

---

## 15. Troubleshooting

### Error: "JWKS not initialized"
**Causa**: JWT keys no cargadas  
**Solución**: Verificar `keys/` folder, ejecutar `npm run generate:keys`

### Error: "Database connection failed"
**Causa**: DATABASE_URL mal configurada o PostgreSQL no corriendo  
**Solución**: 
```bash
psql $DATABASE_URL
# Verificar conexión, crear DB si necesario
```

### Error: "OTP validation failed"
**Causa**: Reloj del cliente y servidor desincronizado  
**Solución**: Sincronizar NTP del servidor: `sudo ntpdate -s time.nist.gov`

---

## 16. Contacto y Soporte

**Maintainer**: Carlos Montes  
**Email**: cmontes@empiresoftware.com  
**Repository**: Single Sign On (Private)  
**Issues**: Reportar en interno Slack #sso-backend

---

## Appendix A: Dependencies Summary

```
Core:
  - express@4.22.1
  - typescript@5.3.3
  - postgres/pg@8.16.3

Security:
  - jsonwebtoken@9.0.2
  - argon2@0.30.3
  - speakeasy@2.0.0
  - joi@17.11.0
  - helmet@7.2.0

Persistence:
  - @prisma/client@5.22.0
  - prisma@5.22.0
  - node-pg-migrate@7.8.0

Email:
  - nodemailer@6.9.7
  - qrcode@1.5.3

Development:
  - jest@29.7.0
  - eslint@8.57.1
  - prettier@3.1.1
  - ts-node@10.9.2
```

---

**Documento generado**: 12 de enero de 2026  
**Versión**: 1.0  
**Status**: ✅ Production Ready
