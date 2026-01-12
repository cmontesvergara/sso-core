# SuperTokens Core Node.js - Guía de Proyecto

## 📋 Descripción General

Este proyecto es una **versión homóloga en Node.js con Express** del SuperTokens Core original (Java). Mantiene la misma arquitectura, estructura de carpetas y características, pero implementada completamente en TypeScript/Node.js.

## 🎯 Objetivos Alcanzados

✅ **Estructura modular y escalable**

- Separación clara de responsabilidades
- Arquitectura por capas
- Fácil mantenimiento y extensión

✅ **Configuración flexible**

- Soporte YAML y variables de entorno
- Configuración por instancia/tenant

✅ **TypeScript strict**

- Type-safe
- Mejor experiencia de desarrollo

✅ **Express.js como framework**

- Middlewares bien organizados
- Rutas modulares

✅ **Seguridad incorporada**

- Helmet para headers de seguridad
- CORS configurado
- Middleware de autenticación

✅ **Monitoreo y logs**

- Logger estructurado
- Middleware de logging

## 📁 Estructura de Directorios

```
supertokens-core-node/
├── src/
│   ├── index.ts                    # Entry point
│   ├── server.ts                   # Configuración Express
│   ├── config/
│   │   └── index.ts                # Gestor de configuración
│   ├── database/
│   │   └── types.ts                # Interfaces database
│   ├── middleware/
│   │   ├── auth.ts                 # Auth middleware
│   │   ├── errorHandler.ts         # Error handling
│   │   └── logging.ts              # Request logging
│   ├── routes/
│   │   ├── auth.ts                 # Auth endpoints
│   │   ├── session.ts              # Session endpoints
│   │   ├── user.ts                 # User management
│   │   ├── tenant.ts               # Multi-tenancy
│   │   ├── role.ts                 # Roles & permissions
│   │   ├── emailVerification.ts    # Email verification
│   │   ├── metadata.ts             # User metadata
│   │   └── docs.ts                 # API documentation
│   ├── services/
│   │   ├── auth.ts                 # Auth business logic
│   │   ├── session.ts              # Session management
│   │   ├── user.ts                 # User operations
│   │   ├── tenant.ts               # Tenant operations
│   │   ├── role.ts                 # Role operations
│   │   ├── jwt.ts                  # JWT handling
│   │   ├── crypto.ts               # Encryption/hashing
│   │   └── email.ts                # Email sending
│   ├── exceptions/
│   │   └── index.ts                # Custom exceptions
│   ├── types/
│   │   └── index.ts                # TypeScript types
│   └── utils/
│       ├── logger.ts               # Logger utility
│       ├── helpers.ts              # Utility functions
│       ├── validator.ts            # Input validation
│       └── __tests__/              # Unit tests
├── config.yaml                     # Configuración principal
├── .env.example                    # Variables de entorno
├── package.json                    # Dependencias
├── tsconfig.json                   # Config TypeScript
├── jest.config.json                # Config Jest
├── Dockerfile                      # Docker image
├── docker-compose.yml              # Docker compose
├── README.md                       # Documentación
├── DEVELOPMENT.md                  # Guía de desarrollo
├── CONTRIBUTING.md                 # Guía de contribución
└── LICENSE                         # Licencia MIT
```

## 🚀 Características Principales

### 1. **Autenticación**

- Signup / Signin
- Signout
- Token refresh
- Password hashing con bcryptjs

### 2. **Gestión de Sesiones**

- Creación de sesiones
- Verificación de sesiones
- Revocación de sesiones
- Refresh de tokens

### 3. **Gestión de Usuarios**

- Crear usuarios
- Obtener información de usuario
- Actualizar usuarios
- Eliminar usuarios
- Verificación de email

### 4. **Multi-Tenancy**

- Crear tenants
- Gestionar tenants
- Aislamiento de datos por tenant

### 5. **Roles y Permisos**

- RBAC (Role-Based Access Control)
- Crear roles
- Asignar permisos
- Validar permisos

### 6. **Metadata de Usuario**

- Guardar metadata personalizada
- Obtener metadata
- Actualizar metadata

## 🔧 Tecnologías

### Core

- **Node.js** 18+
- **Express.js** - Framework web
- **TypeScript** - Lenguaje tipado

### Base de Datos

- **MySQL** / **PostgreSQL** / **SQLite**
- Query builder pattern

### Seguridad

- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT tokens
- **helmet** - HTTP headers
- **cors** - CORS middleware

### Herramientas

- **Jest** - Testing
- **ESLint** - Linting
- **Prettier** - Code formatting
- **Docker** - Containerización

## 📦 Dependencias Principales

