# Cómo las Aplicaciones Sirven con Tenants

## 🏗️ Arquitectura General: Backend + Aplicaciones

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE APLICACIÓN                          │
└─────────────────────────────────────────────────────────────────────┘

USER (en navegador)
        │
        ├─→ App Frontend (React, Vue, etc)
        │      │
        │      ├─ Autenticación: SSO Backend
        │      └─ Selecciona Tenant: dropdown
        │
        └─→ Browser Storage
              ├─ accessToken (JWT global)
              ├─ refreshToken (global)
              └─ currentTenant (tenant-specific)

                         ↓

APP BACKEND (Aplicación real)
        │
        ├─ Recibe: accessToken + tenantId
        │
        └─ Valida con: SSO Backend
              ├─ ¿Token válido?
              ├─ ¿Usuario en tenant?
              ├─ ¿Permiso para recurso?
              └─ Retorna: autorizado ✓

                         ↓

DATOS (Filtrados por Tenant)
        │
        └─ SELECT * FROM usuarios
           WHERE tenant_id = $1
```

---

## 🔐 Flujo Completo: Desde Login hasta Usar la App

### **Paso 1: Usuario Inicia Sesión en el Portal SSO**

```bash
# Frontend ejecuta
POST https://auth.company.com/api/v1/auth/signin
{
  "email": "carlos@empire.com",
  "password": "SecurePass123!"
}

Response:
{
  "user": {
    "id": "user-uuid-1",
    "email": "carlos@empire.com"
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "rt-uuid-123"
}
```

**Tokens guardados en localStorage/sessionStorage:**
```javascript
// Browser Storage
{
  "accessToken": "eyJhbGc...",      // JWT RS256
  "refreshToken": "rt-uuid-123",    // Opaque token
  "userId": "user-uuid-1",
  "email": "carlos@empire.com"
}
```

---

### **Paso 2: Frontend Obtiene Lista de Tenants**

El usuario puede estar en múltiples tenants:

```bash
# Frontend ejecuta
GET https://auth.company.com/api/v1/tenant
Authorization: Bearer eyJhbGc...

Response:
{
  "success": true,
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "admin",
      "createdAt": "2026-01-13T00:00:00Z"
    },
    {
      "id": "tenant-uuid-2",
      "name": "Startup XYZ",
      "slug": "startup-xyz",
      "role": "member",
      "createdAt": "2026-01-13T01:00:00Z"
    }
  ],
  "count": 2
}
```

**Frontend guarda:**
```javascript
{
  "currentTenant": "tenant-uuid-1",
  "currentTenantName": "Acme Corp",
  "currentTenantRole": "admin"
}
```

---

### **Paso 3: Usuario Selecciona un Tenant**

```javascript
// Frontend - Usuario hace click en dropdown
selectTenant(tenantId) {
  localStorage['currentTenant'] = tenantId;
  // Redirige a la app
  window.location.href = '/app/dashboard';
}
```

---

### **Paso 4: Frontend Navega a la Aplicación Real**

El usuario ahora accede a su aplicación (NOT el SSO backend):

```
App disponible en:
https://app.acme-corp.company.com/dashboard
o
https://app.company.com/acme-corp/dashboard
o
https://app.company.com/dashboard?tenant=acme-corp
```

Depende de la arquitectura:
- **Opción A:** Subdomain por tenant (app.acme-corp.company.com)
- **Opción B:** Path por tenant (app.company.com/acme-corp)
- **Opción C:** Query param (app.company.com?tenant=acme-corp)

---

### **Paso 5: App Backend Valida el Contexto**

Cuando frontend hace request a App Backend:

```javascript
// Frontend hace request
fetch('https://app.acme-corp.company.com/api/users', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGc...',  // Token SSO
    'X-Tenant-ID': 'tenant-uuid-1',       // Tenant seleccionado
    'X-Tenant-Role': 'admin'              // Role actual
  }
})
```

**App Backend recibe y valida:**

```typescript
// src/middleware/tenant.middleware.ts
export async function validateTenantContext(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const tenantId = req.headers['x-tenant-id'];
    
    if (!token || !tenantId) {
      return res.status(400).json({ 
        error: 'Missing token or tenant context' 
      });
    }

    // 1️⃣ Valida JWT con SSO Backend
    const userInfo = await validateTokenWithSSO(token);
    // Returns: { userId, email, exp }

    // 2️⃣ Valida membresía con SSO Backend
    const membership = await checkTenantMembershipWithSSO(
      userInfo.userId,
      tenantId,
      token  // Usa mismo token
    );
    // Returns: { role, tenantId }

    // 3️⃣ Guarda en request para handlers
    req.user = {
      userId: userInfo.userId,
      email: userInfo.email,
      tenantId: tenantId,
      role: membership.role
    };

    // 4️⃣ Filtra datos por tenant automáticamente
    req.query.tenant_id = tenantId;  // Para WHERE tenant_id = $1

    next();
  } catch (error) {
    res.status(403).json({ error: 'Unauthorized' });
  }
}
```

---

## 🏢 Opciones de Arquitectura: Cómo Servir Apps

### **Opción 1: SaaS Multi-Tenant (Recomendado)**

```
┌──────────────────────────────────────────────────┐
│ ARQUITECTURA: UNA APP SIRVE A TODOS LOS TENANTS │
└──────────────────────────────────────────────────┘

