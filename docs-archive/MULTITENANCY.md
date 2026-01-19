# Multi-Tenancy Architecture

## 🏗️ Estructura Relacional Completa

### Diagrama: Cómo todo se relaciona con Tenants

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT HIERARCHY                             │
└─────────────────────────────────────────────────────────────────┘

                          Tenant (empresa/workspace)
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
            TenantMembers    Roles        (future: services)
                  │              │
              ┌───┘              │
              │                  │
            User             Permissions
              │
    ┌─────────┼─────────┐
    │         │         │
RefreshTokens OTPSecret EmailVerifications
    │         │         │
   (session) (2FA)   (verification)
```

### Relaciones Detalladas

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. USER → TENANT (Many-to-Many via TenantMember)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User (global)                                                         │
│    ├─ id: UUID                                                         │
│    ├─ email: STRING (UNIQUE across all tenants)                        │
│    ├─ passwordHash: STRING (shared across all tenants)                 │
│    └─ tenantMembers: TenantMember[]                                    │
│         │                                                             │
│         └─ TenantMember (tenant-specific)                             │
│              ├─ userId: UUID → User.id                               │
│              ├─ tenantId: UUID → Tenant.id                           │
│              ├─ role: STRING (admin, member, viewer)                 │
│              ├─ createdAt: DateTime                                  │
│              └─ CONSTRAINT: UNIQUE(tenantId, userId)                 │
│                 (un usuario solo puede tener un rol por tenant)      │
│                                                                     │
│  Ejemplos:                                                          │
│  • user@example.com está en 3 tenants                               │
│  • carlos@empire.com es ADMIN en TenantA                            │
│  • carlos@empire.com es MEMBER en TenantB                           │
│  • carlos@empire.com es VIEWER en TenantC                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 2. TENANT → ROLES → PERMISSIONS (One-to-Many)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Tenant                                                               │
│    ├─ id: UUID                                                       │
│    ├─ name: STRING (UNIQUE)                                          │
│    ├─ slug: STRING (UNIQUE)                                          │
│    └─ roles: Role[]                                                  │
│         │                                                           │
│         └─ Role (tenant-scoped)                                     │
│              ├─ id: UUID                                           │
│              ├─ tenantId: UUID → Tenant.id                         │
│              ├─ name: STRING (admin, member, viewer)               │
│              ├─ permissions: Permission[]                          │
│              └─ CONSTRAINT: UNIQUE(tenantId, name)                 │
│                 (cada tenant define sus propios roles)              │
│                                                                   │
│                  └─ Permission (role-scoped)                       │
│                       ├─ id: UUID                                 │
│                       ├─ roleId: UUID → Role.id                   │
│                       ├─ resource: STRING (users, billing, etc)   │
│                       ├─ action: STRING (read, write, delete)     │
│                       └─ CONSTRAINT: UNIQUE(roleId, resource, action)
│                          (no permisos duplicados por role)         │
│                                                                   │
│  Ejemplo: Tenant "acme-corp"                                      │
│  ├─ Role: admin                                                   │
│  │  ├─ Permission: users:read                                    │
│  │  ├─ Permission: users:write                                   │
│  │  ├─ Permission: billing:read                                  │
│  │  └─ Permission: billing:write                                 │
│  ├─ Role: member                                                 │
│  │  ├─ Permission: users:read                                    │
│  │  └─ Permission: profile:write                                 │
│  └─ Role: viewer                                                 │
│     └─ Permission: users:read                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 3. USER → SESSION (RefreshToken) - Tenant-agnostic                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User (global auth)                                                   │
│    └─ refreshTokens: RefreshToken[]                                   │
│         │                                                            │
│         └─ RefreshToken                                              │
│              ├─ userId: UUID → User.id                              │
│              ├─ tokenHash: STRING (UNIQUE)                           │
│              ├─ expiresAt: DateTime                                  │
│              ├─ revoked: Boolean                                     │
│              ├─ previousTokenId: UUID (para token rotation)          │
│              ├─ ip: STRING (auditoría)                               │
│              └─ userAgent: STRING (auditoría)                        │
│                                                                     │
│  ⚠️  IMPORTANTE: RefreshToken NO está asociado a un tenant           │
│      El usuario se autentica GLOBALMENTE, luego la aplicación      │
│      frontend selecciona con qué tenant trabajar                    │
│                                                                     │
│  Flujo:                                                             │
│  1. User signup/signin → RefreshToken (global)                     │
│  2. Frontend: "estoy autenticado como carlos@empire.com"           │
│  3. Frontend selecciona TenantA                                    │
│  4. Frontend envía request con token + tenantId                   │
│  5. Backend: valida token + verifica membership en tenantId       │
│  6. Backend: filtra datos según tenantId (RLS)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 4. USER → 2FA & VERIFICATION (OTPSecret, EmailVerification)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User (global)                                                         │
│    ├─ otpSecret: OTPSecret?                                           │
│    │   ├─ userId: UUID (UNIQUE) → User.id                            │
│    │   ├─ secret: STRING (seed TOTP)                                 │
│    │   ├─ verified: Boolean                                          │
│    │   └─ backupCodes: String[] (10 códigos de recuperación)         │
│    │       (válidos para TODOS los tenants)                          │
│    │                                                                 │
│    └─ emailVerifications: EmailVerification[]                        │
│        ├─ userId: UUID → User.id                                    │
│        ├─ token: STRING (UNIQUE, one-time use)                      │
│        ├─ email: STRING (a verificar)                               │
│        ├─ verified: Boolean                                         │
│        └─ expiresAt: DateTime (24 horas)                            │
│                                                                     │
│  ⚠️  IMPORTANTE: 2FA es a nivel USUARIO global                       │
│      Si user@example.com habilita TOTP:                             │
│      - Debe completar TOTP para TODOS los tenants                  │
│      - O sin MFA por defecto (decide frontend)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 PostgreSQL RLS (Row Level Security) por Tenant

### Políticas RLS Implementadas

```sql
-- 1. Users: No RLS (tabla global)
-- Cada usuario ve/modifica solo su propio registro

