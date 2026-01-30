# Guía de Testing - Sistema de Permisos por Aplicación

## Resumen de Cambios Implementados

Se ha implementado un sistema completo donde cada aplicación puede definir sus propios recursos y acciones para permisos, eliminando la necesidad de hardcodear recursos en el frontend.

### Arquitectura

```
Frontend (Angular) → Backend API → Database
     ↓                    ↓            ↓
  Servicios          Servicios    Prisma ORM
     ↓                    ↓            ↓
 Componentes         Repositorios  PostgreSQL
```

---

## Testing del Backend

### 1. Verificar la Base de Datos

```bash
# Conectar a la base de datos
psql -h 200.45.208.239 -U supertoken -d supertoken

# Verificar tablas
\dt

# Verificar recursos SSO
SELECT * FROM app_resources WHERE application_id = (SELECT id FROM applications WHERE app_id = 'sso');

# Verificar permisos
SELECT p.*, ar.resource, ar.action, a.name as app_name
FROM permissions p
JOIN app_resources ar ON p.application_id = ar.application_id
  AND p.resource = ar.resource
  AND p.action = ar.action
JOIN applications a ON a.id = p.application_id
LIMIT 10;
```

### 2. Iniciar el Backend

```bash
cd /Users/cmontes/EmpireSoft/Projects/Single\ Sign\ On/new_sso_backend

# Instalar dependencias si es necesario
npm install

# Iniciar el servidor
npm run dev
```

Verificar que inicie correctamente en `http://localhost:3000`

### 3. Probar Endpoints con cURL

#### A. Obtener Recursos de una Aplicación (SSO)

```bash
curl -X GET "http://localhost:3000/api/v1/app-resources/sso" \
  -H "Cookie: sso_session=<tu_session_cookie>" \
  -v
```

**Respuesta esperada:**

```json
{
  "success": true,
  "resources": [
    {
      "resource": "users",
      "action": "create",
      "category": "user_management",
      "description": "Create new users in the system",
      "applicationName": "Single Sign-On",
      "appId": "sso"
    }
    // ... más recursos
  ],
  "count": 18
}
```

#### B. Obtener Recursos Disponibles para un Tenant

```bash
curl -X GET "http://localhost:3000/api/v1/app-resources/tenant/<tenant-id>/available" \
  -H "Cookie: sso_session=<tu_session_cookie>" \
  -v
```

#### C. Crear un Permiso con Aplicación

```bash
curl -X POST "http://localhost:3000/api/v1/role/<role-id>/permission" \
  -H "Content-Type: application/json" \
  -H "Cookie: sso_session=<tu_session_cookie>" \
  -d '{
    "applicationId": "<uuid-de-aplicacion>",
    "resource": "users",
    "action": "create"
  }' \
  -v
```

#### D. Listar Permisos de un Rol

```bash
curl -X GET "http://localhost:3000/api/v1/role/<role-id>/permission" \
  -H "Cookie: sso_session=<tu_session_cookie>" \
  -v
```

**Respuesta esperada:**

```json
{
  "success": true,
  "permissions": [
    {
      "id": "uuid",
      "applicationId": "uuid",
      "applicationName": "Single Sign-On",
      "appId": "sso",
      "resource": "users",
      "action": "create",
      "createdAt": "2026-01-30T..."
    }
  ],
  "count": 1
}
```

---

## Testing del Frontend

### 1. Iniciar el Frontend

```bash
cd /Users/cmontes/EmpireSoft/Projects/sso-portal

# Instalar dependencias si es necesario
npm install

# Iniciar el servidor
npm start
```

Verificar que inicie correctamente en `http://localhost:4200`

### 2. Flujo de Testing en UI

#### A. Login

1. Navegar a `http://localhost:4200`
2. Iniciar sesión con credenciales de admin

#### B. Navegar a Gestión de Roles

1. Ir a **Admin** → **Tenants**
2. Seleccionar un tenant
3. Hacer clic en **Roles**

#### C. Ver Permisos Existentes

1. Seleccionar un rol (ej: "admin")
2. Hacer clic en **Ver Permisos**
3. Verificar que se muestra:
   - Badge con nombre de la aplicación (ej: "Single Sign-On")
   - Recurso y acción (ej: "users : create")
   - Fecha de creación

#### D. Agregar Nuevo Permiso

1. Seleccionar un rol personalizado (no admin/member/viewer)
2. Hacer clic en **Ver Permisos**
3. Hacer clic en **Agregar Permiso**
4. Verificar el flujo en cascada:
   - **Paso 1:** Seleccionar aplicación (ej: "Single Sign-On")
   - **Paso 2:** El selector de recursos se habilita y muestra recursos de la app
   - **Paso 3:** Seleccionar recurso (ej: "users")
   - **Paso 4:** El selector de acciones se habilita y muestra acciones para ese recurso
   - **Paso 5:** Seleccionar acción (ej: "update")
5. Hacer clic en **Agregar**
6. Verificar que el permiso aparece en la lista con el badge de la aplicación

#### E. Eliminar Permiso

1. En la lista de permisos, hacer clic en **Eliminar** para un permiso
2. Confirmar la eliminación
3. Verificar que el permiso desaparece

---

## Casos de Prueba Importantes

### 1. Validación de Recursos

**Test:** Intentar agregar un permiso con un recurso que no existe en el catálogo

**Resultado esperado:** Error del backend: "Resource 'xxx:yyy' is not registered for application 'sso'"

### 2. Validación de Acceso del Tenant