Domain: https://app.company.com

URL Pattern:
  https://app.company.com/dashboard
  https://app.company.com/users
  https://app.company.com/settings

Request:
  GET /dashboard
  Headers:
    Authorization: Bearer <token>
    X-Tenant-ID: tenant-uuid-1

Backend Logic:
  1. Valida token con SSO
  2. Valida membresía: ¿user en tenant-uuid-1?
  3. Query: SELECT * FROM datos WHERE tenant_id = 'tenant-uuid-1'
  4. Retorna solo datos de ese tenant

Storage:
  Toda BD en 1 PostgreSQL:
  ├─ Tabla datos
  │  ├─ id, tenant_id, content
  │  └─ RLS: SELECT solo WHERE tenant_id = current_tenant
  └─ Cada INSERT/UPDATE lleva tenant_id automático

Ventajas:
  ✅ 1 app, N tenants
  ✅ Actualizaciones globales
  ✅ Escalable
  ✅ Barato operacionalmente

Desventajas:
  ❌ Riesgo de data leakage si RLS falla
  ❌ Validaciones deben ser perfectas
```

**Ejemplo de implementación:**

```typescript
// src/handlers/getUsers.ts
export async function getUsersHandler(req, res) {
  const tenantId = req.user.tenantId;  // Viene de middleware

  // Query automáticamente filtrada por tenant
  const users = await db.query(
    'SELECT * FROM users WHERE tenant_id = $1',
    [tenantId]
  );

  res.json({ users });
}

// Incluso si alguien intenta:
// SELECT * FROM users  ← PostgreSQL RLS bloquea
// Error: violates row level security policy
```

---

### **Opción 2: Subdomain por Tenant**

```
┌────────────────────────────────────────────────────┐
│ ARQUITECTURA: SUBDOMINIO POR TENANT                │
└────────────────────────────────────────────────────┘

Dominios:
  https://acme-corp.app.company.com
  https://startup-xyz.app.company.com
  https://another-co.app.company.com

Cada subdominio → Mismo backend (diferente BD o BD con RLS)

Request:
  GET https://acme-corp.app.company.com/users
  Headers:
    Authorization: Bearer <token>
    # X-Tenant-ID NO NECESARIO (se extrae del hostname)

Backend:
  1. Extrae tenant del hostname: 'acme-corp'
  2. Resuelve: acme-corp → tenant-uuid-1
  3. Valida token + membresía
  4. Filtra por tenant_id = tenant-uuid-1

DNS Setup:
  *.app.company.com  → 1.2.3.4 (App Backend IP)

Ventajas:
  ✅ Separación visual clara
  ✅ Fácil de entender
  ✅ Posibilidad de hosting separado