```json
{
  "express": "^4.18.2",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "uuid": "^9.0.1",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "yaml": "^2.4.2",
  "cookie-parser": "^1.4.6",
  "express-rate-limit": "^7.1.5"
}
```

## 🎬 Inicio Rápido

### Desarrollo

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Ejecutar en modo desarrollo
npm run dev:watch
```

### Producción

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
# Con Docker Compose (incluye MySQL)
docker-compose up

# O construir imagen
docker build -t supertokens-core .
```

## 📚 API Endpoints

### Authentication

```
POST   /api/v1/auth/signup              # Crear cuenta
POST   /api/v1/auth/signin              # Iniciar sesión
POST   /api/v1/auth/signout             # Cerrar sesión
POST   /api/v1/auth/refresh             # Renovar token
```

### Session

```
GET    /api/v1/session/verify           # Verificar sesión
POST   /api/v1/session/refresh          # Renovar sesión
POST   /api/v1/session/revoke           # Revocar sesión
```

### User

```
GET    /api/v1/user/:userId             # Obtener usuario
PUT    /api/v1/user/:userId             # Actualizar usuario
DELETE /api/v1/user/:userId             # Eliminar usuario
```

### Tenant

```
POST   /api/v1/tenant                   # Crear tenant
GET    /api/v1/tenant/:tenantId         # Obtener tenant
PUT    /api/v1/tenant/:tenantId         # Actualizar tenant
```

### Roles

```
POST   /api/v1/role                     # Crear rol
GET    /api/v1/role/:roleId             # Obtener rol
POST   /api/v1/role/:roleId/permission  # Añadir permiso
```

### Email Verification

```
POST   /api/v1/email-verification/send  # Enviar email
POST   /api/v1/email-verification/verify # Verificar email
```

### Metadata

```
POST   /api/v1/metadata/:userId         # Guardar metadata
GET    /api/v1/metadata/:userId         # Obtener metadata
PUT    /api/v1/metadata/:userId         # Actualizar metadata
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Con coverage
npm test -- --coverage

# Watch mode
npm test:watch
```

## 📝 Configuración

### config.yaml

Configuración del servidor, base de datos, JWT, y características:

```yaml
port: 3567
host: localhost
database:
  type: mysql
  host: localhost
  port: 3306
jwt:
  algorithm: HS256
  secret: your-secret-key
access_token_validity: 3600
refresh_token_validity: 604800
```

### .env

Variables de entorno:

```env
PORT=3567
HOST=localhost
DB_TYPE=mysql
JWT_SECRET=your-secret-key
LOG_LEVEL=info
```

## 🔒 Seguridad

- Headers de seguridad con Helmet
- CORS configurado
- Password hashing con bcryptjs (10 rounds)
- JWT para autenticación stateless
- Middleware de autenticación
- Rate limiting disponible
- Input validation

## 📊 Arquitectura

```
┌─────────────────────────────────┐
│        Express Server           │
├─────────────────────────────────┤
│      Routes (API Endpoints)     │
├─────────────────────────────────┤
│      Services (Business Logic)  │
├─────────────────────────────────┤
│      Repository Layer           │
├─────────────────────────────────┤
│       Database Layer            │
├─────────────────────────────────┤
│   MySQL / PostgreSQL / SQLite   │
└─────────────────────────────────┘
```

## 🚦 Status Actual

### ✅ Completado

- Estructura de proyecto
- Configuración y variables de entorno
- Middlewares (auth, error, logging)
- Rutas base para todos los módulos
- Servicios skeleton
- Tipos TypeScript
- Excepciones personalizadas
- Utilidades (logger, validator, helpers)
- Configuración Docker
- Tests básicos

### 🔲 Por Implementar

- Capa de base de datos (conexión y queries)
- Implementación completa de servicios
- JWT token generation/validation
- Email sending
- Autenticación OAuth
- WebAuthn/SAML
- Pruebas de integración
- Documentación Swagger
- Métricas y monitoring
- Rate limiting

## 💡 Próximos Pasos

1. **Implementar Database Layer**
   - Conexión a MySQL/PostgreSQL
   - Query builder
   - Migrations

2. **Implementar Services Completos**
   - JWT service
   - Crypto service
   - Email service
   - Auth service

3. **Agregar Autenticación**
   - OAuth
   - SAML
   - WebAuthn

4. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

5. **Documentación**
   - Swagger/OpenAPI
   - API documentation
   - Architecture docs

## 🤝 Contributing

Ver `CONTRIBUTING.md` para guías de contribución.

## 📄 Licencia

MIT License - Ver `LICENSE` para detalles.

## 📞 Soporte

- Documentación: `/docs`
- Issues: GitHub Issues
- Discord: Community chat

---

**Versión:** 11.3.0
**Node.js Requerido:** >= 18.0.0
**Última Actualización:** 2024
