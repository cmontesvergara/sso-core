# 🏗️ Arquitectura Completa del Sistema SSO

## 📊 Diagrama de Componentes y Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SISTEMA SSO COMPLETO                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┐         ┌────────────────────────────────┐
│   SSO PORTAL (Frontend)        │         │    SSO BACKEND (API)           │
│   Angular/React App            │         │    Express + TypeScript        │
├────────────────────────────────┤         ├────────────────────────────────┤
│  https://sso.tudominio.com     │◄───────►│  https://api-sso.tudominio.com │
│                                │         │                                │
│  Páginas:                      │         │  Endpoints:                    │
│  • /login                      │         │  • POST /auth/signin           │
│  • /dashboard (lista apps)     │         │  • POST /auth/signup           │
│  • /profile                    │         │  • POST /auth/authorize        │
│  • /tenants                    │         │  • POST /auth/token            │
│                                │         │  • GET  /user/tenants          │
│  Cookie:                       │         │  • GET  /applications          │
│  sso_session = "abc123..."     │         │                                │
│                                │         │  DB: sso_sessions              │
└────────────────────────────────┘         └────────────────────────────────┘
         │                                              │
         │                                              │
         │  1. Usuario hace login                       │
         │──────────────────────────────────────────────►
         │                                              │
         │  2. Crea sso_session + cookie               │
         │◄──────────────────────────────────────────────
         │                                              │
         │  3. Usuario ve sus apps                      │
         │──────────────────────────────────────────────►
         │                                              │
         │  4. Devuelve lista de apps permitidas       │
         │◄──────────────────────────────────────────────
         │                                              │
         │                                              │
         ▼                                              ▼

         Usuario hace clic en "CRM App"

         │                                              │
         │  5. POST /auth/authorize                     │
         │  { tenantId, appId: "crm", redirectUri }    │
         │──────────────────────────────────────────────►
         │                                              │
         │  Valida:                                     │
         │  • Usuario tiene acceso al tenant           │
         │  • App existe y está activa                 │
         │  • App habilitada para tenant               │
         │  • Usuario tiene permiso en esta app        │
         │                                              │
         │  6. Genera auth_code + redirect             │
         │  { authCode: "xyz789", redirectUri }        │
         │◄──────────────────────────────────────────────
         │                                              │
         │  DB: auth_codes                             │
         │                                              │
         ▼                                              │


┌────────────────────────────────┐         ┌────────────────────────────────┐
│    APP FRONTEND (CRM)          │         │    APP BACKEND (CRM)           │
│    React/Angular/Vue           │         │    Express/NestJS/Django       │
├────────────────────────────────┤         ├────────────────────────────────┤
│  https://crm.acme.com          │◄───────►│  https://api-crm.acme.com      │
│                                │         │                                │
│  Páginas:                      │         │  Endpoints:                    │
│  • /customers                  │         │  • GET  /api/customers         │
│  • /leads                      │         │  • POST /api/orders            │
│  • /reports                    │         │  • ...business logic...        │
│                                │         │                                │
│  Cookie:                       │         │  Middleware:                   │
│  app_session = "def456..."     │         │  authenticateApp()             │
│                                │         │  - Valida app_session          │
│                                │         │  - Inyecta user + tenant ctx   │
└────────────────────────────────┘         └────────────────────────────────┘
         │                                              │
         │                                              │
         │  7. Redirect desde SSO con code             │
         │  GET /crm?code=xyz789                       │
         │◄─────────────────────────────────────────────┐
         │                                              │
         │  8. Frontend detecta code en URL            │
         │  → Llama a su backend                       │
         │──────────────────────────────────────────────►
         │  POST /auth/sso-callback                     │
         │  { code: "xyz789" }                          │
         │                                              │
         │                                              │  9. Backend intercambia
         │                                              │     code por session
         │                                              │────────────────────────┐
         │                                              │                        │
         │                                              │  POST /auth/token      │
         │                                              │  to SSO Backend        │
         │                                              │  { authCode, appId }   │
         │                                              │                        │
         │                                              │◄───────────────────────┘
         │                                              │  10. SSO valida code   │
         │                                              │      Crea app_session  │
         │                                              │      Devuelve:         │
         │                                              │      - sessionToken    │
         │                                              │      - user data       │
         │                                              │      - tenant data     │
         │                                              │                        │
         │  11. Backend crea cookie local              │
         │  Set-Cookie: app_session=def456             │
         │◄──────────────────────────────────────────────
         │                                              │
         │                                              │
         │  12. Usuario ya autenticado                 │
         │      Trabaja en CRM                         │
         │──────────────────────────────────────────────►
         │  GET /api/customers                          │
         │  Cookie: app_session=def456                 │
         │                                              │
         │                                              │  13. Valida session
         │                                              │      con SSO Backend
         │                                              │────────────────────────┐
         │                                              │                        │
         │                                              │  POST /auth/verify     │
         │                                              │  { sessionToken }      │
         │                                              │                        │
         │                                              │◄───────────────────────┘
         │                                              │  Devuelve user context │
         │                                              │                        │
         │  14. Responde con datos                     │
         │◄──────────────────────────────────────────────
         │                                              │
         ▼                                              ▼