**Test:** Intentar agregar un permiso para una aplicación que el tenant no tiene habilitada

**Resultado esperado:** Error: "Tenant does not have access to application 'xxx'"

### 3. Roles Predeterminados

**Test:** Intentar modificar permisos del rol "admin"

**Resultado esperado:** Error: "Cannot modify permissions of default roles (admin, member, viewer)"

### 4. Permisos Existentes

**Test:** Verificar que los roles predeterminados tienen los 18 permisos SSO

**Cómo verificar:**

```sql
-- Admin debe tener 18 permisos
SELECT COUNT(*) FROM permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin' LIMIT 1);

-- Member debe tener 4 permisos
SELECT COUNT(*) FROM permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'member' LIMIT 1);

-- Viewer debe tener 1 permiso
SELECT COUNT(*) FROM permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'viewer' LIMIT 1);
```

---

## Pruebas de Integración

### Escenario 1: Nueva Aplicación Registra sus Recursos

```bash
# 1. Registrar recursos de una nueva app
curl -X POST "http://localhost:3000/api/v1/app-resources" \
  -H "Content-Type: application/json" \
  -H "Cookie: sso_session=<tu_session_cookie>" \
  -d '{
    "appId": "erp",
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
  }' \
  -v
```

### Escenario 2: Tenant Habilita Nueva Aplicación

```sql
-- Verificar que el tenant tiene la app habilitada
SELECT * FROM tenant_apps
WHERE tenant_id = '<tenant-id>'
  AND application_id = (SELECT id FROM applications WHERE app_id = 'erp')
  AND is_enabled = true;
```

### Escenario 3: Crear Permiso con Recurso de Nueva App

1. En el frontend, abrir modal de agregar permiso
2. Seleccionar la nueva aplicación (debe aparecer en el dropdown)
3. Seleccionar recurso "invoices"
4. Seleccionar acción "create"
5. Verificar que se crea correctamente

---

## Verificación de Errores Comunes

### Error 1: "SSO application not found"

**Causa:** La aplicación SSO no fue seeded correctamente
**Solución:**

```bash
cd new_sso_backend
npm run seed
```

### Error 2: "Application with appId 'xxx' not found"

**Causa:** La aplicación no existe en la base de datos
**Solución:** Verificar que la aplicación esté creada en la tabla `applications`

### Error 3: "Resource 'xxx:yyy' is not registered"

**Causa:** El recurso no existe en `app_resources` para esa aplicación
**Solución:** Registrar el recurso usando el endpoint `/app-resources`

### Error 4: "Tenant does not have access to this application"

**Causa:** El tenant no tiene la app habilitada en `tenant_apps`
**Solución:** Habilitar la app para el tenant en la tabla `tenant_apps`

---

## Checklist de Validación

### Backend ✓

- [ ] Base de datos migrada correctamente
- [ ] Tabla `app_resources` existe con 18 registros SSO
- [ ] Tabla `permissions` tiene columna `application_id` NOT NULL
- [ ] Servidor backend inicia sin errores
- [ ] Endpoint GET `/app-resources/:appId` funciona
- [ ] Endpoint GET `/app-resources/tenant/:tenantId/available` funciona
- [ ] Endpoint POST `/role/:roleId/permission` requiere `applicationId`
- [ ] Endpoint GET `/role/:roleId/permission` retorna datos de aplicación

### Frontend ✓

- [ ] Modelos actualizados con `applicationId` y `AppResource`
- [ ] Servicio `AppResourceService` creado
- [ ] Servicio `RoleManagementService` actualizado
- [ ] Componente de roles sin errores de compilación
- [ ] Modal de agregar permiso tiene 3 selectores
- [ ] Selectores funcionan en cascada (app → recurso → acción)
- [ ] Vista de permisos muestra badge de aplicación
- [ ] Se pueden agregar permisos correctamente
- [ ] Se pueden eliminar permisos correctamente

### Integración ✓

- [ ] Frontend carga recursos disponibles del backend
- [ ] Validación de recursos funciona en backend
- [ ] Validación de acceso del tenant funciona
- [ ] Roles predeterminados no se pueden modificar
- [ ] Nuevos tenants reciben roles con permisos SSO

---

## Logs a Monitorear

### Backend

```bash
# En la terminal del backend, buscar:
tail -f logs/app.log | grep -E "(Permission|AppResource|Role)"
```

Logs importantes:

- `Registered N resources for application X`
- `Permission added to role X by user Y`
- `Validating permission: app=X resource=Y action=Z`

### Frontend

```javascript
// En la consola del navegador (F12), verificar:
console.log('Available resources:', resources);
console.log('Filtered resources:', this.filteredResources);
console.log('Permission added:', response);
```

---

## Próximos Pasos

1. **Fase 7: SDK para Aplicaciones**
   - Crear librería TypeScript/JavaScript
   - Método `registerResources(appId, resources)`
   - Documentación de integración

2. **Fase 8: Testing Automatizado**
   - Tests unitarios de repositorios
   - Tests de integración de servicios
   - Tests E2E del flujo completo

3. **Fase 9: Documentación para Desarrolladores**
   - Cómo integrar una nueva aplicación
   - Ejemplos de código
   - Mejores prácticas

---

## Soporte

Si encuentras errores:

1. Verificar logs del backend
2. Verificar consola del navegador
3. Revisar base de datos
4. Consultar este documento

¿Necesitas ayuda? Revisa los casos de prueba y errores comunes arriba.
