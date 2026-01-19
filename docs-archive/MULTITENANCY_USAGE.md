# Multi-Tenancy API Usage Guide

## 🎯 Flujos Prácticos: Cómo usar los Tenants

### Scenario: Carlos crea equipo en Acme Corp

---

## **Paso 1: Carlos se registra**

```bash
curl -X POST http://localhost:3567/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "carlos@empire.com",
    "password": "SecurePass123!",
    "firstName": "Carlos",
    "lastName": "Montes"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "user-uuid-1",
    "email": "carlos@empire.com"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "rt-uuid-1"
}
```

**Database State:**
- ✅ Usuario creado (global)
- ⏳ Sin tenant aún

---

## **Paso 2: Carlos crea su primer tenant (Acme Corp)**

```bash
curl -X POST http://localhost:3567/api/v1/tenant \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp"
  }'
```

**Response:**
```json
{
  "success": true,
  "tenant": {
    "id": "tenant-uuid-1",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "createdAt": "2026-01-13T00:00:00Z"
  }
}
```

**Database State:**
- ✅ Tenant creado
- ✅ Carlos es ADMIN automáticamente
- ✅ Roles por defecto: admin, member, viewer
- ✅ Permisos asignados automáticamente

---

## **Paso 3: Carlos ve sus tenants**

```bash
curl -X GET http://localhost:3567/api/v1/tenant \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response:**
```json
{
  "success": true,
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "admin",
      "createdAt": "2026-01-13T00:00:00Z"
    }
  ],
  "count": 1
}
```

---

## **Paso 4: Carlos invita a Alice como MEMBER**

```bash
curl -X POST http://localhost:3567/api/v1/tenant/tenant-uuid-1/members \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme.com",
    "role": "member"
  }'
```

**Response:**
```json
{
  "success": true,
  "member": {
    "userId": "user-uuid-2",
    "email": "alice@acme.com",
    "role": "member",
    "tenantId": "tenant-uuid-1"
  }
}
```

**Database State:**
- ✅ Usuario Alice creado (global)
- ✅ Alice agregada a tenant como MEMBER
- ✅ Alice hereda permisos de MEMBER

---

## **Paso 5: Alice se registra (primero ve el email)**

Alice recibe email de invitación y se registra:

```bash
curl -X POST http://localhost:3567/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme.com",
    "password": "AlicePass456!",
    "firstName": "Alice",
    "lastName": "Smith"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "user-uuid-2",
    "email": "alice@acme.com"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "rt-uuid-2"
}
```

**Importante**: Alice ya estaba en TenantMember desde paso 4, ahora solo completó su registro.

---

## **Paso 6: Alice ve sus tenants**

```bash
curl -X GET http://localhost:3567/api/v1/tenant \
  -H "Authorization: Bearer <alice-token>"
```

**Response:**
```json
{
  "success": true,
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "member",
      "createdAt": "2026-01-13T00:00:00Z"
    }
  ],
  "count": 1
}
```

---

## **Paso 7: Carlos ve todos los miembros**

```bash
curl -X GET http://localhost:3567/api/v1/tenant/tenant-uuid-1/members \
  -H "Authorization: Bearer <carlos-token>"
```

**Response:**
```json
{
  "success": true,
  "members": [
    {
      "userId": "user-uuid-1",
      "email": "carlos@empire.com",
      "firstName": "Carlos",
      "lastName": "Montes",
      "role": "admin",
      "joinedAt": "2026-01-13T00:00:00Z"
    },
    {
      "userId": "user-uuid-2",
      "email": "alice@acme.com",
      "firstName": "Alice",
      "lastName": "Smith",
      "role": "member",
      "joinedAt": "2026-01-13T00:05:00Z"
    }
  ],
  "count": 2
}
```

---

## **Paso 8: Carlos invita a Bob como VIEWER**

```bash
curl -X POST http://localhost:3567/api/v1/tenant/tenant-uuid-1/members \
  -H "Authorization: Bearer <carlos-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@external.com",
    "role": "viewer"
  }'
```

**Response:**
```json
{
  "success": true,
  "member": {
    "userId": "user-uuid-3",
    "email": "bob@external.com",
    "role": "viewer",
    "tenantId": "tenant-uuid-1"
  }
}
```

---

## **Paso 9: Carlos actualiza rol de Alice a ADMIN**

```bash
curl -X PUT http://localhost:3567/api/v1/tenant/tenant-uuid-1/members/user-uuid-2 \
  -H "Authorization: Bearer <carlos-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

**Response:**
```json
{
  "success": true,
  "member": {
    "userId": "user-uuid-2",
    "tenantId": "tenant-uuid-1",
    "role": "admin"
  }
}
```

---

## **Paso 10: Carlos intenta remover a Alice (pero falla)**

Alice es admin, hay 2 admins:

```bash
curl -X DELETE http://localhost:3567/api/v1/tenant/tenant-uuid-1/members/user-uuid-2 \
  -H "Authorization: Bearer <carlos-token>"
```

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cannot remove the last admin from tenant",
    "statusCode": 400
  }
}
```

**Protección**: No puedes dejar un tenant sin admins.

---

## **Paso 11: Carlos puede remover a Bob (viewer)**

```bash
curl -X DELETE http://localhost:3567/api/v1/tenant/tenant-uuid-1/members/user-uuid-3 \
  -H "Authorization: Bearer <carlos-token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Member removed from tenant"
}
```

---

## **Paso 12: Alice intenta invitar a alguien (como admin)**

Alice ahora es admin, puede invitar:

```bash
curl -X POST http://localhost:3567/api/v1/tenant/tenant-uuid-1/members \
  -H "Authorization: Bearer <alice-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "charlie@acme.com",
    "role": "member"
  }'