```

---

## 🔑 Base de Datos del SSO Backend

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  users                          tenants                      │
│  ├── id (uuid)                  ├── id (uuid)               │
│  ├── email                      ├── name                    │
│  ├── passwordHash               ├── slug                    │
│  ├── systemRole ◄────┐          └── createdAt               │
│  │   • super_admin   │                                      │
│  │   • system_admin  │          tenant_members              │
│  │   • user          │          ├── userId ──────┐          │
│  └── ...             │          ├── tenantId     │          │
│                      │          └── role         │          │
│                      │              • admin      │          │
│  applications        │              • member     │          │
│  ├── id (uuid)       │              • viewer     │          │
│  ├── appId (crm)     │                           │          │
│  ├── name            │                           │          │
│  ├── url             │          ┌────────────────┘          │
│  ├── isActive        │          │                           │
│  └── ...             │          │                           │
│                      │          ▼                           │
│  tenant_apps         │      sso_sessions                    │
│  ├── tenantId ───────┤      ├── session_token              │
│  ├── applicationId   │      ├── userId ◄────────────────┐  │
│  └── isEnabled       │      ├── expiresAt               │  │
│                      │      └── ...                     │  │
│  user_app_access     │          Sesión PORTAL SSO       │  │
│  ├── userId ─────────┤                                   │  │
│  ├── tenantId        │                                   │  │
│  ├── applicationId   │      app_sessions                │  │
│  └── grantedBy       │      ├── session_token           │  │
│                      │      ├── appId (crm)             │  │
│  auth_codes          │      ├── userId ─────────────────┘  │
│  ├── code            │      ├── tenantId                   │
│  ├── userId          │      ├── role                       │
│  ├── tenantId        │      └── ...                        │
│  ├── appId           │          Sesión EN CADA APP         │
│  ├── used            │                                      │
│  └── expiresAt       │                                      │
│                      │                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo de Autenticación (Secuencia)

```
USUARIO                SSO PORTAL         SSO BACKEND         APP CRM          CRM BACKEND
  │                         │                   │                │                 │
  │ 1. Abre portal          │                   │                │                 │
  ├─────────────────────────►                   │                │                 │
  │                         │                   │                │                 │
  │ 2. Login form           │                   │                │                 │
  │◄─────────────────────────                   │                │                 │
  │                         │                   │                │                 │
  │ 3. POST /auth/signin    │                   │                │                 │
  │                         ├───────────────────►                │                 │
  │                         │  email + password │                │                 │
  │                         │                   │                │                 │
  │                         │ 4. Crea sso_session                │                 │
  │                         │◄──────────────────┤                │                 │
  │                         │  Set-Cookie: sso  │                │                 │
  │ 5. Dashboard + apps     │                   │                │                 │
  │◄─────────────────────────                   │                │                 │
  │                         │                   │                │                 │
  │ 6. Click "CRM" button   │                   │                │                 │
  ├─────────────────────────►                   │                │                 │
  │                         │                   │                │                 │
  │                         │ 7. POST /authorize                 │                 │
  │                         ├───────────────────►                │                 │
  │                         │  (validaciones)   │                │                 │
  │                         │                   │                │                 │
  │                         │ 8. auth_code      │                │                 │
  │                         │◄──────────────────┤                │                 │
  │                         │                   │                │                 │
  │ 9. Redirect a CRM       │                   │                │                 │
  ├─────────────────────────┼───────────────────┼────────────────►                │
  │  crm.com?code=xyz789    │                   │                │                 │
  │                         │                   │                │                 │
  │                         │                   │                │ 10. Detecta code│
  │                         │                   │                ├─────────────────►
  │                         │                   │                │  /auth/callback │
  │                         │                   │                │                 │
  │                         │                   │ 11. POST /auth/token            │
  │                         │                   │◄────────────────────────────────┤
  │                         │                   │  { authCode, appId }            │
  │                         │                   │                                 │
  │                         │                   │ 12. Valida code                 │
  │                         │                   │     Crea app_session            │
  │                         │                   │     Devuelve session_token      │
  │                         │                   ├────────────────────────────────►
  │                         │                   │  { sessionToken, user, tenant } │
  │                         │                   │                                 │
  │ 13. Set-Cookie app_session                 │                │                 │
  │◄───────────────────────────────────────────────────────────────────────────────
  │                         │                   │                │                 │
  │ 14. Usuario trabaja en CRM                 │                │                 │
  ├────────────────────────────────────────────────────────────►                 │
  │  GET /api/customers                        │                ├─────────────────►
  │  Cookie: app_session                       │                │                 │
  │                         │                   │                │ 15. Valida      │
  │                         │                   │◄────────────────────────────────┤
  │                         │                   │  verificar session              │
  │                         │                   ├────────────────────────────────►
  │                         │                   │  user context                   │
  │ 16. Datos de clientes                      │                │                 │
  │◄───────────────────────────────────────────────────────────────────────────────
  │                         │                   │                │                 │
