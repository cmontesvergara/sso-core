---
title: "Arquitectura"
---

# Arquitectura

El SSO Core es un **Identity Provider (IdP)** centralizado que implementa un flujo de **Authorization Code** inspirado en OAuth 2.0 con cookies HttpOnly.

## Diagrama de Componentes

```mermaid
graph TD
    User["Usuario"] -->|HTTPS| Portal["SSO Portal (4201)"]
    User -->|HTTPS| App["App Frontend (4200)"]

    Portal -->|"API REST + Cookie"| Backend["SSO Core Backend (3000)"]
    App -->|Redirect| Portal

    subgraph "SSO Core Backend"
        Routes["Routes Layer"]
        Services["Services Layer"]
        Repos["Repository Layer"]
        Middleware["Middleware"]

        Routes --> Services
        Services --> Repos
        Middleware --> Routes
    end

    Backend -->|"Prisma ORM"| DB[("PostgreSQL + RLS")]

    AppBackend["App Backend (4300)"] -->|"/auth/token\n/auth/verify-session"| Backend
    App -->|"Cookie HttpOnly"| AppBackend
```

## Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| Runtime | Node.js 18+ | Ejecución server-side |
| Framework | Express 4.18 | Enrutamiento HTTP |
| ORM | Prisma | Acceso a datos / migrations |
| Base de datos | PostgreSQL 14+ | Persistencia con RLS |
| Hashing | Argon2 | Hashing de contraseñas |
| Tokens | jsonwebtoken (RS256) | Firma asimétrica de JWT |
| Validación | Joi | Schemas de validación |
| Rate Limiting | express-rate-limit | Protección por endpoint |
| Email | Nodemailer / Resend | Verificación y notificaciones |

## Capas de la Aplicación

### Routes (`src/routes/`)

Definen los endpoints HTTP, validan entrada con Joi y delegan al service layer:

| Archivo | Prefijo | Endpoints |
| :--- | :--- | :--- |
| `auth.ts` | `/auth` | signup, signin, logout, authorize, token, verify-session |
| `user.ts` | `/user` | profile, tenants |
| `tenant.ts` | `/tenant` | CRUD, members, apps |
| `role.ts` | `/role` | CRUD, permissions |
| `applications.ts` | `/applications` | CRUD, tenant apps, user access |
| `appResource.ts` | `/app-resources` | register, list, tenant-available |
| `otp.ts` | `/otp` | generate, verify, validate, backup-code |
| `emailVerification.ts` | `/email-verification` | send, verify |
| `session.ts` | `/session` | verify, refresh, revoke |

### Services (`src/services/`)

Lógica de negocio: autenticación, gestión de sesiones, JWT, OTP, email.

### Repositories (`src/repositories/`)

Acceso a datos a través de Prisma Client. Un repositorio por modelo de base de datos.

### Middleware (`src/middleware/`)

| Middleware | Descripción |
| :--- | :--- |
| `auth.ts` | Verifica Bearer token (legacy) |
| `ssoAuth.ts` | Verifica cookie `sso_session` |
| `ssoSystemAdmin.ts` | Verifica roles System Admin / Super Admin |
| `errorHandler.ts` | Manejo centralizado de errores |

## Flujo de Autenticación SSO

El sistema soporta dos modos de autenticación:

### Modo A: App-Initiated

```mermaid
sequenceDiagram
    participant User as Usuario
    participant App as App Frontend
    participant AppBE as App Backend
    participant SSO as SSO Portal
    participant SSOBE as SSO Core Backend
    participant DB as PostgreSQL

    User->>App: Accede a la app
    App->>AppBE: GET /session (sin cookie)
    AppBE-->>App: 401 No autenticado
    App->>SSO: Redirect con ?app_id=crm&redirect_uri=...

    User->>SSO: Login (email + password)
    SSO->>SSOBE: POST /auth/signin
    SSOBE->>DB: Verificar credenciales
    SSOBE-->>SSO: Set cookie sso_session

    User->>SSO: Seleccionar tenant
    SSO->>SSOBE: POST /auth/authorize
    SSOBE->>DB: Generar auth code (5 min TTL)
    SSOBE-->>SSO: authCode + redirectUri

    SSO->>App: Redirect /callback?code=abc123
    App->>AppBE: POST /exchange con code
    AppBE->>SSOBE: POST /auth/token
    SSOBE->>DB: Validar code (one-time use)
    SSOBE-->>AppBE: sessionToken + user + tenant
    AppBE-->>App: Set cookie app_session

    User->>App: Accede con sesión activa
```

### Modo B: Direct SSO

El usuario accede directamente al portal SSO, ve su dashboard con tenants y aplicaciones, y lanza una app desde ahí. El flujo de generación de código es el mismo.

## Decisiones de Diseño

### ¿Por qué Authorization Code Flow?

- Los tokens **nunca** se exponen en el frontend
- El código de autorización es de **un solo uso** con TTL de 5 minutos
- Los backends validan directamente con el SSO Core

### ¿Por qué Cookies HttpOnly?

- Inmunes a ataques XSS (JavaScript no puede leerlas)
- Se envían automáticamente en cada request
- `SameSite: lax` previene ataques CSRF
- `Secure: true` en producción fuerza HTTPS

### ¿Por qué RS256 y no HS256?

- La clave privada solo la tiene el SSO Core
- Las aplicaciones verifican con la clave pública
- No necesitan conectarse al SSO Core para cada request
- Endpoint JWKS (`/.well-known/jwks.json`) distribuye claves

### ¿Por qué RLS en PostgreSQL?

- El aislamiento entre tenants se garantiza a **nivel de base de datos**
- Incluso si hay un bug en la aplicación, los datos de otro tenant no son accesibles
- Las políticas SQL se aplican transparentemente a todas las queries