-- 2. Tenant Members: Filtra por tenant_id
-- SELECT * FROM tenant_members
-- WHERE tenant_id = current_user_tenant_id
-- AND (user_id = current_user_id OR is_admin)

-- 3. Roles: Filtra por tenant_id
-- SELECT * FROM roles
-- WHERE tenant_id = current_user_tenant_id
-- AND user_is_member_of_tenant(tenant_id)

-- 4. Permissions: Filtra vía role → tenant
-- SELECT p.* FROM permissions p
-- JOIN roles r ON p.role_id = r.id
-- WHERE r.tenant_id = current_user_tenant_id

-- 5. OTP Secrets: No RLS (global por usuario)
-- OTP es global, se hereda a todos los tenants

-- 6. Email Verifications: No RLS (global)
-- Email es global (solo 1 email por usuario)
```

---

## 🔄 Flujo de Autenticación y Tenant Selection

### Step-by-Step: Usuario Multitenancy

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCENARIO: carlos@empire.com trabaja en 3 tenants                   │
│          - acme-corp (ADMIN)                                        │
│          - startup-xyz (MEMBER)                                     │
│          - another-co (VIEWER)                                      │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: SIGNUP
┌─────────────────────────────────────────────────────────────────────┐
POST /api/v1/auth/signup
{
  "email": "carlos@empire.com",
  "password": "SecurePass123!",
  "firstName": "Carlos",
  "lastName": "Montes"
}

Response:
{
  "user": { "id": "user-uuid", "email": "carlos@empire.com" },
  "accessToken": "eyJhbGc...",
  "refreshToken": "rt-uuid"
}

Database State:
├─ users
│  └─ id: user-uuid, email: carlos@empire.com, passwordHash: $argon2...
├─ refresh_tokens
│  └─ id: rt-uuid, userId: user-uuid, tokenHash: hash(rt-uuid), expiresAt: +30d
└─ tenant_members: (vacío - usuario no pertenece a ningún tenant aún)
└─────────────────────────────────────────────────────────────────────┘

STEP 2: USUARIO CREA/SE UNE A PRIMER TENANT
┌─────────────────────────────────────────────────────────────────────┐
POST /api/v1/tenant
{
  "name": "acme-corp",
  "slug": "acme-corp"
}

Response:
{
  "tenant": { "id": "tenant-1-uuid", "name": "acme-corp", "slug": "acme-corp" }
}

Database State:
├─ tenants
│  └─ id: tenant-1-uuid, name: acme-corp, slug: acme-corp
├─ tenant_members
│  └─ id: tm-uuid, tenantId: tenant-1-uuid, userId: user-uuid, role: admin
└─ roles (creados automáticamente por tenant)
   ├─ id: role-admin-uuid, tenantId: tenant-1-uuid, name: admin
   ├─ id: role-member-uuid, tenantId: tenant-1-uuid, name: member
   └─ id: role-viewer-uuid, tenantId: tenant-1-uuid, name: viewer
└─────────────────────────────────────────────────────────────────────┘

STEP 3: USUARIO INVITA A COLEGA A MISMO TENANT
┌─────────────────────────────────────────────────────────────────────┐
POST /api/v1/tenant/acme-corp/members
{
  "email": "alice@acme.com",
  "role": "member"
}

Backend:
1. Valida que carlos es ADMIN de acme-corp ✓
2. Crea/obtiene usuario alice@acme.com
3. Agrega alice a tenant_members con role: member
4. Envía email de invitación

Database State:
├─ users
│  ├─ id: user-uuid, email: carlos@empire.com
│  └─ id: alice-uuid, email: alice@acme.com
├─ tenant_members
│  ├─ tenantId: tenant-1-uuid, userId: user-uuid, role: admin
│  └─ tenantId: tenant-1-uuid, userId: alice-uuid, role: member
└─────────────────────────────────────────────────────────────────────┘

STEP 4: USUARIO SE UNE A SEGUNDO TENANT
┌─────────────────────────────────────────────────────────────────────┐
POST /api/v1/tenant/join
{
  "tenantId": "tenant-2-uuid"  // invitación previa
}

Database State:
├─ tenant_members
│  ├─ tenantId: tenant-1-uuid, userId: user-uuid, role: admin     ← acme-corp
│  ├─ tenantId: tenant-2-uuid, userId: user-uuid, role: member    ← startup-xyz (NUEVO)
│  └─ tenantId: tenant-3-uuid, userId: user-uuid, role: viewer    ← another-co
└─────────────────────────────────────────────────────────────────────┘

STEP 5: FRONTEND SELECCIONA TENANT Y HACE REQUEST
┌─────────────────────────────────────────────────────────────────────┐
Frontend:
1. carlos@empire.com inicia sesión
2. Frontend recibe accessToken
3. Frontend query: GET /api/v1/user/tenants?userId=user-uuid
4. Backend retorna lista: [acme-corp, startup-xyz, another-co]
5. Usuario selecciona "acme-corp"
6. Frontend almacena: localStorage['currentTenant'] = 'tenant-1-uuid'

Siguientes requests van con:
GET /api/v1/users?tenantId=tenant-1-uuid
Authorization: Bearer accessToken
X-Tenant-ID: tenant-1-uuid  ← nuevo header

Request llega al backend:
├─ Valida JWT: ✓ accessToken válido
├─ Extrae tenantId del header: tenant-1-uuid
├─ Valida membresía: ¿user-uuid está en tenant-1-uuid? ✓ SÍ
├─ Carga context: { userId, tenantId, role: admin }
└─ Ejecuta query con filtro tenant_id = tenant-1-uuid
   (RLS políticas aplican automáticamente)

Response:
{
  "users": [
    { "id": user-uuid, "email": "carlos@empire.com", "role": "admin" },
    { "id": alice-uuid, "email": "alice@acme.com", "role": "member" }
  ]
}

⚠️  carlos solo ve a alice porque AMBOS están en tenant-1-uuid
Si carlos solicita usuarios de tenant-2-uuid donde es MEMBER:
├─ Backend valida: tenantId=tenant-2-uuid, role=member ✓
├─ Ejecuta query con filtro tenant_id = tenant-2-uuid
└─ Retorna usuarios de OTRO tenant (no ve alice si no está en tenant-2)
└─────────────────────────────────────────────────────────────────────┘

STEP 6: CAMBIO DE TENANT (MISMO USUARIO)
┌─────────────────────────────────────────────────────────────────────┐
Frontend cambia currentTenant a tenant-2-uuid

GET /api/v1/users?tenantId=tenant-2-uuid (ahora es startup-xyz)

Backend:
├─ Valida JWT: ✓
├─ Valida membresía: ¿user-uuid en tenant-2-uuid? ✓ SÍ (como MEMBER)
├─ RLS aplica: SELECT * WHERE tenant_id = tenant-2-uuid AND role=member
└─ Retorna datos filtrados por tenant-2

⚠️  carlos ve MENOS datos porque es MEMBER, no ADMIN
Si intenta: DELETE /api/v1/users/alice-uuid?tenantId=tenant-2-uuid

Backend:
├─ Valida membresía: ✓ carlos en tenant-2-uuid
├─ Valida permisos: role=member, action=delete ❌ NO TIENE PERMISO
└─ Error: 403 Forbidden "Insufficient permissions"
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Seguridad: 3 Capas de Validación

```
REQUEST LLEGADA:
POST /api/v1/users?tenantId=tenant-1-uuid
Authorization: Bearer accessToken