```

---

## 📝 Responsabilidades de Cada Componente

### 🟦 **SSO Frontend (Portal)**

- Interfaz de login/registro
- Dashboard con lista de apps del usuario
- Gestión de perfil
- Inicio del flujo SSO (botón "Abrir CRM")
- Cookie: `sso_session`

**Tecnologías:** Angular/React/Vue  
**URL Ejemplo:** `https://sso.tudominio.com`

---

### 🟩 **SSO Backend**

- Autenticación de usuarios
- Gestión de tenants y membresías
- Registro de aplicaciones
- Control de acceso (quién puede usar qué app)
- Generación de authorization codes
- Creación de app_sessions
- DB: `sso_sessions`, `app_sessions`, `auth_codes`

**Tecnologías:** Express + TypeScript + PostgreSQL  
**URL Ejemplo:** `https://api-sso.tudominio.com`

---

### 🟨 **App Frontend (CRM/Admin/etc)**

- UI específica de la aplicación
- Detecta código OAuth en URL
- Llama a su propio backend para intercambiar código
- Cookie: `app_session` (específica de esta app)

**Tecnologías:** React/Angular/Vue (cualquier framework)  
**URL Ejemplo:** `https://crm.acme.com`

---

### 🟧 **App Backend (CRM/Admin/etc)**

- Lógica de negocio de la app
- Endpoint `/auth/sso-callback` que recibe code
- Intercambia code con SSO Backend
- Valida `app_session` en cada request
- Middleware de autenticación

**Tecnologías:** Express/NestJS/Django/cualquier backend  
**URL Ejemplo:** `https://api-crm.acme.com`

---

## 🔐 Tipos de Sesiones

| Sesión          | Dónde           | Para Qué                            | Cookie                            | Tabla DB       |
| --------------- | --------------- | ----------------------------------- | --------------------------------- | -------------- |
| **SSO Session** | Portal SSO      | Navegar el portal, ver apps, perfil | `sso_session`                     | `sso_sessions` |
| **App Session** | Cada aplicación | Trabajar en la app específica       | `app_session` (diferente por app) | `app_sessions` |

### Diferencias Clave

#### SSO Session

```javascript
{
  session_token: "abc123...",
  user_id: "user-uuid",
  expires_at: "2026-01-30T12:00:00Z",
  // NO incluye tenant_id
  // NO incluye app_id
  // Es global del usuario
}
```

#### App Session

```javascript
{
  session_token: "def456...",
  app_id: "crm",
  user_id: "user-uuid",
  tenant_id: "acme-uuid",
  role: "admin",
  expires_at: "2026-01-30T12:00:00Z",
  // Contexto específico de app + tenant
}
```

---

## 🔄 Endpoints Principales

### SSO Backend