Desventajas:
  ❌ DNS más complejo (wildcard)
  ❌ SSL/TLS: wildcard certificate
  ❌ Limitado a 63 caracteres por label
```

---

### **Opción 3: Path por Tenant**

```
┌────────────────────────────────────────────────────┐
│ ARQUITECTURA: PATH BASADO EN TENANT                │
└────────────────────────────────────────────────────┘

URLs:
  https://app.company.com/acme-corp/users
  https://app.company.com/startup-xyz/users
  https://app.company.com/another-co/users

Request:
  GET /acme-corp/users
  Headers:
    Authorization: Bearer <token>

Backend:
  1. Extrae de URL: /acme-corp/ → 'acme-corp'
  2. Resuelve: acme-corp → tenant-uuid-1
  3. Valida token + membresía
  4. Filtra por tenant_id = tenant-uuid-1

Routing (Express):
  app.get('/:slug/users', tenantMiddleware, getUsersHandler);

  function tenantMiddleware(req, res, next) {
    const slug = req.params.slug;
    const tenantId = slugToTenantId(slug);
    req.user.tenantId = tenantId;
    next();
  }

Ventajas:
  ✅ Simple de implementar
  ✅ URL legible
  ✅ Sin complejidad DNS

Desventajas:
  ❌ Más caracteres en URL
  ❌ Router más complejo
```

---

## 🔄 Flujo de Request: End-to-End

```
┌─────────────────────────────────────────────────────────────────────┐
│ EJEMPLO REAL: Carlos obtiene lista de usuarios de su tenant        │
└─────────────────────────────────────────────────────────────────────┘

1️⃣ FRONTEND INICIA
   Browser:
   ├─ localStorage['accessToken'] = 'eyJhbGc...'
   ├─ localStorage['currentTenant'] = 'tenant-uuid-1'
   └─ localStorage['currentTenantRole'] = 'admin'

2️⃣ FRONTEND HACE REQUEST
   fetch('https://app.company.com/api/users', {
     headers: {
       'Authorization': 'Bearer eyJhbGc...',
       'X-Tenant-ID': 'tenant-uuid-1'
     }
   })

3️⃣ APP BACKEND RECIBE
   GET /api/users
   Headers:
     Authorization: Bearer eyJhbGc...
     X-Tenant-ID: tenant-uuid-1

4️⃣ MIDDLEWARE 1: JWT VALIDATION
   ├─ Extrae JWT: eyJhbGc...
   ├─ Valida con SSO Backend (llamada HTTP)
   │  POST https://auth.company.com/api/v1/auth/verify
   │  { "token": "eyJhbGc..." }
   │  Response: { "userId": "user-uuid-1", "email": "carlos@..." }
   ├─ Verifica firma RS256: ✓
   └─ req.user = { userId: "user-uuid-1" }

5️⃣ MIDDLEWARE 2: TENANT VALIDATION
   ├─ Extrae X-Tenant-ID: tenant-uuid-1
   ├─ Valida membresía con SSO Backend (llamada HTTP)
   │  POST https://auth.company.com/api/v1/tenant/verify
   │  { "userId": "user-uuid-1", "tenantId": "tenant-uuid-1" }
   │  Response: { "role": "admin", "tenantId": "tenant-uuid-1" }
   ├─ Usuario NO está: error 403
   └─ req.user = { userId: "user-uuid-1", tenantId: "tenant-uuid-1", role: "admin" }

6️⃣ MIDDLEWARE 3: PERMISSION CHECK
   ├─ Acción: GET /api/users
   ├─ Valida permiso con SSO Backend (llamada HTTP)
   │  POST https://auth.company.com/api/v1/auth/can-do
   │  { "userId": "user-uuid-1", "tenantId": "tenant-uuid-1", 
   │    "resource": "users", "action": "read" }
   │  Response: { "allowed": true }
   └─ ✓ Autorizado

