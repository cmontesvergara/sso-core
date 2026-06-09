---
title: 'API Examples'
---

# API Examples

Ejemplos prácticos de cómo consumir la API del IdP Core. Todos los ejemplos usan el prefijo **`/api/v2`**.

---

## Índice

- [Autenticación](#autenticación)
- [Flujo SSO](#flujo-sso)
- [Gestión de Usuarios](#gestión-de-usuarios)
- [Gestión de Tenants](#gestión-de-tenants)
- [Aplicaciones y Acceso](#aplicaciones-y-acceso)
- [2FA / OTP](#2fa--otp)
- [Utilidades](#utilidades)

---

## Autenticación

### Login

```bash
curl -X POST https://idp.example.com/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "nuid": "user@example.com",
    "password": "SecurePass123!"
  }'
```

```javascript
const res = await fetch('/api/v2/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nuid: 'user@example.com',
    password: 'SecurePass123!',
  }),
  credentials: 'include', // importante para recibir la cookie sso_session
});
const data = await res.json();
```

---

### Refresh Token

```bash
curl -X POST https://idp.example.com/api/v2/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "current-refresh-token"
  }'
```

---

### Logout

```bash
curl -X POST https://idp.example.com/api/v2/auth/logout \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..."
```

```javascript
await fetch('/api/v2/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
```

---

## Flujo SSO

### 1. Autorizar (desde el portal SSO)

El usuario ya tiene una cookie `sso_session` válida. La app redirige al portal SSO con parámetros de consulta, o el frontend del portal llama directamente:

```bash
curl -X POST https://idp.example.com/api/v2/auth/authorize \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "tenantId": "tenant-uuid",
    "appId": "crm",
    "redirectUri": "https://crm.example.com/callback"
  }'
```

**Respuesta:**

```json
{
  "success": true,
  "authCode": "abc123",
  "redirectUri": "https://crm.example.com/callback?code=abc123"
}
```

---

### 2. Intercambiar code por tokens (desde la app)

El backend de la app recibe el `code` por query param y lo intercambia:

```bash
curl -X POST https://idp.example.com/api/v2/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "authCode": "abc123",
    "appId": "crm"
  }'
```

**Respuesta:**

```json
{
  "success": true,
  "sessionToken": "jwt-session",
  "expiresAt": "2026-02-13T19:00:00.000Z",
  "user": { "userId": "uuid", "email": "user@example.com" },
  "tenant": { "tenantId": "uuid", "name": "Mi Empresa", "role": "admin" }
}
```

---

### 3. Verificar sesión en cada request (desde la app)

El backend de la app valida el `sessionToken` (típicamente enviado en una cookie de app):

```bash
curl -X POST https://idp.example.com/api/v2/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "jwt-session",
    "appId": "crm"
  }'
```

---

## Gestión de Usuarios

### Registrar usuario

```bash
curl -X POST https://idp.example.com/api/v2/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo@example.com",
    "password": "SecurePass123!",
    "firstName": "Juan",
    "lastName": "Pérez"
  }'
```

---

### Actualizar perfil

```bash
curl -X PATCH https://idp.example.com/api/v2/users/profile \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+1234567890"
  }'
```

---

### Cambiar password

```bash
curl -X POST https://idp.example.com/api/v2/users/change-password \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "currentPassword": "ViejaPass123!",
    "newPassword": "NuevaPass123!"
  }'
```

---

## Gestión de Tenants

### Crear tenant

```bash
curl -X POST https://idp.example.com/api/v2/tenants \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "name": "Mi Empresa",
    "slug": "mi-empresa",
    "adminEmail": "admin@miempresa.com"
  }'
```

---

### Agregar miembro

```bash
curl -X POST https://idp.example.com/api/v2/tenants/tenant-uuid/members \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "email": "nuevo@example.com",
    "role": "member"
  }'
```

---

### Cambiar rol de miembro

```bash
curl -X PATCH https://idp.example.com/api/v2/tenants/tenant-uuid/members/user-uuid/role \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "role": "admin"
  }'
```

---

## Aplicaciones y Acceso

### Crear aplicación

```bash
curl -X POST https://idp.example.com/api/v2/applications \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "appId": "crm",
    "name": "CRM System",
    "url": "https://crm.example.com",
    "description": "Sistema de gestión de clientes"
  }'
```

---

### Habilitar app para un tenant

```bash
curl -X POST https://idp.example.com/api/v2/applications/tenant/tenant-uuid \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "applicationId": "app-uuid"
  }'
```

---

### Dar acceso a un usuario

```bash
curl -X POST https://idp.example.com/api/v2/applications/tenant/tenant-uuid/app-uuid/grant \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "userId": "user-uuid"
  }'
```

---

### Revocar acceso

```bash
curl -X DELETE https://idp.example.com/api/v2/applications/tenant/tenant-uuid/app-uuid/revoke/user-uuid \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..."
```

---

## 2FA / OTP

### Generar secreto

```bash
curl -X POST https://idp.example.com/api/v2/otp/generate \
  -H "Content-Type: application/json" \
  --cookie "sso_session=..." \
  -d '{
    "userId": "user-uuid",
    "name": "Mi App"
  }'
```

**Respuesta:**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8"]
}
```

---

### Validar OTP durante login

Después de un login que devuelve `requiresTwoFactor: true`, usa el `tempToken`:

```bash
curl -X POST https://idp.example.com/api/v2/otp/validate \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "jwt-temporal",
    "token": "123456"
  }'
```

---

## Utilidades

### Obtener enums

```bash
# Géneros
curl https://idp.example.com/api/v2/util/enums/genders

# Países
curl https://idp.example.com/api/v2/util/enums/countries

# Estados civiles
curl https://idp.example.com/api/v2/util/enums/marital_statuses
```

---

## Notas importantes

1. **Cookies:** Siempre usa `credentials: 'include'` en fetch o `--cookie` en curl para endpoints protegidos.
2. **Rate limits:** Respeta los límites documentados en cada endpoint para evitar bloqueos.
3. **Prefijo:** Todos los endpoints usan `/api/v2`. No existe `/api/v1`.
4. **Errores:** Todos los errores siguen el formato estándar documentado en [API Reference](./api-reference.md).
