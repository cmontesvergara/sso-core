# 🔄 Guía de Integración para App Backends

## 📋 Resumen de Implementación Completa

### ✅ Componentes Disponibles

| Componente                   | Estado          | Ubicación                   |
| ---------------------------- | --------------- | --------------------------- |
| `app_sessions` tabla         | ✅ Implementado | PostgreSQL DB               |
| `appSessionRepo.prisma.ts`   | ✅ Implementado | `src/repositories/`         |
| `POST /auth/authorize`       | ✅ Implementado | `src/routes/auth.ts`        |
| `POST /auth/token`           | ✅ **NUEVO**    | `src/routes/auth.ts`        |
| `POST /auth/verify-session`  | ✅ **NUEVO**    | `src/routes/auth.ts`        |
| `authenticateApp` middleware | ✅ **NUEVO**    | `src/middleware/appAuth.ts` |

---

## 🚀 Flujo Completo de Autenticación

### 1️⃣ Usuario hace login en SSO Portal

```typescript
// Usuario ya tiene sso_session cookie
// Ve lista de apps en dashboard
```

### 2️⃣ Usuario hace clic en una App (ej: CRM)

```typescript
// SSO Frontend llama a:
POST https://api-sso.tudominio.com/api/v1/auth/authorize
{
  tenantId: "tenant-uuid",
  appId: "crm",
  redirectUri: "https://crm.acme.com/auth/callback"
}

// Response:
{
  success: true,
  authCode: "xyz789abc...",
  redirectUri: "https://crm.acme.com/auth/callback?code=xyz789abc..."
}
```

### 3️⃣ Usuario es redirigido a la App con el código

```
https://crm.acme.com/auth/callback?code=xyz789abc...
```

### 4️⃣ App Frontend detecta el código y llama a su Backend

```typescript
// CRM Frontend (React/Angular/Vue)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
  // Llamar a tu backend
  const response = await axios.post('/auth/sso-callback', {
    code: code,
  });

  if (response.data.success) {
    // Ya tienes cookie app_session
    // Redirect a dashboard
    window.location.href = '/dashboard';
  }
}
```

### 5️⃣ App Backend intercambia el código por session token

```typescript
// CRM Backend (Express/NestJS/Django)
app.post('/auth/sso-callback', async (req, res) => {
  const { code } = req.body;

  try {
    // Intercambiar código con SSO Backend
    const ssoResponse = await axios.post('https://api-sso.tudominio.com/api/v1/auth/token', {
      authCode: code,
      appId: 'crm', // Tu app ID registrado en SSO
    });

    // ssoResponse.data:
    // {
    //   success: true,
    //   sessionToken: "jwt-token-aqui",
    //   expiresAt: "2026-01-30T12:00:00Z",
    //   user: { userId, email, firstName, lastName },
    //   tenant: { tenantId, name, slug, role }
    // }

    // Crear cookie local en tu app
    res.cookie('app_session', ssoResponse.data.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    });

    res.json({
      success: true,
      user: ssoResponse.data.user,
      tenant: ssoResponse.data.tenant,
    });
  } catch (error) {
    console.error('SSO callback error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});
```

### 6️⃣ App Backend valida requests con el middleware

```typescript
import axios from 'axios';

// Middleware para validar app_session
async function authenticateApp(req, res, next) {
  try {
    // Obtener token de cookie o header
    const sessionToken =
      req.cookies?.app_session || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'No session' });
    }

    // Validar con SSO Backend
    const response = await axios.post('https://api-sso.tudominio.com/api/v1/auth/verify-session', {
      sessionToken: sessionToken,
      appId: 'crm',
    });

    if (!response.data.valid) {
      res.clearCookie('app_session');
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Inyectar contexto en request
    req.user = response.data.user;
    req.tenant = response.data.tenant;
    req.appSession = {
      appId: response.data.appId,
      expiresAt: response.data.expiresAt,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Usar en rutas protegidas
app.get('/api/customers', authenticateApp, async (req, res) => {
  // req.user y req.tenant están disponibles
  const tenantId = req.tenant.tenantId;
  const userId = req.user.userId;

  const customers = await getCustomers(tenantId);
  res.json(customers);
});

app.post('/api/orders', authenticateApp, async (req, res) => {
  // Lógica de negocio con contexto de tenant
  const order = await createOrder(req.tenant.tenantId, req.body);
  res.json(order);
});
```

---

## 📡 Endpoints del SSO Backend

### POST /api/v1/auth/authorize

