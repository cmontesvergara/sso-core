---
title: "API Reference"
---

# API Reference

Referencia completa de todos los endpoints del SSO Core. Todos los endpoints usan el prefijo `/api/v1`.

> [!NOTE]
> Los endpoints protegidos requieren una cookie `sso_session` válida (autenticación SSO) o un header `Authorization: Bearer <token>` (autenticación legacy). Se indica el tipo de autenticación requerida en cada endpoint.

---

## Autenticación (`/auth`)

### POST `/auth/signup`

Registrar un nuevo usuario.

**Rate limit:** 5 peticiones por hora.

**Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "Juan",
  "lastName": "Pérez"
}
```

**Respuesta (201):**

```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "userId": "uuid",
    "email": "user@example.com"
  }
}
```

---

### POST `/auth/signin`

Iniciar sesión. Establece una cookie `sso_session` HttpOnly.

**Rate limit:** 10 peticiones por 15 minutos.

**Body:**

```json
{
  "nuid": "user@example.com",
  "password": "SecurePass123!"
}
```

**Respuesta (200) — Login normal:**

```json
{
  "success": true,
  "message": "Sign in successful",
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "systemRole": "user"
  }
}
```

**Respuesta (200) — 2FA requerido:**

```json
{
  "success": true,
  "message": "Two-factor authentication required",
  "requiresTwoFactor": true,
  "tempToken": "jwt-temporal"
}
```

> [!IMPORTANT]
> La cookie `sso_session` se establece automáticamente con las opciones: `httpOnly: true`, `sameSite: lax`, `secure` solo en producción. El dominio de cookie se configura con `COOKIE_DOMAIN` en producción.

---

### POST `/auth/signout`

Cerrar sesión (basado en refresh token legacy).

**Body:**

```json
{
  "refreshToken": "token-string"
}
```

---

### POST `/auth/logout`

Cerrar sesión SSO (basado en cookie). Destruye la sesión y limpia la cookie `sso_session`.

**Requires:** Cookie `sso_session`.

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST `/auth/refresh`

Renovar tokens de acceso.

**Rate limit:** 30 peticiones por minuto.

**Body:**

```json
{
  "refreshToken": "current-refresh-token"
}
```

**Respuesta (200):**

```json
{
  "success": true,
  "accessToken": "new-jwt",
  "refreshToken": "new-refresh-token",
  "expiresIn": 3600
}
```

---

### POST `/auth/authorize`

Generar un authorization code para el flujo SSO. Usado cuando una aplicación redirige al portal SSO para autenticar.

**Requires:** Cookie `sso_session`.

**Body:**

```json
{
  "tenantId": "uuid-del-tenant",
  "appId": "crm",
  "redirectUri": "https://crm.empire.com/callback"
}
```

**Respuesta (200):**

```json
{
  "success": true,
  "authCode": "code-one-time-use",
  "redirectUri": "https://crm.empire.com/callback?code=code-one-time-use"
}
```

**Validaciones:**
- El usuario debe ser miembro del tenant.
- La aplicación debe existir y estar activa.
- La aplicación debe estar habilitada para el tenant.
- El usuario debe tener acceso a la aplicación en ese tenant.

---

### POST `/auth/validate-code`

Validar un authorization code y obtener el contexto del usuario. Llamado por backends de aplicaciones (no por frontends).

**Body:**

```json
{
  "authCode": "code-from-query-param",
  "appId": "crm"
}
```

**Respuesta (200):**

```json
{
  "success": true,
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "isActive": true
  },
  "tenant": {
    "tenantId": "uuid",
    "role": "admin"
  }
}
```

> [!WARNING]
> El código es **de un solo uso** y expira en 5 minutos. Reutilizarlo genera un error.

---

### POST `/auth/token`

Intercambiar un authorization code por un token de sesión de aplicación. Similar a un token endpoint de OAuth2.

**Body:**

```json
{
  "authCode": "code-from-authorize",
  "appId": "crm"
}
```

**Respuesta (200):**

```json
{
  "success": true,
  "sessionToken": "jwt-session-token",
  "expiresAt": "2026-02-13T19:00:00.000Z",
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  },
  "tenant": {
    "tenantId": "uuid",
    "name": "Mi Empresa",
    "slug": "mi-empresa",
    "role": "admin"
  }
}
```

---

### POST `/auth/verify-session`

Verificar un token de sesión de aplicación. Llamado por backends de apps en cada request para validar la sesión.

**Body:**

```json
{
  "sessionToken": "jwt-from-app-session-cookie",
  "appId": "crm"
}
```

**Respuesta (200) — Sesión válida:**

```json
{
  "success": true,
  "valid": true,
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  },
  "tenant": {
    "tenantId": "uuid",
    "name": "Mi Empresa",
    "slug": "mi-empresa",
    "role": "admin"
  },
  "appId": "crm",
  "expiresAt": "2026-02-13T19:00:00.000Z"
}
```

**Respuesta (200) — Sesión inválida:**

```json
{
  "success": true,
  "valid": false,
  "message": "Session expired"
}
```

---

## Usuarios (`/user`)

### GET `/user/profile`

Obtener el perfil del usuario autenticado vía SSO.

**Requires:** Cookie `sso_session`.

**Respuesta (200):**

```json
{
  "success": true,
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "secondName": null,
    "lastName": "Pérez",
    "secondLastName": null,
    "phone": "+1234567890",
    "birthDate": null,
    "gender": null,
    "nationality": null,
    "systemRole": "user",
    "addresses": [
      {
        "id": "uuid",
        "country": "CR",
        "province": "San José",
        "city": "Central",
        "detail": "Calle 1",
        "postalCode": "10101"
      }
    ]
  }
}
```

---

### PUT `/user/profile`

Actualizar el perfil del usuario autenticado. Soporta actualización de datos personales y direcciones.

**Requires:** Cookie `sso_session`.

**Body:**

```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+1234567890",
  "nationality": "CR",
  "addresses": [
    {
      "country": "CR",
      "province": "San José",
      "city": "Central",
      "detail": "Calle 2",
      "postalCode": "10101"
    }
  ]
}
```

---

### GET `/user/tenants`

Obtener todos los tenants del usuario con sus aplicaciones habilitadas.

**Requires:** Cookie `sso_session`.

**Respuesta (200):**

```json
{
  "success": true,
  "tenants": [
    {
      "tenantId": "uuid",
      "name": "Mi Empresa",
      "slug": "mi-empresa",
      "role": "admin",
      "apps": [
        { "appId": "crm", "name": "CRM", "url": "https://crm.empire.com" },
        { "appId": "admin", "name": "Admin Panel", "url": "https://admin.empire.com" }
      ]
    }
  ]
}
```

---

### GET `/user/:userId`

Obtener usuario por ID. **Requires:** Bearer token.

### PUT `/user/:userId`

Actualizar usuario por ID. **Requires:** Bearer token.

### DELETE `/user/:userId`

Eliminar usuario. **Requires:** Bearer token.

---

## Tenants (`/tenant`)

### POST `/tenant`

Crear un nuevo tenant. **Requires:** Cookie `sso_session` + System Admin.

**Body:**

```json
{
  "name": "Mi Empresa",
  "slug": "mi-empresa",
  "adminEmail": "admin@miempresa.com"
}
```

---

### GET `/tenant`

Listar tenants. System Admins ven todos. Usuarios regulares ven solo los suyos.

**Requires:** Cookie `sso_session`.

---

### POST `/tenant/:tenantId/members`

Invitar un usuario al tenant.

**Requires:** Cookie `sso_session` + Tenant Admin.

**Body:**

```json
{
  "email": "nuevo@example.com",
  "role": "member"
}
```

> [!NOTE]
> Los roles válidos para invitación son: `admin`, `member`, `viewer`.

---

### GET `/tenant/:tenantId/members`

Listar miembros del tenant. **Requires:** Cookie `sso_session` + Tenant Member.

---

### PUT `/tenant/:tenantId/members/:memberId`

Cambiar rol de un miembro. **Requires:** Cookie `sso_session` + Tenant Admin.

### DELETE `/tenant/:tenantId/members/:memberId`

Eliminar miembro del tenant. **Requires:** Cookie `sso_session` + Tenant Admin.

---

### GET `/tenant/:tenantId/apps`

Listar aplicaciones asignadas al tenant. **Requires:** Cookie `sso_session` + Tenant Member.

### DELETE `/tenant/:tenantId/apps/:applicationId`

Eliminar app del tenant. **Requires:** Cookie `sso_session` + System Admin.

---

## Roles (`/role`)

### POST `/role`

Crear un rol personalizado.

**Requires:** Cookie `sso_session`.

**Body:**

```json
{
  "name": "editor",
  "description": "Puede editar contenido",
  "tenantId": "uuid-del-tenant"
}
```

---

### GET `/role/tenant/:tenantId`

Listar roles de un tenant. **Requires:** Cookie `sso_session` + Tenant Member.

### GET `/role/:roleId`

Obtener un rol por ID. **Requires:** Cookie `sso_session`.

### PUT `/role/:roleId`

Actualizar un rol. No se pueden modificar roles predeterminados (`admin`, `member`, `viewer`).

### DELETE `/role/:roleId`

Eliminar un rol. No se pueden eliminar roles predeterminados.

---

### POST `/role/:roleId/permission`

Agregar un permiso a un rol.

**Body:**

```json
{
  "applicationId": "uuid-de-aplicacion",
  "resource": "users",
  "action": "create"
}
```

### GET `/role/:roleId/permission`

Listar permisos de un rol. Incluye nombre de la aplicación.

### DELETE `/role/:roleId/permission/:permissionId`

Eliminar permiso por ID.

### DELETE `/role/:roleId/permission`

Eliminar permiso por recurso y acción.

**Body:**

```json
{
  "resource": "users",
  "action": "create"
}
```

---

## Aplicaciones (`/applications`)

### CRUD (System Admin)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | `/applications` | Crear aplicación |
| GET | `/applications` | Listar todas (query `?active=true`) |
| GET | `/applications/:id` | Obtener por ID |
| PUT | `/applications/:id` | Actualizar |
| DELETE | `/applications/:id` | Soft delete (Super Admin) |

**Body para crear:**

```json
{
  "appId": "crm",
  "name": "CRM System",
  "url": "https://crm.empire.com",
  "description": "Sistema de gestión de clientes",
  "logoUrl": "https://cdn.example.com/crm.png"
}
```

---

### Tenant App Management

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | `/applications/tenant/:tenantId/enable` | Habilitar app para tenant |
| GET | `/applications/tenant/:tenantId` | Listar apps del tenant |
| DELETE | `/applications/tenant/:tenantId/:applicationId` | Eliminar app del tenant |

---

### User App Access

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | `/applications/tenant/:tId/:appId/grant` | Dar acceso a un usuario |
| POST | `/applications/tenant/:tId/:appId/grant-bulk` | Dar acceso masivo |
| DELETE | `/applications/tenant/:tId/:appId/revoke/:userId` | Revocar acceso |
| GET | `/applications/tenant/:tId/:appId/users` | Listar usuarios con acceso |
| GET | `/applications/user/:tenantId` | Apps del usuario autenticado |

---

## App Resources (`/app-resources`)

### POST `/app-resources`

Registrar recursos de una aplicación. Típicamente llamado durante el deployment.

**Requires:** Cookie `sso_session`.

**Body:**

```json
{
  "appId": "crm",
  "resources": [
    {
      "resource": "invoices",
      "action": "create",
      "category": "billing",
      "description": "Create new invoices"
    },
    {
      "resource": "invoices",
      "action": "read",
      "category": "billing",
      "description": "View invoices"
    }
  ]
}
```

### GET `/app-resources/:appId`

Obtener los recursos de una aplicación.

### GET `/app-resources/tenant/:tenantId/available`

Obtener los recursos disponibles para las apps habilitadas en un tenant.

---

## OTP — Autenticación de dos factores (`/otp`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | `/otp/generate` | Generar secreto y QR code |
| POST | `/otp/verify` | Verificar token y activar 2FA |
| POST | `/otp/validate` | Validar OTP durante login (con tempToken) |
| POST | `/otp/backup-code` | Usar código de respaldo |
| POST | `/otp/disable` | Desactivar 2FA |
| GET | `/otp/status/:userId` | Verificar si 2FA está activo |

### POST `/otp/generate`

**Body:**

```json
{
  "userId": "uuid",
  "name": "Mi App"
}
```

**Respuesta (200):**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8"],
  "message": "OTP secret generated. Scan the QR code and verify with setup endpoint."
}
```