┌──────────────────────────────────────────────────────────────────┐
│ CAPA 1: JWT VALIDATION                                           │
├──────────────────────────────────────────────────────────────────┤
│ ✓ JWT válido (RS256 signature)                                   │
│ ✓ No expirado                                                    │
│ ✓ Extrae: userId, iat, exp                                       │
│                                                                  │
│ Si falla: 401 Unauthorized                                       │
└──────────────────────────────────────────────────────────────────┘

                              ↓

┌──────────────────────────────────────────────────────────────────┐
│ CAPA 2: TENANT MEMBERSHIP                                        │
├──────────────────────────────────────────────────────────────────┤
│ Query: SELECT * FROM tenant_members                              │
│        WHERE userId = ? AND tenantId = ?                         │
│                                                                  │
│ ✓ Usuario pertenece al tenant                                    │
│ ✓ Carga role: admin/member/viewer                                │
│                                                                  │
│ Si falla: 403 Forbidden "Tenant access denied"                   │
└──────────────────────────────────────────────────────────────────┘

                              ↓

┌──────────────────────────────────────────────────────────────────┐
│ CAPA 3: ROLE-BASED PERMISSIONS                                   │
├──────────────────────────────────────────────────────────────────┤
│ Query: SELECT * FROM permissions                                 │
│        JOIN roles ON permissions.roleId = roles.id               │
│        WHERE roles.tenantId = ? AND role = ?                     │
│              AND resource = ? AND action = ?                     │
│                                                                  │
│ Ejemplo:                                                         │
│ resource = "users", action = "read"                              │
│ Si role = admin: ✓ PERMITIDO                                     │
│ Si role = member: ✓ PERMITIDO (según config)                     │
│ Si role = viewer: ✗ DENEGADO                                     │
│                                                                  │
│ Si falla: 403 Forbidden "Insufficient permissions"               │
└──────────────────────────────────────────────────────────────────┘

                              ↓