**Descripción:** Genera código de autorización para iniciar flujo SSO  
**Autenticación:** Cookie `sso_session` (usuario ya logueado en portal)

**Request:**

```json
{
  "tenantId": "tenant-uuid",
  "appId": "crm",
  "redirectUri": "https://crm.acme.com/auth/callback"
}
```

**Response:**

```json
{
  "success": true,
  "authCode": "xyz789abc...",
  "redirectUri": "https://crm.acme.com/auth/callback?code=xyz789abc..."
}
```

**Validaciones:**

- ✅ Usuario tiene acceso al tenant
- ✅ Aplicación existe y está activa
- ✅ Aplicación está habilitada para el tenant
- ✅ Usuario tiene permiso para usar esta app

---

### POST /api/v1/auth/token

**Descripción:** Intercambia authorization code por app session token  
**Autenticación:** Pública (valida el código)

**Request:**

```json
{
  "authCode": "xyz789abc...",
  "appId": "crm"
}
```

**Response:**

```json
{
  "success": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-30T12:00:00.000Z",
  "user": {
    "userId": "user-uuid",
    "email": "john@acme.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tenant": {
    "tenantId": "tenant-uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "admin"
  }
}
```

**Comportamiento:**

- ✅ Valida y marca el código como usado (one-time use)
- ✅ Crea registro en tabla `app_sessions`
- ✅ Si ya existe sesión activa, reutiliza el token
- ✅ Session expira en 24 horas por defecto

---

### POST /api/v1/auth/verify-session

**Descripción:** Valida un session token y devuelve contexto  
**Autenticación:** Pública (valida el token)

**Request:**

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "appId": "crm"
}
```

**Response (válido):**

```json
{
  "success": true,
  "valid": true,
  "user": {
    "userId": "user-uuid",
    "email": "john@acme.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tenant": {
    "tenantId": "tenant-uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "admin"
  },
  "appId": "crm",
  "expiresAt": "2026-01-30T12:00:00.000Z"
}
```

**Response (inválido):**

```json
{
  "success": true,
  "valid": false,
  "message": "Session expired"
}
```

---

## 🛠️ Middleware `authenticateApp`

### Opción 1: Usar directamente en SSO Backend

Si tu app backend está en el mismo monorepo:

```typescript
import { authenticateApp } from '@sso/middleware/appAuth';

app.get('/api/customers', authenticateApp, (req, res) => {
  // req.appSession está poblado
  console.log(req.appSession.user);
  console.log(req.appSession.tenant);
  console.log(req.appSession.role); // 'admin', 'member', 'viewer'
});
```

### Opción 2: Implementar en tu backend externo

Copia el patrón del middleware:

```typescript
// middleware/authenticateApp.js
const axios = require('axios');

async function authenticateApp(req, res, next) {
  try {
    const sessionToken =
      req.cookies?.app_session || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'No session' });
    }

    const response = await axios.post(`${process.env.SSO_API_URL}/api/v1/auth/verify-session`, {
      sessionToken,
      appId: process.env.APP_ID, // 'crm', 'admin', etc.
    });

    if (!response.data.valid) {
      res.clearCookie('app_session');
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = response.data.user;
    req.tenant = response.data.tenant;
    req.appSession = {
      appId: response.data.appId,
      role: response.data.tenant.role,
      expiresAt: response.data.expiresAt,
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = { authenticateApp };
```

---

## 🔒 Seguridad y Mejores Prácticas

### Cookies Seguras

```typescript
res.cookie('app_session', sessionToken, {
  httpOnly: true, // No accesible desde JavaScript
  secure: true, // Solo HTTPS en producción
  sameSite: 'strict', // Protección CSRF
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  domain: '.tudominio.com', // Compartir entre subdominios si necesario
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // max 100 requests por IP
});

app.post('/auth/sso-callback', authLimiter, handleSSOCallback);
```

### Manejo de Errores

```typescript
try {
  const response = await axios.post('/auth/token', data);
} catch (error) {
  if (error.response?.status === 401) {
    // Código inválido o expirado
    return res.status(401).json({ error: 'Invalid authorization code' });
  }

  if (error.response?.status === 403) {
    // Usuario no tiene acceso
    return res.status(403).json({ error: 'Access denied' });
  }

  // Error del servidor
  console.error('SSO error:', error);
  return res.status(500).json({ error: 'Authentication failed' });
}
```

### CORS para APIs Cross-Origin

```typescript
import cors from 'cors';

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // Permitir cookies
  })
);
```

---

## 📚 Ejemplo Completo: CRM Backend

```typescript
// server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SSO_API = process.env.SSO_API_URL || 'https://api-sso.tudominio.com';
const APP_ID = 'crm';