### POST `/otp/validate`

Validar el token OTP usando el token temporal del signin.

**Body:**

```json
{
  "tempToken": "jwt-temporal-del-signin",
  "token": "123456"
}
```

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Two-factor authentication successful",
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "refresh-token"
  },
  "expiresIn": 3600
}
```

---

## Email Verification (`/email-verification`)

### POST `/email-verification/send`

Enviar email de verificación.

**Body:**

```json
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

### POST `/email-verification/verify`

Verificar token de email.

**Body:**

```json
{
  "token": "uuid-verification-token"
}
```

---

## Errores

Todos los endpoints retornan errores en el siguiente formato:

```json
{
  "error": "ERROR_CODE",
  "message": "Descripción legible del error",
  "details": [],
  "timestamp": "2026-02-12T19:00:00.000Z"
}
```

### Códigos comunes

| Código HTTP | Error Code | Descripción |
| :--- | :--- | :--- |
| 400 | `VALIDATION_ERROR` | Datos de entrada inválidos |
| 400 | `INVALID_INPUT` | Campos requeridos faltantes |
| 401 | `UNAUTHORIZED` | No autenticado |
| 401 | `INVALID_REFRESH` | Refresh token inválido |
| 403 | `FORBIDDEN` | Sin permisos suficientes |
| 403 | `TENANT_ACCESS_DENIED` | Sin acceso al tenant |
| 403 | `APP_ACCESS_DENIED` | Sin acceso a la aplicación |
| 404 | `NOT_FOUND` | Recurso no encontrado |
| 409 | `APP_ID_EXISTS` | ID de app ya existe |
| 409 | `ALREADY_ENABLED` | App ya habilitada |
| 429 | — | Rate limit excedido |