| Endpoint          | Método   | Descripción                          | Autenticación          |
| ----------------- | -------- | ------------------------------------ | ---------------------- |
| `/auth/signin`    | POST     | Login de usuario, crea `sso_session` | Pública                |
| `/auth/signup`    | POST     | Registro de usuario                  | Pública                |
| `/auth/authorize` | POST     | Genera auth_code para app            | Cookie `sso_session`   |
| `/auth/token`     | POST     | Intercambia code por `app_session`   | Pública (valida code)  |
| `/auth/verify`    | POST     | Valida `app_session` token           | Pública (valida token) |
| `/user/tenants`   | GET      | Lista tenants y apps del usuario     | Cookie `sso_session`   |
| `/applications`   | GET/POST | CRUD de aplicaciones                 | System Admin           |

### App Backend (Ejemplo CRM)

| Endpoint             | Método | Descripción                          | Autenticación        |
| -------------------- | ------ | ------------------------------------ | -------------------- |
| `/auth/sso-callback` | POST   | Recibe code, intercambia por session | Code válido          |
| `/api/customers`     | GET    | Lógica de negocio                    | Cookie `app_session` |
| `/api/orders`        | POST   | Lógica de negocio                    | Cookie `app_session` |

---

## ✅ Ventajas de esta Arquitectura

1. **Single Sign-On Real**: Login una vez, acceso a todas las apps
2. **Seguridad**: Cada app tiene su propia sesión aislada
3. **Contexto**: Cada sesión sabe tenant + rol del usuario
4. **Escalabilidad**: Agregar nuevas apps sin modificar SSO
5. **Control Granular**: Permisos por usuario, tenant y app
6. **Revocación**: Se puede invalidar acceso específico sin afectar otras apps
7. **Multi-tenancy**: Usuarios pueden pertenecer a múltiples tenants
8. **Independencia**: Apps pueden usar cualquier tecnología

---

## 🚀 Implementación Paso a Paso

### 1. Usuario se autentica en SSO Portal

```javascript
// SSO Frontend
const response = await axios.post('https://api-sso.com/auth/signin', {
  email: 'user@example.com',
  password: 'secret',
});

// SSO Backend crea sso_session y devuelve cookie
// Cookie: sso_session=abc123...
```

### 2. Usuario hace clic en una app

```javascript
// SSO Frontend
const response = await axios.post(
  'https://api-sso.com/auth/authorize',
  {
    tenantId: 'acme-uuid',
    appId: 'crm',
    redirectUri: 'https://crm.acme.com/auth/callback',
  },
  {
    withCredentials: true, // Envía cookie sso_session
  }
);

// Response: { authCode: 'xyz789', redirectUri: '...' }
// Redirect usuario a: https://crm.acme.com?code=xyz789
```

### 3. App recibe código y lo intercambia

```javascript
// CRM Backend
app.post('/auth/sso-callback', async (req, res) => {
  const { code } = req.body;

  // Intercambiar con SSO
  const ssoResponse = await axios.post('https://api-sso.com/auth/token', {
    authCode: code,
    appId: 'crm',
  });

  // ssoResponse: { sessionToken, user, tenant }

  // Crear cookie local
  res.cookie('app_session', ssoResponse.sessionToken, {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, user: ssoResponse.user });
});
```

### 4. App valida requests con app_session

```javascript
// CRM Backend - Middleware
async function authenticateApp(req, res, next) {
  const sessionToken = req.cookies.app_session;

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session' });
  }

  // Validar con SSO
  const response = await axios.post('https://api-sso.com/auth/verify', {
    sessionToken,
    appId: 'crm',
  });

  // Inyectar contexto en request
  req.user = response.data.user;
  req.tenant = response.data.tenant;

  next();
}

// Usar en rutas
app.get('/api/customers', authenticateApp, async (req, res) => {
  // req.user y req.tenant disponibles
  const customers = await getCustomers(req.tenant.tenantId);
  res.json(customers);
});
```

---

## 🔒 Seguridad

### Headers de Seguridad Recomendados

```javascript
// SSO Backend
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

### Cookies Seguras

```javascript
// Configuración recomendada
const cookieOptions = {
  httpOnly: true, // No accesible desde JavaScript
  secure: true, // Solo HTTPS (producción)
  sameSite: 'lax', // Protección CSRF
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  domain: '.tudominio.com', // Compartir entre subdominios
};
```

---

## 📚 Recursos Adicionales

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Versión:** 2.5.0  
**Fecha:** 29 de enero de 2026  
**Autor:** EmpireSoft SSO Team