// Middleware de autenticación
async function authenticateApp(req, res, next) {
  try {
    const sessionToken = req.cookies?.app_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const response = await axios.post(`${SSO_API}/api/v1/auth/verify-session`, {
      sessionToken,
      appId: APP_ID,
    });

    if (!response.data.valid) {
      res.clearCookie('app_session');
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = response.data.user;
    req.tenant = response.data.tenant;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Endpoint de callback SSO
app.post('/auth/sso-callback', async (req, res) => {
  const { code } = req.body;

  try {
    const response = await axios.post(`${SSO_API}/api/v1/auth/token`, {
      authCode: code,
      appId: APP_ID,
    });

    res.cookie('app_session', response.data.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: response.data.user,
      tenant: response.data.tenant,
    });
  } catch (error) {
    console.error('SSO error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Endpoint de logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('app_session');
  res.json({ success: true });
});

// Rutas protegidas
app.get('/api/customers', authenticateApp, async (req, res) => {
  const customers = await getCustomersForTenant(req.tenant.tenantId);
  res.json(customers);
});

app.post('/api/orders', authenticateApp, async (req, res) => {
  const order = await createOrder({
    tenantId: req.tenant.tenantId,
    userId: req.user.userId,
    ...req.body,
  });
  res.json(order);
});

// Admin only endpoint
app.post('/api/admin/users', authenticateApp, async (req, res) => {
  if (req.tenant.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Admin logic
  const user = await createUserInTenant(req.tenant.tenantId, req.body);
  res.json(user);
});

app.listen(3001, () => {
  console.log('CRM Backend listening on port 3001');
});
```

---

## 🧪 Testing

### Test del flujo completo

```bash
# 1. Obtener SSO session (login en portal)
curl -X POST https://api-sso.tudominio.com/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acme.com",
    "password": "Password2026!"
  }' \
  -c cookies.txt

# 2. Generar authorization code
curl -X POST https://api-sso.tudominio.com/api/v1/auth/authorize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "tenantId": "tenant-uuid",
    "appId": "crm",
    "redirectUri": "https://crm.acme.com/auth/callback"
  }'

# Output: { "authCode": "xyz789..." }

# 3. Intercambiar código por session token
curl -X POST https://api-sso.tudominio.com/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "authCode": "xyz789...",
    "appId": "crm"
  }'

# Output: { "sessionToken": "jwt-here...", "user": {...}, "tenant": {...} }

# 4. Verificar session token
curl -X POST https://api-sso.tudominio.com/api/v1/auth/verify-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "jwt-here...",
    "appId": "crm"
  }'

# Output: { "valid": true, "user": {...}, "tenant": {...} }
```

---

## 📊 Diagrama de Secuencia

```
Usuario → SSO Portal → SSO Backend → App Frontend → App Backend
  │         │              │             │              │
  │ Login   │              │             │              │
  ├────────►│              │             │              │
  │         │ POST /signin │             │              │
  │         ├─────────────►│             │              │
  │         │ sso_session  │             │              │
  │         │◄─────────────┤             │              │
  │         │              │             │              │
  │ Ver apps│              │             │              │
  │◄────────┤              │             │              │
  │         │              │             │              │
  │ Click CRM              │             │              │
  ├────────►│              │             │              │
  │         │ /authorize   │             │              │
  │         ├─────────────►│             │              │
  │         │ auth_code    │             │              │
  │         │◄─────────────┤             │              │
  │         │              │             │              │
  │ Redirect con code      │             │              │
  ├─────────────────────────────────────►│              │
  │         │              │             │              │
  │         │              │             │ /sso-callback│
  │         │              │             ├─────────────►│
  │         │              │             │              │
  │         │              │ /auth/token │              │
  │         │              │◄────────────┴──────────────┤
  │         │              │ sessionToken               │
  │         │              ├───────────────────────────►│
  │         │              │             │              │
  │         │              │             │ app_session  │
  │         │              │             │  cookie      │
  │◄─────────────────────────────────────┤              │
  │ Autenticado!           │             │              │
```

---

## 🎯 Próximos Pasos

1. ✅ Implementar `/auth/sso-callback` en tu app backend
2. ✅ Copiar middleware `authenticateApp` a tu app
3. ✅ Proteger rutas con el middleware
4. ✅ Configurar cookies seguras
5. ✅ Implementar logout local (clear cookie)
6. ✅ Testing completo del flujo

---

**Versión:** 2.5.0  
**Fecha:** 29 de enero de 2026
