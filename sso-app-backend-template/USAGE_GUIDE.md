# Guía de Uso: Cómo Crear una Nueva App con SSO

Esta guía te muestra paso a paso cómo crear una nueva aplicación integrada con el sistema SSO usando el template.

## 📋 Pre-requisitos

- Node.js instalado
- SSO Backend corriendo (puerto 3000)
- SSO Portal corriendo (puerto 4201)
- Acceso al template `sso-app-backend-template`

## 🎯 Ejemplo: Crear Backend para CRM

### Paso 1: Copiar el Template

```bash
# Desde el directorio raíz del proyecto SSO
cd /path/to/new_sso_backend

# Copiar el template y renombrarlo
cp -r sso-app-backend-template crm-backend
cd crm-backend
```

### Paso 2: Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tu editor favorito
nano .env
```

Configurar las siguientes variables:

```env
# Identificador único de tu app
APP_ID=crm

# Puerto del backend (debe ser único)
PORT=4301

# URL del SSO Backend (normalmente no cambia)
SSO_BACKEND_URL=http://localhost:3000

# URL del frontend de tu app
FRONTEND_URL=http://localhost:4202

# Nombre de la cookie (debe ser único por app)
COOKIE_NAME=crm_session

# Otros valores pueden quedarse igual para desarrollo
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
SESSION_MAX_AGE=86400000
NODE_ENV=development
```

### Paso 3: Personalizar package.json

Editar [crm-backend/package.json](crm-backend/package.json):

```json
{
  "name": "crm-backend",
  "version": "1.0.0",
  "description": "Backend para la aplicación CRM con integración SSO",
  "main": "server.js",
  ...
}
```

### Paso 4: Instalar Dependencias

```bash
npm install
```

Deberías ver:

```
added 110 packages, and audited 111 packages in 7s
found 0 vulnerabilities
```

### Paso 5: Personalizar el README

Editar [crm-backend/README.md](crm-backend/README.md) y cambiar:

```markdown
# CRM Backend

Backend para la aplicación CRM con integración al sistema SSO de Empire.

> **Nota:** Este backend fue creado usando el template `sso-app-backend-template`.
```

### Paso 6: Agregar Endpoints Específicos de tu App

Editar [crm-backend/server.js](crm-backend/server.js) y agregar tus endpoints después de los endpoints de autenticación:

```javascript
// ====================================
// CRM-SPECIFIC ENDPOINTS
// ====================================

/**
 * GET /api/customers
 * Obtiene la lista de clientes del tenant actual
 */
app.get('/api/customers', requireAuth, (req, res) => {
  const { tenantId } = req.user;

  // Tu lógica aquí...
  // Ejemplo: Query a base de datos
  const customers = await db.customer.findMany({
    where: { tenantId }
  });

  res.json({
    success: true,
    customers
  });
});

// Más endpoints...
```

**Importante:** Siempre usa el middleware `requireAuth` para endpoints protegidos y filtra por `tenantId` para multi-tenancy.

### Paso 7: Actualizar el Mensaje de Inicio

Personaliza el mensaje cuando el servidor inicia (final de server.js):

```javascript
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`   CRM Backend Started`); // <-- Personalizar aquí
  console.log('   ========================================');
  // ... resto del mensaje
  console.log('   CRM Endpoints:'); // <-- Listar tus endpoints
  console.log(`   GET    /api/customers`);
  console.log(`   GET    /api/leads`);
  console.log(`   GET    /api/deals`);
  // ...
});
```

### Paso 8: Ejecutar el Servidor

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# O modo producción
npm start
```

Deberías ver:

```
🚀 ========================================
   CRM Backend Started
   ========================================
   App ID:       crm
   Port:         4301
   Frontend:     http://localhost:4202
   SSO Backend:  http://localhost:3000
   Cookie Name:  crm_session
   Environment:  development
   ========================================

   Auth Endpoints:
   POST   /api/auth/exchange
   GET    /api/auth/session
   POST   /api/auth/logout

   CRM Endpoints:
   GET    /api/customers
   ...

   Ready to accept connections! 🎉
```

### Paso 9: Probar el Backend

```bash
# Health check
curl http://localhost:4301/health

# Debería responder:
# {"status":"ok","app":"crm","timestamp":"..."}
```

### Paso 10: Registrar la App en el SSO Backend

La aplicación debe estar registrada en el SSO. Agrega una entrada en la tabla `user_apps`:

```sql
INSERT INTO user_apps (id, user_id, tenant_id, app_id, app_name, app_url, is_active)
VALUES (
  gen_random_uuid(),
  'user-id-here',
  'tenant-id-here',
  'crm',
  'CRM System',
  'http://localhost:4202',
  true
);
```

## 🔄 Flujo Completo de Autenticación

Una vez configurado el backend, el flujo de autenticación funciona así:

1. **Usuario accede a tu app** (http://localhost:4202)
2. **Frontend detecta no hay sesión** → Redirect a SSO Portal
3. **Usuario hace login en SSO Portal** → Selecciona tenant
4. **SSO genera código** → Redirect a tu app: `/auth/callback?code=abc123`
5. **Tu frontend recibe el código** → Llama a tu backend: `POST /api/auth/exchange`
6. **Tu backend valida código** → Llama a SSO Backend
7. **SSO Backend valida** → Retorna datos de usuario
8. **Tu backend crea sesión** → Setea cookie `crm_session`
9. **Frontend recibe respuesta** → Redirect a dashboard
10. **Usuario usa la app** → Cookie se envía automáticamente en cada request

## 📂 Estructura del Proyecto Final

```
crm-backend/
├── server.js              # Servidor principal con tus endpoints
├── package.json           # Personalizado para tu app
├── .env                   # Configuración específica (no commitear)
├── .env.example           # Ejemplo de configuración
├── .gitignore            # Ignorar node_modules, .env, logs
└── README.md             # Documentación personalizada
```

## 🔧 Tips y Mejores Prácticas

### 1. Multi-tenancy

Siempre filtra por `tenantId`:

```javascript
app.get('/api/data', requireAuth, async (req, res) => {
  const { tenantId } = req.user;

  // ✅ CORRECTO: Filtra por tenant
  const data = await db.data.findMany({
    where: { tenantId },
  });

  // ❌ INCORRECTO: No filtra, expone datos de otros tenants
  const data = await db.data.findMany();
});
```

### 2. Logging

Agrega logs útiles para debugging:

```javascript
app.post('/api/important-action', requireAuth, async (req, res) => {
  console.log('📥 POST /api/important-action');
  console.log('👤 User:', req.user.email);
  console.log('🏢 Tenant:', req.user.tenantId);
  console.log('📦 Body:', req.body);

  // Tu lógica...
});
```

### 3. Validación

Valida los datos de entrada:

```javascript
app.post('/api/customers', requireAuth, async (req, res) => {
  const { name, email, phone } = req.body;

  // Validación
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      error: 'Name and email are required',
    });
  }

  // Continuar...
});
```

### 4. Manejo de Errores

Implementa manejo de errores consistente:

```javascript
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const data = await fetchData();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error fetching data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data',
    });
  }
});
```

### 5. Permisos por Rol

Si necesitas control por roles:

```javascript
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }
    next();
  };
}

// Uso
app.delete('/api/customers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  // Solo admins pueden eliminar clientes
});
```

## 🚀 Próximos Pasos

1. **Crear el frontend de tu app** (Angular/React/Vue)
2. **Implementar el CallbackComponent** en el frontend
3. **Configurar guards** para proteger rutas
4. **Integrar con tu base de datos**
5. **Agregar tests**
6. **Preparar para producción** (Redis, HTTPS, etc.)

## 📚 Recursos

- [README del Template](../sso-app-backend-template/README.md)
- [Roadmap SSO](../ROADMAP_SSO_MIGRATION.md)
- [Arquitectura SSO](../docs-archive/ARCHITECTURE.md)
- [Ejemplo: empire-admin-backend](../../empire-admin-backend/)
- [Ejemplo: crm-backend](../crm-backend/)

## ❓ Preguntas Frecuentes

### ¿Puedo usar TypeScript en vez de JavaScript?

Sí, solo necesitas:

1. Agregar TypeScript: `npm install -D typescript @types/node @types/express`
2. Crear tsconfig.json
3. Renombrar server.js a server.ts
4. Compilar: `tsc`

### ¿Cómo cambio a Redis para sessions?

Ver sección "Cambiar el almacenamiento de sesiones" en el [README del template](../sso-app-backend-template/README.md#cambiar-el-almacenamiento-de-sesiones).

### ¿Qué puerto debo usar?

Usa un puerto único por app:

- 4300: empire-admin
- 4301: crm
- 4302: hr
- 4303: analytics
- etc.

### ¿Cómo manejo múltiples environments?

Crea archivos .env separados:

- `.env.development`
- `.env.staging`
- `.env.production`

Y cárgalos según el ambiente.

---

**Última actualización:** 25 de enero de 2026  
**Autor:** EmpireSoft Team