7️⃣ HANDLER: RETORNA DATOS
   const users = await db.query(
     'SELECT * FROM users WHERE tenant_id = $1',
     ['tenant-uuid-1']  ← Filtrado por tenant
   );
   // RLS también filtra: SELECT solo WHERE tenant_id = current_tenant

8️⃣ RESPONSE
   HTTP 200
   {
     "users": [
       { "id": "user-1", "name": "Alice", "email": "alice@..." },
       { "id": "user-2", "name": "Bob", "email": "bob@..." }
     ]
   }
   // Solo usuarios de tenant-uuid-1

9️⃣ FRONTEND ACTUALIZA UI
   Display lista de usuarios con tenant context
```

---

## 🏗️ Arquitectura Recomendada: Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USUARIO EN NAVEGADOR                                        │
└─────────────────────────────────────────────────────────────┘
              │
              ├─ App Frontend (React/Vue/Angular)
              │  ├─ Login form → SSO Backend
              │  ├─ Tenant selector → SSO Backend
              │  └─ API calls → App Backend (con X-Tenant-ID)
              │
              └─ LocalStorage
                 ├─ accessToken (JWT)
                 ├─ currentTenant
                 └─ currentTenantRole

                         ↓

┌─────────────────────────────────────────────────────────────┐
│ SSO BACKEND (Auth Service)                                  │
│ https://auth.company.com                                    │
├─────────────────────────────────────────────────────────────┤
│ Endpoints:                                                  │
│ • POST /auth/signin → JWT + RefreshToken                   │
│ • GET /tenant → List user's tenants                        │
│ • POST /tenant → Create tenant                             │
│ • POST /tenant/:id/members → Invite                        │
│ • POST /auth/verify → Validate token (for other apps)      │
│ • POST /auth/permissions → Check permissions               │
│                                                             │
│ Database:                                                   │
│ • users (global)                                            │
│ • tenants (global)                                          │
│ • tenant_members (multi-tenant mapping)                    │
│ • roles, permissions (per tenant)                          │
└─────────────────────────────────────────────────────────────┘

                         ↓

┌─────────────────────────────────────────────────────────────┐
│ APP BACKEND (Aplicación Real)                               │
│ https://app.company.com (o subdominio/path)                 │
├─────────────────────────────────────────────────────────────┤
│ Middlewares:                                                │
│ 1. tenantMiddleware                                         │
│    • Extrae tenantId (header/hostname/path)                │
│    • Valida con SSO Backend                                │
│    • Attaches req.user.tenantId                            │
│                                                             │
│ 2. permissionMiddleware                                     │
│    • Valida permisos con SSO Backend                       │
│    • Comprueba role-based access                           │
│                                                             │
│ Handlers:                                                   │
│ • Usan req.user.tenantId en queries                        │
│ • SELECT * FROM tabla WHERE tenant_id = req.user.tenantId │
│                                                             │
│ Database (una por tenant o una BD para todos):             │
│ • Si BD separada: datos ya filtrados                       │
│ • Si BD compartida: RLS + query filter                     │
└─────────────────────────────────────────────────────────────┘

                         ↓

┌─────────────────────────────────────────────────────────────┐
│ POSTGRESQL DATABASE                                         │
├─────────────────────────────────────────────────────────────┤
│ Tables (con tenant_id):                                     │
│ • users (tenant_id FK)                                      │
│ • products (tenant_id FK)                                   │
│ • orders (tenant_id FK)                                     │
│ • ...                                                       │
│                                                             │
│ RLS Policies:                                               │
│ • SELECT WHERE tenant_id = current_tenant ✓                │
│ • INSERT/UPDATE/DELETE WHERE tenant_id = current_tenant ✓  │
│                                                             │
│ Indices:                                                    │
│ • ON (tenant_id) para queries rápidas                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Implementación: Código del App Backend

### **Middleware para Tenant**

```typescript
// src/middleware/tenant.middleware.ts
import axios from 'axios';

