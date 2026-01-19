# Backend Setup Guide - SSO v2

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### Installation

```bash
# 1. Clone repository
cd /Users/cmontes/EmpireSoft/Projects/Single\ Sign\ On/new_sso_backend

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env con tus credenciales PostgreSQL

# 4. Run migrations
npm run migrate:up

# 5. Generate Prisma client
npm run prisma:generate

# 6. Start dev server
npm run dev
```

**Server estará en**: http://localhost:3000

---

## Development

### Common Commands

```bash
# Development with auto-reload
npm run dev

# Compile TypeScript
npm run build

# Format code
npm run format

# Lint code
npm run lint

# Create new migration
npm run migrate:create -- add_my_feature

# Revert last migration
npm run migrate:down

# Generate Prisma types
npm run prisma:generate

# View Prisma schema
npm run prisma:format

# Run tests
npm test

# Watch tests
npm test -- --watch
```

## Estructura de Carpetas

```
src/
├── index.ts                    # Punto de entrada
├── server.ts                   # Configuración Express
├── config/                     # Configuración
│   └── index.ts
├── database/                   # Capa de base de datos
│   └── types.ts
├── middleware/                 # Middlewares Express
│   ├── auth.ts
│   ├── errorHandler.ts
│   └── logging.ts
├── routes/                     # Rutas API
│   ├── auth.ts
│   ├── session.ts
│   ├── user.ts
│   ├── tenant.ts
│   ├── role.ts
│   ├── emailVerification.ts
│   ├── metadata.ts
│   └── docs.ts
├── services/                   # Lógica de negocio
│   ├── auth.ts
│   ├── session.ts
│   ├── user.ts
│   ├── tenant.ts
│   ├── role.ts
│   ├── jwt.ts
│   ├── crypto.ts
│   └── email.ts
├── exceptions/                 # Excepciones personalizadas
│   └── index.ts
├── types/                      # Tipos TypeScript
│   └── index.ts
└── utils/                      # Utilidades
    ├── logger.ts
    ├── helpers.ts
    └── validator.ts
```

## Características Implementadas

- ✅ Estructura modular
- ✅ Configuración con YAML y .env
- ✅ Middleware de autenticación
- ✅ Manejo de errores centralizado
- ✅ Logging estructurado
- ✅ Validación de entrada
- ✅ TypeScript strict

## Características por Implementar

- 🔲 Base de datos (MySQL, PostgreSQL, SQLite)
- 🔲 JWT token generation y validation
- 🔲 Password hashing
- 🔲 Email sending
- 🔲 User authentication (signup/signin)
- 🔲 Session management
- 🔲 Multi-tenancy
- 🔲 User roles y permissions
- 🔲 Email verification
- 🔲 Password reset
- 🔲 OAuth integration

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Crear nueva cuenta
- `POST /api/v1/auth/signin` - Iniciar sesión
- `POST /api/v1/auth/signout` - Cerrar sesión
- `POST /api/v1/auth/refresh` - Renovar token

### Session
- `GET /api/v1/session/verify` - Verificar sesión
- `POST /api/v1/session/refresh` - Renovar sesión
- `POST /api/v1/session/revoke` - Revocar sesión

### User
- `GET /api/v1/user/:userId` - Obtener usuario
- `PUT /api/v1/user/:userId` - Actualizar usuario
- `DELETE /api/v1/user/:userId` - Eliminar usuario

### Tenant
- `POST /api/v1/tenant` - Crear tenant
- `GET /api/v1/tenant/:tenantId` - Obtener tenant
- `PUT /api/v1/tenant/:tenantId` - Actualizar tenant

### Roles
- `POST /api/v1/role` - Crear rol
- `GET /api/v1/role/:roleId` - Obtener rol
- `POST /api/v1/role/:roleId/permission` - Añadir permiso

### Email Verification
- `POST /api/v1/email-verification/send` - Enviar email
- `POST /api/v1/email-verification/verify` - Verificar email
- `POST /api/v1/email-verification/resend` - Reenviar email

---

## Configuración de Email

El backend soporta **3 adaptadores de email**:

### 1. Ethereal (Desarrollo)
```bash
# .env
NODE_ENV=development
EMAIL_PROVIDER=ethereal
```
- ✅ Auto-setup, no requiere API key
- ✅ Emails se abren en navegador
- ❌ Solo desarrollo

### 2. Resend (Producción - Recomendado)
```bash
# .env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```
- ✅ API moderna, excelente deliverability
- ✅ Dashboard analytics
- ✅ Planes freemium

Obtener API key: https://resend.com

### 3. SMTP/Nodemailer (Flexible)
```bash
# .env
EMAIL_PROVIDER=nodemailer
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your_username
EMAIL_PASS=your_password
```
- ✅ Compatible con cualquier SMTP (Mailtrap, SendGrid, Gmail, AWS SES)
- ✅ Control total

**Para más detalles sobre configuración de email, ver `EMAIL_ADAPTERS.md`**

### Metadata
- `POST /api/v1/metadata/:userId` - Guardar metadata
- `GET /api/v1/metadata/:userId` - Obtener metadata
- `PUT /api/v1/metadata/:userId` - Actualizar metadata

## Próximos Pasos

1. Implementar capa de base de datos
2. Implementar servicios de JWT
3. Implementar servicios de email
4. Agregar autenticación OAuth
5. Agregar pruebas unitarias
6. Agregar documentación Swagger
7. Agregar Docker support

## Desarrollo

### Linting
```bash
npm run lint
npm run lint:fix
```

### Formato
```bash
npm run format
```

### Testing
```bash
npm test
```

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue nuestras guías de contribución.

## Licencia

MIT
