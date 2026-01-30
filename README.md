# 🔐 SSO Backend - Sistema de Autenticación Multi-Tenant

**Versión:** 2.5.0  
**Estado:** ✅ Producción-Ready (Core + App Management + System Roles)  
**Stack:** TypeScript + Express + Prisma + PostgreSQL

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Inicio Rápido](#-inicio-rápido)
- [Arquitectura](#-arquitectura)
- [API Endpoints](#-api-endpoints)
- [Multi-Tenancy](#-multi-tenancy)
- [Seguridad](#-seguridad)
- [Desarrollo](#-desarrollo)
- [Producción](#-producción)
- [Roadmap](#-roadmap)

---

## 🎯 Descripción

Sistema de **Single Sign-On (SSO)** empresarial con soporte multi-tenant completo. Diseñado para permitir que múltiples aplicaciones compartan autenticación centralizada con aislamiento total entre tenants.

**Casos de Uso:**

- SaaS con múltiples organizaciones
- Plataformas empresariales con equipos
- Microservicios que necesitan autenticación centralizada
- Sistemas con RBAC (Role-Based Access Control)

---

## ✨ Características

### ✅ Autenticación Core

- **JWT con RS256** (firma asimétrica con claves públicas/privadas)
- **Passwords seguros** con Argon2
- **Refresh tokens** con rotación automática
- **Email verification** (3 proveedores: Resend, SMTP, Ethereal)
- **2FA/TOTP** con QR codes (Google Authenticator, Authy)
- **Session management** con invalidación automática

### ✅ Multi-Tenancy

- **Tenant CRUD** completo
- **RBAC** con 3 roles predefinidos (admin, member, viewer)
- **Permissions** granulares (resource:action)
- **Row-Level Security (RLS)** en PostgreSQL (11 políticas)
- **Tenant isolation** garantizado a nivel de BD
- **Member invitations** con gestión de roles

### ✅ Application Management (NEW v2.4.0)

- **Application Registry** - Registro centralizado de apps
- **Tenant-App Association** - Control de apps habilitadas por tenant
- **User Access Control** - Acceso granular por usuario a apps
- **Authorization Flow** - Validación completa de acceso
- **Bulk Operations** - Asignación masiva de acceso
- **Audit Trail** - Registro de quién otorgó acceso y cuándo

### ✅ Seguridad

- **SQL Injection** protegido (Prisma parameterizado)
- **XSS** sanitizado (validación Joi)
- **CORS** configurable
- **Rate limiting** básico
- **HTTPS-ready**
- **JWT verification** estricta
- **4 capas de validación** por request

### ✅ Email Adapters

- **Resend** (producción, API moderna)
- **Nodemailer SMTP** (self-hosted, staging)
- **Ethereal** (desarrollo, email testing)
- Auto-detección según `EMAIL_PROVIDER` en `.env`

---

## 🚀 Inicio Rápido

### Prerrequisitos

```bash
Node.js >= 18.0.0
PostgreSQL >= 14
npm o yarn
```

### 1. Clonar e Instalar

```bash
git clone <repo-url>
cd new_sso_backend
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
```

**Edita `.env`:**

```bash
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/sso_db"

# JWT (genera claves con scripts)
JWT_PRIVATE_KEY_PATH="./keys/private.pem"
JWT_PUBLIC_KEY_PATH="./keys/public.pem"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Email (elige un proveedor)
EMAIL_PROVIDER="resend"  # o "smtp" o "ethereal"

# Resend (si usas Resend)
RESEND_API_KEY="re_xxxxx"
RESEND_FROM_EMAIL="noreply@tudominio.com"

# O SMTP (si usas Nodemailer)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu@email.com"
SMTP_PASS="tu-password"
SMTP_FROM="noreply@tudominio.com"

# App
PORT="3000"
NODE_ENV="development"
```

### 3. Generar Claves JWT

```bash
# Crea directorio keys si no existe
mkdir -p keys

# Genera clave privada
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048

# Genera clave pública
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

### 4. Crear Base de Datos

```bash
# Opción A: Crear BD manualmente
createdb -U postgres sso_db

# Opción B: Usar Docker
docker-compose up -d postgres
```

### 5. Ejecutar Migraciones

```bash
# Genera el cliente Prisma
npm run prisma:generate

# Aplica todas las migraciones
npm run migrate:up

# Verifica en la BD
psql -U postgres -d sso_db -c "\dt"
```

### 6. Iniciar Servidor

```bash
# Desarrollo (con auto-reload)
npm run dev:watch

# Producción
npm run build
npm start
```

**Servidor corriendo en:** `http://localhost:3000`

### 7. Probar API

```bash
# Health check
curl http://localhost:3000/health

# JWKS (claves públicas)
curl http://localhost:3000/.well-known/jwks.json

# Registro de usuario
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "password": "Test1234!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

---

## 🏗️ Arquitectura

### Stack Tecnológico

```
┌─────────────────────────────────────────────────┐
│  Frontend (Vue/React) + App Backends            │
└──────────────────┬──────────────────────────────┘
                   │ HTTP + JWT
┌──────────────────▼──────────────────────────────┐
│  Express Server (TypeScript)                    │
│  ├─ Routes (auth, tenant, user, otp, session)   │
│  ├─ Middleware (auth, logging, errorHandler)    │
│  └─ Services (auth, email, tenant, jwt)         │
└──────────────────┬──────────────────────────────┘
                   │ Prisma ORM
┌──────────────────▼──────────────────────────────┐
│  PostgreSQL 14+ (with RLS)                      │
│  ├─ users, tenants, tenant_members              │
│  ├─ roles, permissions                          │
│  ├─ refresh_tokens, otp_secrets                 │
│  ├─ addresses, other_information (NEW)          │
│  └─ RLS Policies (8 políticas activas)          │
└─────────────────────────────────────────────────┘
```

### Flujo de Autenticación

```
1. Usuario → POST /api/v1/auth/signup
   ├─ Valida input (Joi)
   ├─ Hashea password (Argon2)
   ├─ Guarda en BD (Prisma)
   └─ Envía email verificación (Resend/SMTP)

2. Usuario → POST /api/v1/auth/signin
   ├─ Valida credenciales
   ├─ Verifica 2FA (si está habilitado)
   ├─ Genera access token (15min)
   ├─ Genera refresh token (7 días)
   └─ Retorna tokens

3. App Backend → Valida JWT
   ├─ Verifica firma con clave pública
   ├─ Valida expiración
   ├─ Extrae userId + tenantId
   └─ Autoriza request
```

### Capas de Seguridad

```
Request → [1. CORS] → [2. Rate Limit] → [3. JWT Verify]
       → [4. Tenant Check] → [5. RLS Policy] → [6. Permission Check]
       → Handler → Response
```

---

## 📡 API Endpoints

**Base URL:** `http://localhost:3000/api/v1`

### Auth Endpoints

| Método | Ruta            | Descripción       | Auth               |
| ------ | --------------- | ----------------- | ------------------ |
| POST   | `/auth/signup`  | Registrar usuario | ❌                 |
| POST   | `/auth/signin`  | Login             | ❌                 |
| POST   | `/auth/refresh` | Renovar token     | ❌ (refresh token) |
| POST   | `/auth/signout` | Logout            | ✅                 |

### OTP/2FA Endpoints

| Método | Ruta                  | Descripción           | Auth |
| ------ | --------------------- | --------------------- | ---- |
| POST   | `/otp/generate`       | Genera QR para 2FA    | ✅   |
| POST   | `/otp/verify`         | Verifica y activa 2FA | ✅   |
| POST   | `/otp/validate`       | Valida código 2FA     | ✅   |
| POST   | `/otp/disable`        | Desactiva 2FA         | ✅   |
| GET    | `/otp/status/:userId` | Estado 2FA de usuario | ✅   |

### Email Verification

| Método | Ruta                         | Descripción      | Auth |
| ------ | ---------------------------- | ---------------- | ---- |
| POST   | `/email-verification/send`   | Enviar código    | ❌   |
| POST   | `/email-verification/verify` | Verificar código | ❌   |
| POST   | `/email-verification/resend` | Reenviar código  | ❌   |

### Tenant Endpoints

| Método | Ruta                           | Descripción        | Auth       |
| ------ | ------------------------------ | ------------------ | ---------- |
| POST   | `/tenants`                     | Crear tenant       | ✅         |
| GET    | `/tenants`                     | Listar mis tenants | ✅         |
| GET    | `/tenants/:id`                 | Detalle de tenant  | ✅         |
| PATCH  | `/tenants/:id`                 | Actualizar tenant  | ✅ (admin) |
| DELETE | `/tenants/:id`                 | Eliminar tenant    | ✅ (admin) |
| POST   | `/tenants/:id/members`         | Invitar miembro    | ✅ (admin) |
| PATCH  | `/tenants/:id/members/:userId` | Cambiar rol        | ✅ (admin) |
| DELETE | `/tenants/:id/members/:userId` | Remover miembro    | ✅ (admin) |

### User Endpoints

| Método | Ruta         | Descripción       | Auth |
| ------ | ------------ | ----------------- | ---- |
| GET    | `/users/me`  | Mi perfil         | ✅   |
| PATCH  | `/users/me`  | Actualizar perfil | ✅   |
| GET    | `/users/:id` | Perfil de usuario | ✅   |

### System Endpoints

| Método | Ruta                     | Descripción         | Auth |
| ------ | ------------------------ | ------------------- | ---- |
| GET    | `/health`                | Health check        | ❌   |
| GET    | `/ready`                 | Readiness probe     | ❌   |
| GET    | `/.well-known/jwks.json` | Claves públicas JWT | ❌   |

**Ver documentación completa:** `DEVELOPER_GUIDE.md`

---

## 🏢 Multi-Tenancy

### Concepto

Cada **tenant** representa una organización/equipo con:

- Usuarios propios
- Roles y permisos independientes
- Datos aislados (RLS en PostgreSQL)

Un usuario puede pertenecer a **múltiples tenants** con roles diferentes.

### Ejemplo Práctico

**1. Carlos crea su empresa (Acme Corp)**

```bash
POST /api/v1/tenants
Authorization: Bearer <token>
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}

# Response: Carlos es ADMIN automáticamente
{
  "id": "tenant-123",
  "name": "Acme Corp",
  "members": [
    { "userId": "carlos-id", "role": "admin" }
  ]
}
```

**2. Carlos invita a Alice como MEMBER**

```bash
POST /api/v1/tenants/tenant-123/members
Authorization: Bearer <token>
X-Tenant-ID: tenant-123
{
  "userId": "alice-id",
  "role": "member"
}
```

**3. Alice hace requests usando su tenant**

```bash
GET /api/v1/users
Authorization: Bearer <alice-token>
X-Tenant-ID: tenant-123

# Solo ve usuarios de tenant-123 (RLS activo)
```

### Roles Predefinidos

| Rol        | Permisos               | Uso Típico      |
| ---------- | ---------------------- | --------------- |
| **admin**  | Todos (CRUD completo)  | Dueño, CTO      |
| **member** | Read/Write (no delete) | Desarrolladores |
| **viewer** | Solo lectura           | Auditores, QA   |

### Row-Level Security (RLS)

PostgreSQL filtra **automáticamente** por `tenant_id`:

```sql
-- Política activa en tabla users
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Cuando haces `X-Tenant-ID: tenant-123`, el middleware establece:

```typescript
await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
// Todas las queries subsecuentes están filtradas por tenant
```

---

## 🔒 Seguridad

### JWT con RS256

- **Clave privada:** Firma tokens (solo backend)
- **Clave pública:** Verifica tokens (backend + apps)
- **Beneficio:** Apps pueden verificar tokens sin conocer la clave privada

### Password Hashing

```typescript
import argon2 from 'argon2';

// Hash al registrar
const hash = await argon2.hash(password);

// Verificar al login
const valid = await argon2.verify(hash, password);
```

### 2FA/TOTP

```typescript
// 1. Usuario solicita habilitar 2FA
POST /api/v1/otp/generate
→ Genera secret + QR code

// 2. Usuario escanea QR con Google Authenticator

// 3. Usuario verifica código inicial
POST /api/v1/otp/verify { token: "123456" }
→ Activa 2FA

// 4. En futuros logins:
POST /api/v1/auth/signin { email, password }
→ Response: { requiresOtp: true }

POST /api/v1/otp/validate { token: "654321" }
→ Response: { accessToken, refreshToken }
```

### Email Verification

```typescript
// 1. Al registrarse, se envía código de 6 dígitos
POST /api/v1/auth/signup
→ Email: "Tu código es: 847392"

// 2. Usuario verifica
POST /api/v1/email-verification/verify
{ email: "user@test.com", token: "847392" }

// 3. EmailVerification.verified = true
```

---

## 💻 Desarrollo

### Estructura del Proyecto

```
new_sso_backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # Express app setup
│   ├── config/               # Configuración (DB, JWT, Email)
│   ├── routes/               # Endpoints (9 archivos)
│   ├── services/             # Lógica de negocio (9 archivos)
│   ├── repositories/         # Acceso a datos (4 repos)
│   ├── middleware/           # Auth, logging, errors
│   ├── types/                # TypeScript interfaces
│   └── utils/                # Helpers
├── prisma/
│   └── schema.prisma         # Modelos de BD
├── migrations/               # Migraciones SQL
├── keys/                     # Claves JWT (gitignored)
├── .env                      # Variables de entorno
├── docker-compose.yml        # PostgreSQL local
├── Dockerfile                # Build de producción
└── tsconfig.json             # Config TypeScript
```

### Comandos Útiles

```bash
# Desarrollo
npm run dev              # Ejecutar sin reload
npm run dev:watch        # Ejecutar con auto-reload

# Build
npm run build            # Compilar TypeScript
npm run clean            # Limpiar dist/

# Testing
npm test                 # Ejecutar tests (Jest)
npm run test:watch       # Tests en watch mode

# Migraciones
npm run migrate:create add_campo   # Crear migración
npm run migrate:up                 # Aplicar migraciones
npm run migrate:down               # Rollback

# Prisma
npm run prisma:generate   # Regenerar cliente
npm run prisma:format     # Formatear schema
npx prisma studio         # UI para ver BD

# Linting
npm run lint              # Revisar errores
npm run lint:fix          # Auto-fix
npm run format            # Prettier
```

### Variables de Entorno

| Variable               | Descripción              | Ejemplo                                     |
| ---------------------- | ------------------------ | ------------------------------------------- |
| `DATABASE_URL`         | Conexión PostgreSQL      | `postgresql://user:pass@localhost:5432/sso` |
| `JWT_PRIVATE_KEY_PATH` | Ruta clave privada       | `./keys/private.pem`                        |
| `JWT_PUBLIC_KEY_PATH`  | Ruta clave pública       | `./keys/public.pem`                         |
| `JWT_ACCESS_EXPIRY`    | Expiración access token  | `15m`                                       |
| `JWT_REFRESH_EXPIRY`   | Expiración refresh token | `7d`                                        |
| `EMAIL_PROVIDER`       | Proveedor email          | `resend`, `smtp`, `ethereal`                |
| `RESEND_API_KEY`       | API key Resend           | `re_xxxxx`                                  |
| `SMTP_HOST`            | Servidor SMTP            | `smtp.gmail.com`                            |
| `PORT`                 | Puerto servidor          | `3000`                                      |
| `NODE_ENV`             | Entorno                  | `development`, `production`                 |

### Agregar un Endpoint Nuevo

**Ejemplo:** Endpoint para cambiar password

**1. Crear servicio** (`src/services/auth.ts`)

```typescript
async changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await userRepo.findById(userId);
  const valid = await argon2.verify(user.passwordHash, oldPassword);
  if (!valid) throw new UnauthorizedError('Contraseña incorrecta');

  const newHash = await argon2.hash(newPassword);
  await userRepo.update(userId, { passwordHash: newHash });
}
```

**2. Crear ruta** (`src/routes/auth.ts`)

```typescript
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  await authService.changePassword(req.userId, oldPassword, newPassword);
  res.json({ message: 'Contraseña actualizada' });
});
```

**3. Agregar validación** (Joi schema en route)

```typescript
const schema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});
```

---

## 🚀 Producción

### Deploy con Docker

**1. Build de imagen**

```bash
docker build -t sso-backend:latest .
```

**2. Ejecutar con Docker Compose**

```bash
docker-compose up -d
```

**3. Verificar salud**

```bash
curl http://localhost:3000/health
```

### Variables de Entorno Producción

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:pass@db.prod.com:5432/sso
JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private
JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public
EMAIL_PROVIDER=resend
RESEND_API_KEY=<secret>
PORT=3000
```

### Checklist Pre-Deploy

- [ ] Generar claves JWT nuevas (no reusar de dev)
- [ ] Configurar `DATABASE_URL` de producción
- [ ] Establecer `NODE_ENV=production`
- [ ] Configurar email provider (Resend recomendado)
- [ ] Ejecutar migraciones: `npm run migrate:up`
- [ ] Probar health checks: `/health`, `/ready`
- [ ] Configurar HTTPS (reverse proxy: Nginx, Caddy)
- [ ] Habilitar logging externo (CloudWatch, Datadog)
- [ ] Configurar monitoreo (Prometheus, Grafana)
- [ ] Revisar límites de rate limiting

### Monitoreo

```bash
# Logs
docker logs -f sso-backend

# Métricas (futuro: Prometheus)
GET /metrics

# Health checks
GET /health      # 200 si funciona
GET /ready       # 200 si BD conectada
```

---

## 🗺️ Roadmap

### ✅ Fase 1: Core (COMPLETADO - 8 semanas)

- [x] JWT Authentication (RS256)
- [x] Password management (Argon2)
- [x] 2FA/TOTP
- [x] Email verification (3 adapters)
- [x] Multi-tenancy (RBAC + RLS)
- [x] 19 API endpoints
- [x] User schema extendido (27 campos)

### 🟡 Fase 2: Testing (Pendiente - 3 semanas)

- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Security tests
- [ ] 80%+ coverage

### 🟡 Fase 3: Password Reset (Pendiente - 1 semana)

- [ ] Forgot password flow
- [ ] Reset token generation
- [ ] Email templates
- [ ] Reset endpoint

### 🟡 Fase 4: OAuth/Social Login (Pendiente - 4 semanas)

- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Microsoft OAuth
- [ ] Apple Sign In

### 🟡 Fase 5: SAML 2.0 (Pendiente - 3 semanas)

- [ ] SAML metadata endpoint
- [ ] Assertion Consumer Service
- [ ] IdP integration

### 🟡 Fase 6: DevOps (Pendiente - 2 semanas)

- [ ] CI/CD (GitHub Actions)
- [ ] Kubernetes manifests
- [ ] Automated testing
- [ ] Staging + Production deploys

### 🟡 Fase 7: Performance (Pendiente - 3 semanas)

- [ ] Redis caching
- [ ] Query optimization
- [ ] Load testing
- [ ] Database replicas

**Tiempo total estimado:** ~24 semanas (480 horas)  
**Progreso actual:** ~72% completado

---

## 📚 Documentación Adicional

- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Referencia técnica completa
- **[prisma/schema.prisma](./prisma/schema.prisma)** - Esquema de base de datos
- **[docker-compose.yml](./docker-compose.yml)** - Setup local con Docker
- **[.env.example](./.env.example)** - Variables de entorno template

---

## 🤝 Contribuciones

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-feature`
3. Commit: `git commit -m 'Agrega nueva feature'`
4. Hazpush: `git push origin feature/nueva-feature`
5. Abre un Pull Request

**Estándares de código:**

- TypeScript strict mode
- ESLint + Prettier
- Tests obligatorios para nuevas features
- Documentación actualizada

---

## 📄 Licencia

MIT License - Ver [LICENSE](./LICENSE)

---

## 👤 Autor

**EmpireSoft**  
Contacto: cmontes@empiresoft.com

---

## 🙏 Agradecimientos

- **SuperTokens** - Inspiración arquitectura
- **Prisma** - ORM excepcional
- **Resend** - Email API moderna

---

**¿Preguntas?** Abre un issue o consulta `DEVELOPER_GUIDE.md` para detalles técnicos.