┌──────────────────────────────────────────────────────────────────┐
│ CAPA 4: DATABASE RLS (PostgreSQL - Última línea de defensa)      │
├──────────────────────────────────────────────────────────────────┤
│ SELECT * FROM users                                              │
│ WHERE tenant_id = current_setting('app.tenant_id')               │
│ AND (user_id = current_user_id OR is_admin)                      │
│                                                                  │
│ Incluso si bypassean CAPAS 2-3, DB RLS filtra automáticamente   │
│                                                                  │
│ Si tenant_id no coincide: PostgreSQL retorna cero filas           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Casos de Uso Prácticos

### Caso 1: SaaS Multi-Empresa
```
Tenant = Workspace/Company
├─ CompanyA (500 usuarios)
│  ├─ Roles: admin (5), manager (20), viewer (475)
│  └─ Datos: 500GB
├─ CompanyB (100 usuarios)
│  ├─ Roles: admin (2), member (98)
│  └─ Datos: 50GB
└─ CompanyC (50 usuarios)
   ├─ Roles: admin (1), viewer (49)
   └─ Datos: 10GB

Total: 650 usuarios en 1 base de datos
Aislamientos: Automático vía RLS + tenant_id
```

### Caso 2: Agencia con Múltiples Clientes
```
Tenant = Cliente/Proyecto
├─ BrandX (estamos desarrollando su app)
│  ├─ Team de BrandX: 10 usuarios
│  └─ Datos de BrandX: datos cliente
├─ BrandY (otro cliente)
│  ├─ Team de BrandY: 5 usuarios
│  └─ Datos de BrandY: datos cliente
└─ Agency Staff (nuestro equipo)
   ├─ Super admin: 2 usuarios (acceso a todos)
   └─ Account managers: 5 usuarios (acceso parcial)

Implementación:
├─ Staff crea TenantBrandX, invita equipo de BrandX
├─ Staff crea TenantBrandY, invita equipo de BrandY
├─ Staff los superadmins aparecen en ambos tenants
└─ RLS: cada equipo solo ve sus datos
```

