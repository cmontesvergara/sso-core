---
title: 'API Reference'
---

# API Reference

Referencia completa de todos los endpoints del IdP Core. Todos los endpoints usan el prefijo **`/api/v2`**.

> [!NOTE]
> Los endpoints protegidos requieren una cookie `sso_session` válida (autenticación SSO). Se indica el tipo de autenticación requerida en cada endpoint.

---

## Índice

- [Autenticación (`/auth`)](#autenticación-auth)
- [Usuarios (`/users`)](#usuarios-users)
- [Tenants (`/tenants`)](#tenants-tenants)
- [Admin — Usuarios (`/user`)](#admin--usuarios-user)
- [Admin — Tenants (`/tenant`)](#admin--tenants-tenant)
- [Aplicaciones (`/applications`)](#aplicaciones-applications)
- [Recursos de App (`/app-resources`)](#recursos-de-app-app-resources)
- [Roles (`/role`)](#roles-role)
- [Estadísticas (`/stats`)](#estadísticas-stats)
- [OTP — 2FA (`/otp`)](#otp--2fa-otp)
- [Verificación de Email](#verificación-de-email)
- [Metadata (`/metadata`)](#metadata-metadata)
- [Utilidades (`/util`)](#utilidades-util)
- [Errores](#errores)

---

## Autenticación (`/auth`)

### POST `/auth/login`

Iniciar sesión con credenciales. Establece una cookie `sso_session` HttpOnly.

**Rate limit:** 4 peticiones por 15 minutos.

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
> La cookie `sso_session` se establece automáticamente con las opciones: `httpOnly: true`, `sameSite: lax`, `secure` solo en producción.

---

### POST `/auth/refresh`

Renovar tokens de acceso usando un refresh token.

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

### POST `/auth/exchange`

Intercambiar un authorization code por tokens de sesión de aplicación (flujo SSO).

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

### POST `/auth/session`

Verificar un token de sesión de aplicación. Llamado por backends de apps en cada request.

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

### POST `/auth/logout`

Cerrar sesión SSO. Destruye la sesión y limpia la cookie `sso_session`.

**Requires:** Cookie `sso_session`.

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
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

### POST `/auth/forgot-password`

Solicitar reset de password. Envía un email con link de recuperación.

**Body:**

```json
{
  "email": "user@example.com"
}
```

---

### POST `/auth/reset-password`

Confirmar reset de password con token recibido por email.

**Body:**

```json
{
  "token": "reset-token",
  "newPassword": "NuevaPass123!"
}
```

---

## Usuarios (`/users`)

### POST `/users/register`

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

### POST `/users/verify-email`

Verificar email con token enviado por correo.

**Body:**

```json
{
  "token": "uuid-verification-token"
}
```

---

### POST `/users/send-verification`

Reenviar email de verificación.

**Rate limit:** 3 peticiones por 15 minutos.

**Body:**

```json
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

---

### PATCH `/users/profile`

Actualizar el perfil del usuario autenticado.

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

### POST `/users/change-password`

Cambiar password del usuario autenticado.

**Requires:** Cookie `sso_session`.

**Body:**

```json
{
  "currentPassword": "ViejaPass123!",
  "newPassword": "NuevaPass123!"
}
```

---

## Tenants (`/tenants`)

### POST `/tenants`

Crear un nuevo tenant.

**Requires:** Cookie `sso_session` + System Admin.

**Body:**

```json
{
  "name": "Mi Empresa",
  "slug": "mi-empresa",
  "adminEmail": "admin@miempresa.com"
}
```

---

### POST `/tenants/:tenantId/members`

Agregar un miembro al tenant.

**Requires:** Cookie `sso_session` + Tenant Admin.

**Body:**

```json
{
  "email": "nuevo@example.com",
  "role": "member"
}
```

> [!NOTE]
> Los roles válidos son: `admin`, `member`, `viewer`.

---

### PATCH `/tenants/:tenantId/members/:userId/role`

Cambiar el rol de un miembro del tenant.

**Requires:** Cookie `sso_session` + Tenant Admin.

**Body:**

```json
{
  "role": "admin"
}
```

---

### GET `/tenants/:tenantId/info`

Obtener información pública de un tenant (no requiere autenticación).

**Rate limit:** 60 peticiones por 5 minutos.

---

## Admin — Usuarios (`/user`)

> [!WARNING]
> Estas rutas son **legacy/admin** y están montadas bajo `/api/v2/user`. Se mantienen para compatibilidad con herramientas de administración.

| Método | Endpoint                | Descripción                     | Auth                 |
| :----- | :---------------------- | :------------------------------ | :------------------- |
| GET    | `/user/list`            | Listar usuarios                 | Cookie `sso_session` |
| GET    | `/user/profile`         | Perfil del usuario autenticado  | Cookie `sso_session` |
| GET    | `/user/tenants`         | Tenants del usuario autenticado | Cookie `sso_session` |
| PUT    | `/user/profile`         | Actualizar perfil               | Cookie `sso_session` |
| PUT    | `/user/:userId/status`  | Cambiar estado del usuario      | Cookie `sso_session` |
| GET    | `/user/:userId/tenants` | Tenants de un usuario           | Cookie `sso_session` |
| GET    | `/user/:userId`         | Obtener usuario por ID          | Cookie `sso_session` |
| PUT    | `/user/:userId`         | Actualizar usuario por ID       | Cookie `sso_session` |
| DELETE | `/user/:userId`         | Eliminar usuario                | Cookie `sso_session` |

---

## Admin — Tenants (`/tenant`)

> [!WARNING]
> Estas rutas son **legacy/admin** y están montadas bajo `/api/v2/tenant`. Se mantienen para compatibilidad con herramientas de administración.

| Método | Endpoint                                | Descripción             | Auth                 |
| :----- | :-------------------------------------- | :---------------------- | :------------------- |
| POST   | `/tenant`                               | Crear tenant            | Cookie `sso_session` |
| GET    | `/tenant`                               | Listar tenants          | Cookie `sso_session` |
| GET    | `/tenant/:tenantId`                     | Obtener tenant por ID   | Cookie `sso_session` |
| PUT    | `/tenant/:tenantId`                     | Actualizar tenant       | Cookie `sso_session` |
| DELETE | `/tenant/:tenantId`                     | Eliminar tenant         | Cookie `sso_session` |
| POST   | `/tenant/:tenantId/members`             | Agregar miembro         | Cookie `sso_session` |
| GET    | `/tenant/:tenantId/members`             | Listar miembros         | Cookie `sso_session` |
| PUT    | `/tenant/:tenantId/members/:memberId`   | Cambiar rol de miembro  | Cookie `sso_session` |
| DELETE | `/tenant/:tenantId/members/:memberId`   | Eliminar miembro        | Cookie `sso_session` |
| GET    | `/tenant/:tenantId/apps`                | Listar apps del tenant  | Cookie `sso_session` |
| POST   | `/tenant/:tenantId/apps`                | Agregar app al tenant   | Cookie `sso_session` |
| DELETE | `/tenant/:tenantId/apps/:applicationId` | Eliminar app del tenant | Cookie `sso_session` |

---

## Aplicaciones (`/applications`)

### CRUD Global (System Admin)

| Método | Endpoint                       | Descripción                         |
| :----- | :----------------------------- | :---------------------------------- |
| POST   | `/applications`                | Crear aplicación                    |
| GET    | `/applications`                | Listar todas (query `?active=true`) |
| GET    | `/applications/:applicationId` | Obtener por ID                      |
| PUT    | `/applications/:applicationId` | Actualizar                          |
| DELETE | `/applications/:applicationId` | Soft delete                         |

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

| Método | Endpoint                                        | Descripción               |
| :----- | :---------------------------------------------- | :------------------------ |
| GET    | `/applications/tenant/:tenantId`                | Listar apps del tenant    |
| POST   | `/applications/tenant/:tenantId`                | Habilitar app para tenant |
| DELETE | `/applications/tenant/:tenantId/:applicationId` | Eliminar app del tenant   |

---

### User App Access

| Método | Endpoint                                                       | Descripción                  |
| :----- | :------------------------------------------------------------- | :--------------------------- |
| POST   | `/applications/tenant/:tenantId/:applicationId/grant`          | Dar acceso a un usuario      |
| POST   | `/applications/tenant/:tenantId/:applicationId/users`          | Alias de `grant`             |
| POST   | `/applications/tenant/:tenantId/:applicationId/users/bulk`     | Dar acceso masivo            |
| DELETE | `/applications/tenant/:tenantId/:applicationId/revoke/:userId` | Revocar acceso               |
| DELETE | `/applications/tenant/:tenantId/:applicationId/users/:userId`  | Alias de `revoke`            |
| GET    | `/applications/tenant/:tenantId/:applicationId/users`          | Listar usuarios con acceso   |
| GET    | `/applications/user/:tenantId/my-apps`                         | Apps del usuario autenticado |

---

### Sync de Recursos

| Método | Endpoint                              | Descripción                       |
| :----- | :------------------------------------ | :-------------------------------- |
| POST   | `/applications/:appId/sync-resources` | Sincronizar recursos desde la app |

---

## Recursos de App (`/app-resources`)

| Método | Endpoint                                    | Descripción                          |
| :----- | :------------------------------------------ | :----------------------------------- |
| POST   | `/app-resources`                            | Registrar recursos de una aplicación |
| GET    | `/app-resources/:appId`                     | Obtener recursos de una app          |
| GET    | `/app-resources/tenant/:tenantId/available` | Recursos disponibles para un tenant  |

**Body para registrar:**

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

---

## Roles (`/role`)

| Método | Endpoint                                 | Descripción                           |
| :----- | :--------------------------------------- | :------------------------------------ |
| GET    | `/role`                                  | Listar todos los roles                |
| POST   | `/role`                                  | Crear rol personalizado               |
| GET    | `/role/tenant/:tenantId`                 | Listar roles de un tenant             |
| GET    | `/role/:roleId`                          | Obtener rol por ID                    |
| PUT    | `/role/:roleId`                          | Actualizar rol                        |
| DELETE | `/role/:roleId`                          | Eliminar rol                          |
| POST   | `/role/:roleId/permission`               | Agregar permiso a rol                 |
| GET    | `/role/:roleId/permission`               | Listar permisos de un rol             |
| DELETE | `/role/:roleId/permission/:permissionId` | Eliminar permiso por ID               |
| DELETE | `/role/:roleId/permission`               | Eliminar permiso por recurso y acción |

**Body para crear rol:**

```json
{
  "name": "editor",
  "description": "Puede editar contenido",
  "tenantId": "uuid-del-tenant"
}
```

**Body para agregar permiso:**

```json
{
  "applicationId": "uuid-de-aplicacion",
  "resource": "users",
  "action": "create"
}
```

> [!NOTE]
> No se pueden modificar ni eliminar roles predeterminados (`admin`, `member`, `viewer`).

---

## Estadísticas (`/stats`)

| Método | Endpoint             | Descripción                          |
| :----- | :------------------- | :----------------------------------- |
| GET    | `/stats`             | Estadísticas generales del sistema   |
| GET    | `/stats/auth-events` | Eventos de autenticación (auditoría) |

---

## OTP — 2FA (`/otp`)

| Método | Endpoint              | Descripción                                 |
| :----- | :-------------------- | :------------------------------------------ |
| POST   | `/otp/generate`       | Generar secreto y QR code                   |
| POST   | `/otp/verify`         | Verificar token y activar 2FA               |
| POST   | `/otp/validate`       | Validar OTP durante login (con `tempToken`) |
| POST   | `/otp/backup-code`    | Usar código de respaldo                     |
| POST   | `/otp/disable`        | Desactivar 2FA                              |
| GET    | `/otp/status/:userId` | Verificar si 2FA está activo                |

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

## Verificación de Email

Los endpoints de verificación de email están bajo `/users`:

- `POST /users/verify-email` — Verificar token de email.
- `POST /users/send-verification` — Reenviar email de verificación.

---

## Metadata (`/metadata`)

> [!NOTE]
> Endpoints para gestionar metadata adicional de usuarios (información extra flexible).

| Método | Endpoint            | Descripción               |
| :----- | :------------------ | :------------------------ |
| POST   | `/metadata/:userId` | Crear/actualizar metadata |
| GET    | `/metadata/:userId` | Obtener metadata          |
| PUT    | `/metadata/:userId` | Actualizar metadata       |

---

## Utilidades (`/util`)

> [!NOTE]
> Endpoints públicos para obtener enums y listas de referencia.

| Método | Endpoint                       | Descripción            |
| :----- | :----------------------------- | :--------------------- |
| GET    | `/util/enums/genders`          | Listar géneros         |
| GET    | `/util/enums/countries`        | Listar países          |
| GET    | `/util/enums/marital_statuses` | Listar estados civiles |

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

| Código HTTP | Error Code             | Descripción                 |
| :---------- | :--------------------- | :-------------------------- |
| 400         | `VALIDATION_ERROR`     | Datos de entrada inválidos  |
| 400         | `INVALID_INPUT`        | Campos requeridos faltantes |
| 401         | `UNAUTHORIZED`         | No autenticado              |
| 401         | `INVALID_REFRESH`      | Refresh token inválido      |
| 403         | `FORBIDDEN`            | Sin permisos suficientes    |
| 403         | `TENANT_ACCESS_DENIED` | Sin acceso al tenant        |
| 403         | `APP_ACCESS_DENIED`    | Sin acceso a la aplicación  |
| 404         | `NOT_FOUND`            | Recurso no encontrado       |
| 409         | `APP_ID_EXISTS`        | ID de app ya existe         |
| 409         | `ALREADY_ENABLED`      | App ya habilitada           |
| 429         | —                      | Rate limit excedido         |