```

**Response:**
```json
{
  "success": true,
  "member": {
    "userId": "user-uuid-4",
    "email": "charlie@acme.com",
    "role": "member",
    "tenantId": "tenant-uuid-1"
  }
}
```

---

## 🔒 Controles de Acceso

### Operación: Invitar Usuario

```
REQUIERE: Admin role
VERIFICA:
  1. User está autenticado (JWT válido)
  2. User pertenece al tenant
  3. User tiene role = admin
RESULTADO:
  ✅ Si todo OK: agrega usuario
  ❌ Si no: 403 Forbidden
```

### Operación: Cambiar Rol

```
REQUIERE: Admin role
VERIFICA:
  1. User está autenticado
  2. User es admin del tenant
  3. No removiendo último admin
RESULTADO:
  ✅ Si todo OK: actualiza rol
  ❌ Si no: 400/403 error
```

### Operación: Remover Usuario

```
REQUIERE: Admin role
VERIFICA:
  1. User está autenticado
  2. User es admin del tenant
  3. Target user no es último admin
RESULTADO:
  ✅ Si todo OK: elimina membership
  ❌ Si no: 400/403 error
```

---

## 🗺️ Tabla de Permisos por Rol

### ADMIN
```json
{
  "users": ["read", "write", "delete"],
  "billing": ["read", "write"],
  "settings": ["read", "write"],
  "profiles": ["read", "write", "delete"]
}
```

### MEMBER
```json
{
  "users": ["read"],
  "profile": ["read", "write"],
  "billing": ["read"]
}
```

### VIEWER
```json
{
  "users": ["read"],
  "billing": ["read"]
}
```

---

## 🚀 Advanced: Multi-Tenant Request Header

### Con Tenant Context

Para todas las requests que necesitan un tenant específico:

```bash
curl -X GET http://localhost:3567/api/v1/users \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: tenant-uuid-1"
```

Así el backend sabe con qué tenant trabajar.

### Sin Header

```bash
curl -X GET http://localhost:3567/api/v1/tenant \
  -H "Authorization: Bearer <token>"
```

Retorna lista de tenants del usuario (no requiere X-Tenant-ID).

---

## ⚠️ Errores Comunes

### 1. "Cannot remove the last admin from tenant"
```
Causa: Intentas remover el único admin
Solución: Primero promueve otro usuario a admin
```

### 2. "Only admins can invite members"
```
Causa: No eres admin del tenant
Solución: Pídele a un admin que te promueva
```

### 3. "User is already a member of this tenant"
```
Causa: Usuario ya está en el tenant
Solución: Usa PUT para cambiar su rol
```

### 4. "Tenant access denied"
```
Causa: No eres miembro del tenant
Solución: Espera a que un admin te invite
```

---

## 📊 Relación: Usuarios a Tenants (Many-to-Many)

```
Usuario: carlos@empire.com
├─ Tenant A (ADMIN)
├─ Tenant B (MEMBER)
└─ Tenant C (VIEWER)

Usuario: alice@acme.com
├─ Tenant A (MEMBER)
└─ Tenant D (ADMIN)

Usuario: bob@external.com
└─ Tenant A (VIEWER)
```

Cada usuario puede:
- Estar en múltiples tenants ✓
- Tener diferentes roles por tenant ✓
- Ser invited a otros tenants ✓

---

## 🎓 Flujo Completo: Onboarding de Equipo

```
┌─────────────────────────────────────────────────────┐
│ 1. FOUNDER: Registra + crea Tenant                  │
├─────────────────────────────────────────────────────┤
│ carlos@empire.com → Signup → Crea acme-corp        │
│ carlos es ADMIN del tenant automáticamente           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 2. FOUNDER: Invita a equipo (sin registrarse aún)   │
├─────────────────────────────────────────────────────┤
│ carlos invita alice@acme.com como MEMBER            │
│ carlos invita bob@acme.com como MEMBER              │
│ Sistema envía emails de invitación                  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 3. TEAM MEMBERS: Se registran (aceptan invitación)  │
├─────────────────────────────────────────────────────┤
│ alice@acme.com → Signup con email verificado       │
│ bob@acme.com → Signup                              │
│ Automáticamente en tenant como MEMBER              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 4. FOUNDER: Gestiona roles y acceso                 │
├─────────────────────────────────────────────────────┤
│ carlos promociona alice a ADMIN (confianza)        │
│ carlos invita viewer@acme.com como VIEWER (audit)   │
│ Cada role ve/hace solo lo que le corresponde       │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad: 3-Layer Validation

**Cada request con tenantId va por:**

```
1. JWT Validation
   ✓ Token válido?
   ✓ No expirado?

2. Tenant Membership
   ✓ Usuario en tenant?
   ✓ Qué rol tiene?

3. Permission Check
   ✓ Rol tiene permiso?
   ✓ Recurso + Acción?

Si cualquier capa falla → 403 Forbidden
```

---

**Versión**: 2.1.0  
**Actualizado**: 13 de enero de 2026  
**Status**: ✅ Completamente implementado