### Caso 3: Equipos Internos Organizacionales
```
Tenant = Departamento/Team
├─ Engineering (50 devs)
│  ├─ Frontend team
│  ├─ Backend team
│  └─ DevOps team
├─ Sales (30 reps)
│  ├─ LATAM region
│  └─ EMEA region
└─ Finance (10 staff)

Flujo:
└─ Cada dev es miembro de 1-3 tenants (su team + org-wide)
└─ Cada role tiene permisos diferentes (dev ≠ sales ≠ finance)
```

---

## 🔧 Implementación: Backend Code

### Middleware: Extract Tenant Context

```typescript
// src/middleware/auth.ts
export interface TenantContext {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: { userId: string };
  tenant?: TenantContext;
}

export const tenantMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      throw new AppError(400, 'Missing tenantId or userId', 'INVALID_REQUEST');
    }

    // Valida membresía
    const membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      include: { tenant: true },
    });

    if (!membership) {
      throw new AppError(403, 'Tenant access denied', 'FORBIDDEN');
    }

    // Carga permisos del rol
    const rolePerms = await prisma.permission.findMany({
      where: {
        role: { tenantId, name: membership.role },
      },
    });

    req.tenant = {
      userId,
      tenantId,
      role: membership.role,
      permissions: rolePerms.map(p => `${p.resource}:${p.action}`),
    };

    next();
  } catch (error) {
    next(error);
  }
};
```

### Service: Multi-Tenant Query

```typescript
// src/services/user.ts
export async function getUsersByTenant(tenantId: string): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      tenantMembers: {
        some: { tenantId },
      },
    },
    include: {
      tenantMembers: {
        where: { tenantId },
        include: { tenant: true },
      },
    },
  });
}

export async function createTenantUser(
  tenantId: string,
  email: string,
  role: string
): Promise<TenantMember> {
  // 1. Obtiene o crea usuario global
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: '', firstName: '' },
  });

  // 2. Agrega a tenant
  return prisma.tenantMember.create({
    data: {
      tenantId,
      userId: user.id,
      role,
    },
    include: { user: true },
  });
}
```

---

## 🎯 Diagrama Final: Todo junto

```
FRONTEND
   ├─ Usuario: carlos@empire.com
   ├─ Access Token: JWT RS256
   ├─ Current Tenant: acme-corp (tenant-1-uuid)
   └─ Role: admin

           ↓ (con headers)

┌────────────────────────────────────────────────┐
│ GET /api/v1/users                              │
│ Authorization: Bearer <jwt>                    │
│ X-Tenant-ID: tenant-1-uuid                     │
└────────────────────────────────────────────────┘

           ↓

BACKEND
   ├─ authMiddleware: valida JWT ✓
   ├─ tenantMiddleware: valida membership ✓
   ├─ permissionMiddleware: valida role ✓
   └─ route handler: executa query

           ↓

DATABASE (PostgreSQL con RLS)
   ├─ Executa: SELECT * FROM users
   │           WHERE id IN (
   │             SELECT userId FROM tenant_members
   │             WHERE tenantId = $1
   │           )
   ├─ RLS Policy: tenant_id = current_setting('app.tenant_id')
   └─ Retorna: usuarios de acme-corp únicamente

           ↓

RESPONSE
{
  "users": [
    { "id": "user-uuid", "email": "carlos@empire.com", "role": "admin" },
    { "id": "alice-uuid", "email": "alice@acme.com", "role": "member" },
    ...
  ]
}
```

---

**Versión**: 2.1.0  
**Contexto**: Multi-Tenancy Architecture for SSO Backend  
**Status**: ✅ Diseño completado, implementación lista para coding