export async function tenantMiddleware(req, res, next) {
  try {
    // 1. Extrae tenantId (diferentes estrategias)
    let tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      // Alternativa: del hostname (acme-corp.app.company.com)
      const hostname = req.get('host').split('.')[0];
      tenantId = await resolveTenantSlug(hostname);
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    // 2. Obtiene token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization' });
    }

    // 3. Valida token + membresía con SSO Backend
    const response = await axios.post(
      'https://auth.company.com/api/v1/auth/validate',
      { tenantId, token },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    // 4. Attaches a request
    req.user = {
      userId: response.data.userId,
      email: response.data.email,
      tenantId,
      role: response.data.role,
      permissions: response.data.permissions
    };

    // 5. Set for database filtering
    res.locals.tenantId = tenantId;

    next();
  } catch (error) {
    res.status(403).json({ error: 'Unauthorized' });
  }
}

// Uso:
// app.use(tenantMiddleware);
```

### **Handler Ejemplo: Obtener Usuarios**

```typescript
// src/handlers/users.handler.ts
export async function getUsersHandler(req, res) {
  try {
    const tenantId = req.user.tenantId;  // Del middleware

    // Query automáticamente filtrada por tenant
    const users = await db.query(
      `SELECT id, email, name, role 
       FROM users 
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    res.json({
      success: true,
      tenantId,
      users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Ruta
// app.get('/api/users', tenantMiddleware, getUsersHandler);
```

### **Handler: Crear Usuario en Tenant**

```typescript
export async function createUserHandler(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { email, name, role } = req.body;

    // Validaciones
    if (!email || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Valida permiso con SSO Backend
    const canCreate = await axios.post(
      'https://auth.company.com/api/v1/auth/can-do',
      {
        userId: req.user.userId,
        tenantId,
        resource: 'users',
        action: 'write'
      }
    );

    if (!canCreate.data.allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Crea usuario en BD (con tenant_id)
    const user = await db.query(
      `INSERT INTO users (tenant_id, email, name, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [tenantId, email, name, role]
    );

    res.status(201).json({
      success: true,
      user: user.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🌐 Integraciones Externas

### **Si Tienes Múltiples Apps**

Ejemplo: 3 aplicaciones que usan el mismo SSO

```
┌──────────────────────────┐
│   SSO Backend            │
│ auth.company.com         │
│ (todos autenticándose)   │
└──────────────────────────┘
         ↓↑
    ┌────┴────┬─────────────┬──────────────┐
    │          │             │              │
    ↓          ↓             ↓              ↓
┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   App 1    │ │   App 2  │ │   App 3  │ │ Admin    │
│ CRM        │ │ Marketing│ │ Analytics│ │ Panel    │
│ app1.co    │ │ app2.co  │ │ app3.co  │ │ admin.co │
└────────────┘ └──────────┘ └──────────┘ └──────────┘
    ↓              ↓             ↓             ↓
  [BD 1]        [BD 2]        [BD 3]      [BD Admin]
  CRM data      Marketing     Analytics   User mgmt

Flujo:
1. User login en SSO
2. Elige tenant
3. Click "Go to CRM" → ssignment de App 1 (app1.co)
   GET https://app1.co?token=<JWT>&tenant=<uuid>
4. App 1 valida con SSO Backend
5. Filtra datos por tenant
```

---

## ✅ Resumen: Cómo Funcionan las Apps con Tenants

| Aspecto | Descripción |
|---------|-------------|
| **Auth** | SSO Backend emite JWT global |
| **Tenant Selection** | Frontend elige tenant antes de ir a app |
| **Context Passing** | X-Tenant-ID header o hostname/path |
| **Validation** | App Backend llama SSO Backend a validar |
| **Data Filtering** | Queries WHERE tenant_id + RLS |
| **Permissions** | RBAC: role → permissions en SSO |
| **Isolation** | RLS PostgreSQL + Query filters |
| **Architecture** | SaaS multi-tenant (recomendado) |

**Resultado**: Una aplicación sirve a múltiples tenants, cada uno ve solo sus datos. Escalable y seguro.

---

**Versión**: 2.2.0  
**Contexto**: Cómo las aplicaciones usan tenants  
**Status**: ✅ Documentado completamente
