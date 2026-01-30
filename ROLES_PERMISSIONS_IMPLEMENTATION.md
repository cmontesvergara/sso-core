# Plan de Implementación: Sistema de Permisos por Aplicación

> **Estado Actual**: Fase 0 - Preparación  
> **Última Actualización**: 30 de enero de 2026  
> **Progreso General**: 0% (0/10 fases completadas)

---

## Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura Propuesta](#arquitectura-propuesta)
3. [Plan de Fases](#plan-de-fases)
4. [Estado de Implementación](#estado-de-implementación)
5. [Guía de Integración para Aplicaciones](#guía-de-integración-para-aplicaciones)
6. [API Reference](#api-reference)
7. [Notas de Migración](#notas-de-migración)

---

## Resumen Ejecutivo

### Problema Actual

Los recursos y acciones para permisos están hardcodeados en el frontend:

- `availableResources = ['users', 'applications', 'roles', 'permissions']`
- `availableActions = ['create', 'read', 'update', 'delete', 'grant_access', 'revoke_access']`

Estos son genéricos del SSO, pero la intención real es que **cada aplicación integrada** defina sus propios recursos y acciones según su dominio de negocio.

### Solución Propuesta

Sistema de permisos vinculados a aplicaciones donde:

1. Cada aplicación registra su catálogo de recursos/acciones
2. Los roles pueden tener permisos específicos por aplicación
3. El frontend carga dinámicamente los recursos disponibles según las apps del tenant

### Ejemplo de Uso

- **SSO**: `users:create`, `applications:read`, `roles:update`
- **App Facturación**: `invoices:approve`, `clients:create`, `payments:void`
- **App Inventario**: `products:transfer`, `warehouses:adjust`, `orders:cancel`

---

## Arquitectura Propuesta

### Modelos de Base de Datos

```prisma
model Application {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  appId       String   @unique @db.VarChar(100)
  name        String
  // ... campos existentes
  resources   AppResource[]  // NUEVO
  permissions Permission[]    // NUEVO
}

model AppResource {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  applicationId String   @map("application_id") @db.Uuid
  resource      String   // 'invoices', 'products', 'users'
  action        String   // 'approve', 'void', 'create', 'read'
  description   String?  // "Aprobar facturas pendientes"
  category      String?  // "financial", "inventory" (para agrupar en UI)
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, resource, action])
  @@index([applicationId, isActive])
  @@map("app_resources")
}

model Permission {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  roleId        String   @map("role_id") @db.Uuid
  applicationId String   @map("application_id") @db.Uuid  // OBLIGATORIO (no nullable)
  resource      String
  action        String
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  role        Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([roleId, applicationId, resource, action])
  @@index([roleId])
  @@index([applicationId])
  @@map("permissions")
}
```

### Flujo de Datos

```
1. App se registra → POST /api/v1/application/:appId/resources
2. App registra recursos → [{resource: 'invoices', action: 'approve', ...}]
3. Tenant admin gestiona roles → Ve apps habilitadas en su tenant
4. Admin selecciona app → Frontend carga recursos de esa app
5. Admin agrega permiso → {applicationId, resource, action} validado contra catálogo
6. Usuario usa app → App valida permisos del rol del usuario
```

---

## Plan de Fases

### ✅ Fase 0: Preparación

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 30 minutos

#### Tareas

- [ ] **0.1** Backup de base de datos actual (por si acaso)
- [ ] **0.2** Confirmar borrado de DB y migración desde cero
- [ ] **0.3** Revisar apps actualmente registradas en `applications` table

---

### ✅ Fase 1: Schema y Base de Datos

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 2 horas

#### 1.1 Modificar Prisma Schema

**Archivo**: `prisma/schema.prisma`

**Cambios**:

```prisma
// 1. Agregar relaciones a Application
model Application {
  // ... campos existentes
  resources   AppResource[]
  permissions Permission[]
}

// 2. Crear modelo AppResource (NUEVO)
model AppResource {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  applicationId String   @map("application_id") @db.Uuid
  resource      String
  action        String
  description   String?
  category      String?
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, resource, action])
  @@index([applicationId, isActive])
  @@map("app_resources")
}

// 3. Modificar modelo Permission (CAMBIO BREAKING)
model Permission {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  roleId        String   @map("role_id") @db.Uuid
  applicationId String   @map("application_id") @db.Uuid  // CAMBIO: Ya no nullable
  resource      String
  action        String
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  role        Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([roleId, applicationId, resource, action])
  @@index([roleId])
  @@index([applicationId])
  @@map("permissions")
}
```

**Tareas**:

- [ ] **1.1.1** Modificar `prisma/schema.prisma`
- [ ] **1.1.2** Ejecutar `npm run prisma:generate`
- [ ] **1.1.3** Verificar que no hay errores de TypeScript

---

#### 1.2 Actualizar Migración y Seed

**Archivos**:

- `migrations/001_init.js`
- `scripts/seed-complete.js`

**Tareas**:

- [ ] **1.2.1** Agregar tabla `app_resources` en `migrations/001_init.js`:

  ```sql
  CREATE TABLE app_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, resource, action)
  );
  CREATE INDEX idx_app_resources_application ON app_resources(application_id, is_active);
  ```

- [ ] **1.2.2** Modificar tabla `permissions` en `migrations/001_init.js`:

  ```sql
  -- Cambiar de:
  application_id UUID, -- nullable
  -- A:
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

  -- Actualizar unique constraint:
  UNIQUE(role_id, application_id, resource, action)
  ```

- [ ] **1.2.3** Agregar seed de recursos SSO en `scripts/seed-complete.js`:

  ```javascript
  // 1. Crear aplicación SSO si no existe
  const ssoApp = await prisma.application.upsert({
    where: { appId: 'sso' },
    update: {},
    create: {
      appId: 'sso',
      name: 'Single Sign-On',
      url: process.env.SSO_PORTAL_URL || 'http://localhost:4200',
      description: 'Sistema de autenticación y gestión de usuarios',
      isActive: true,
    },
  });

  // 2. Registrar recursos SSO
  const ssoResources = [
    {
      resource: 'users',
      action: 'create',
      description: 'Crear usuarios',
      category: 'user_management',
    },
    { resource: 'users', action: 'read', description: 'Ver usuarios', category: 'user_management' },
    {
      resource: 'users',
      action: 'update',
      description: 'Editar usuarios',
      category: 'user_management',
    },
    {
      resource: 'users',
      action: 'delete',
      description: 'Eliminar usuarios',
      category: 'user_management',
    },
    {
      resource: 'applications',
      action: 'create',
      description: 'Registrar aplicaciones',
      category: 'app_management',
    },
    {
      resource: 'applications',
      action: 'read',
      description: 'Ver aplicaciones',
      category: 'app_management',
    },
    {
      resource: 'applications',
      action: 'update',
      description: 'Editar aplicaciones',
      category: 'app_management',
    },
    {
      resource: 'applications',
      action: 'delete',
      description: 'Eliminar aplicaciones',
      category: 'app_management',
    },
    {
      resource: 'roles',
      action: 'create',
      description: 'Crear roles personalizados',
      category: 'access_control',
    },
    { resource: 'roles', action: 'read', description: 'Ver roles', category: 'access_control' },
    {
      resource: 'roles',
      action: 'update',
      description: 'Editar roles',
      category: 'access_control',
    },
    {
      resource: 'roles',
      action: 'delete',
      description: 'Eliminar roles',
      category: 'access_control',
    },
    {
      resource: 'permissions',
      action: 'grant_access',
      description: 'Otorgar permisos a roles',
      category: 'access_control',
    },
    {
      resource: 'permissions',
      action: 'revoke_access',
      description: 'Revocar permisos de roles',
      category: 'access_control',
    },
    {
      resource: 'tenants',
      action: 'create',
      description: 'Crear organizaciones',
      category: 'tenant_management',
    },
    {
      resource: 'tenants',
      action: 'read',
      description: 'Ver organizaciones',
      category: 'tenant_management',
    },
    {
      resource: 'tenants',
      action: 'update',
      description: 'Editar organizaciones',
      category: 'tenant_management',
    },
    {
      resource: 'tenants',
      action: 'invite_members',
      description: 'Invitar miembros',
      category: 'tenant_management',
    },
  ];

  for (const resource of ssoResources) {
    await prisma.appResource.upsert({
      where: {
        applicationId_resource_action: {
          applicationId: ssoApp.id,
          resource: resource.resource,
          action: resource.action,
        },
      },
      update: {},
      create: {
        applicationId: ssoApp.id,
        ...resource,
      },
    });
  }
  ```

- [ ] **1.2.4** Borrar base de datos: `DROP DATABASE sso_db; CREATE DATABASE sso_db;`
- [ ] **1.2.5** Ejecutar migración: `npm run migrate:up`
- [ ] **1.2.6** Ejecutar seed: `npm run seed:complete`
- [ ] **1.2.7** Verificar en DB que existen `app_resources` y app SSO

---

### ✅ Fase 2: Backend - Repositorios

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 2 horas

#### 2.1 Crear repositorio de recursos de aplicación

**Archivo**: `src/repositories/appResourceRepo.prisma.ts` (NUEVO)

**Funciones**:

```typescript
export async function createAppResource(data: {
  applicationId: string;
  resource: string;
  action: string;
  description?: string;
  category?: string;
}): Promise<AppResource>;

export async function bulkCreateAppResources(
  applicationId: string,
  resources: Array<{
    resource: string;
    action: string;
    description?: string;
    category?: string;
  }>
): Promise<AppResource[]>;

export async function listAppResources(
  applicationId: string,
  isActive?: boolean
): Promise<AppResource[]>;

export async function findAppResource(
  applicationId: string,
  resource: string,
  action: string
): Promise<AppResource | null>;

export async function deleteAppResource(id: string): Promise<void>;

export async function deactivateAppResource(id: string): Promise<AppResource>;

export async function listResourcesByTenant(
  tenantId: string
): Promise<Array<AppResource & { applicationName: string }>>;
```

**Tareas**:

- [ ] **2.1.1** Crear archivo `src/repositories/appResourceRepo.prisma.ts`
- [ ] **2.1.2** Implementar todas las funciones
- [ ] **2.1.3** Agregar logger en operaciones importantes

---

#### 2.2 Modificar repositorio de roles/permisos

**Archivo**: `src/repositories/roleRepo.prisma.ts`

**Cambios**:

```typescript
// ANTES:
export async function createPermission(data: { roleId: string; resource: string; action: string });

// DESPUÉS (applicationId OBLIGATORIO):
export async function createPermission(data: {
  roleId: string;
  applicationId: string; // NUEVO - REQUERIDO
  resource: string;
  action: string;
});

// Actualizar listPermissionsByRole para incluir application data:
export async function listPermissionsByRole(roleId: string) {
  return await prisma.permission.findMany({
    where: { roleId },
    include: {
      application: {
        select: {
          id: true,
          appId: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

**Tareas**:

- [ ] **2.2.1** Actualizar firma de `createPermission`
- [ ] **2.2.2** Actualizar `listPermissionsByRole` con include
- [ ] **2.2.3** Actualizar `deletePermissionByRoleResourceAction` para incluir `applicationId`
- [ ] **2.2.4** Corregir todos los tipos TypeScript afectados

---

### ✅ Fase 3: Backend - Servicios

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 3 horas

#### 3.1 Crear servicio de recursos de aplicación

**Archivo**: `src/services/appResource.ts` (NUEVO)

**Clase**:

```typescript
export interface RegisterResourcesInput {
  resources: Array<{
    resource: string;
    action: string;
    description?: string;
    category?: string;
  }>;
}

export class AppResourceService {
  private static instance: AppResourceService;

  private constructor() {}

  static getInstance(): AppResourceService {
    if (!AppResourceService.instance) {
      AppResourceService.instance = new AppResourceService();
    }
    return AppResourceService.instance;
  }

  /**
   * Register or update resources for an application
   * Called by apps on startup or when resources change
   */
  async registerAppResources(
    appId: string,
    input: RegisterResourcesInput,
    registeredBy: string
  ): Promise<{ count: number; resources: AppResource[] }>;

  /**
   * Get all resources for an application
   */
  async getAppResources(appId: string, isActive?: boolean): Promise<AppResource[]>;

  /**
   * Get all available resources for a tenant
   * Returns resources from SSO + all enabled apps in tenant
   */
  async getAvailableResourcesForTenant(tenantId: string): Promise<
    Array<{
      applicationId: string;
      applicationName: string;
      appId: string;
      resources: AppResource[];
    }>
  >;

  /**
   * Validate that a permission exists in the app's catalog
   */
  async validatePermission(appId: string, resource: string, action: string): Promise<boolean>;

  /**
   * Deactivate a resource (soft delete)
   */
  async deactivateResource(
    appId: string,
    resource: string,
    action: string,
    deactivatedBy: string
  ): Promise<void>;
}

export const AppResourceService_Instance = AppResourceService.getInstance();
```

**Tareas**:

- [ ] **3.1.1** Crear archivo `src/services/appResource.ts`
- [ ] **3.1.2** Implementar todos los métodos con validaciones
- [ ] **3.1.3** Agregar logs para auditoría
- [ ] **3.1.4** Validar permisos (solo app owner o system admin)

---

#### 3.2 Modificar servicio de roles

**Archivo**: `src/services/role.ts`

**Cambios en `addPermission`**:

```typescript
// ANTES:
export interface CreatePermissionInput {
  resource: string;
  action: string;
}

// DESPUÉS (applicationId OBLIGATORIO):
export interface CreatePermissionInput {
  applicationId: string;  // NUEVO - REQUERIDO
  resource: string;
  action: string;
}

async addPermission(
  roleId: string,
  input: CreatePermissionInput,
  addedByUserId: string
): Promise<{
  id: string;
  roleId: string;
  applicationId: string;
  resource: string;
  action: string;
  createdAt: Date;
}> {
  try {
    const role = await findRoleById(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    // Verify user is admin of tenant
    const membership = await findTenantMember(role.tenantId, addedByUserId);
    if (!membership || membership.role !== 'admin') {
      throw new Error('Only tenant admins can add permissions');
    }

    // Prevent modifying default roles
    if (['admin', 'member', 'viewer'].includes(role.name)) {
      throw new Error('Cannot modify permissions of default roles');
    }

    // NUEVO: Validar que el permiso existe en el catálogo de la app
    const appResourceExists = await AppResourceService_Instance.validatePermission(
      input.applicationId,
      input.resource,
      input.action
    );

    if (!appResourceExists) {
      throw new Error(
        `Permission ${input.resource}:${input.action} is not registered for this application`
      );
    }

    // NUEVO: Verificar que la app está habilitada en el tenant
    const tenantApp = await findTenantApp(role.tenantId, input.applicationId);
    if (!tenantApp || !tenantApp.isEnabled) {
      throw new Error('Application is not enabled for this tenant');
    }

    // Create permission
    const permission = await createPermission({
      roleId,
      applicationId: input.applicationId,  // NUEVO
      resource: input.resource,
      action: input.action,
    });

    logger.info(
      `Permission ${input.applicationId}:${input.resource}:${input.action} added to role ${roleId}`
    );

    return {
      id: permission.id,
      roleId: permission.roleId,
      applicationId: permission.applicationId,
      resource: permission.resource,
      action: permission.action,
      createdAt: permission.createdAt,
    };
  } catch (error) {
    logger.error('Failed to add permission:', error);
    throw error;
  }
}
```

**Tareas**:

- [ ] **3.2.1** Importar `AppResourceService_Instance`
- [ ] **3.2.2** Modificar interface `CreatePermissionInput` (agregar `applicationId`)
- [ ] **3.2.3** Actualizar método `addPermission` con validaciones
- [ ] **3.2.4** Actualizar `removePermissionByResourceAction` para incluir `applicationId`
- [ ] **3.2.5** Actualizar método `getRolePermissions` para incluir application data

---

### ✅ Fase 4: Backend - API Endpoints

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 2 horas

#### 4.1 Crear endpoints de recursos de aplicación

**Archivo**: `src/routes/appResource.ts` (NUEVO)

**Endpoints**:

```typescript
/**
 * POST /api/v1/application/:appId/resources
 * Register or update resources for an application
 * Auth: System Admin only (or API key in future)
 * Body: { resources: [{ resource, action, description?, category? }] }
 */

/**
 * GET /api/v1/application/:appId/resources
 * Get all resources for an application
 * Auth: SSO session + Tenant member
 */

/**
 * GET /api/v1/tenant/:tenantId/available-resources
 * Get all available resources for a tenant (SSO + enabled apps)
 * Auth: SSO session + Tenant admin
 */
```

**Validation Schemas**:

```typescript
const registerResourcesSchema = Joi.object({
  resources: Joi.array()
    .items(
      Joi.object({
        resource: Joi.string().required().min(2).max(100),
        action: Joi.string().required().min(2).max(100),
        description: Joi.string().optional().max(500),
        category: Joi.string().optional().max(50),
      })
    )
    .min(1)
    .required(),
});
```

**Tareas**:

- [ ] **4.1.1** Crear archivo `src/routes/appResource.ts`
- [ ] **4.1.2** Implementar los 3 endpoints con validaciones
- [ ] **4.1.3** Agregar middleware de autenticación
- [ ] **4.1.4** Registrar rutas en `src/index.ts`

---

#### 4.2 Modificar endpoints de roles/permisos

**Archivo**: `src/routes/role.ts`

**Cambios**:

```typescript
// Actualizar schema de validación:
const createPermissionSchema = Joi.object({
  applicationId: Joi.string().required().uuid(), // CAMBIO: Ya no optional
  resource: Joi.string().required().min(2).max(100),
  action: Joi.string().required().min(2).max(100),
});

// POST /api/v1/role/:roleId/permission
// Ya valida applicationId contra catálogo automáticamente (en el service)
```

**Tareas**:

- [ ] **4.2.1** Actualizar `createPermissionSchema` (applicationId required)
- [ ] **4.2.2** Actualizar respuesta de GET permissions para incluir application data
- [ ] **4.2.3** Actualizar endpoint DELETE permission (incluir applicationId en validación)
- [ ] **4.2.4** Probar endpoints con Postman/curl

---

### ✅ Fase 5: Frontend - Modelos y Servicios

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 2 horas

#### 5.1 Actualizar modelos TypeScript

**Archivo**: `sso-portal/src/app/core/models/index.ts`

**Cambios**:

```typescript
/**
 * App Resource models
 */
export interface AppResource {
  id: string;
  applicationId: string;
  resource: string;
  action: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Permission {
  id: string;
  applicationId: string; // CAMBIO: Ya no optional
  applicationName?: string; // Para mostrar en UI
  appId?: string; // 'sso', 'billing', etc.
  resource: string;
  action: string;
  createdAt: string;
}

export interface CreatePermissionDto {
  applicationId: string; // CAMBIO: Ya no optional
  resource: string;
  action: string;
}

export interface AvailableResource {
  applicationId: string;
  applicationName: string;
  appId: string;
  resources: AppResource[];
}
```

**Tareas**:

- [ ] **5.1.1** Actualizar interfaces en `models/index.ts`
- [ ] **5.1.2** Verificar que no hay errores de TypeScript en el proyecto

---

#### 5.2 Crear servicio de recursos de aplicación

**Archivo**: `sso-portal/src/app/core/services/app-resource.service.ts` (NUEVO)

**Servicio**:

```typescript
@Injectable({ providedIn: 'root' })
export class AppResourceService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all resources for an application
   */
  getAppResources(appId: string): Observable<{
    success: boolean;
    resources: AppResource[];
    count: number;
  }> {
    return this.http.get<...>(
      `${this.baseUrl}/api/v1/application/${appId}/resources`,
      { withCredentials: true }
    );
  }

  /**
   * Get all available resources for a tenant
   */
  getAvailableResourcesForTenant(tenantId: string): Observable<{
    success: boolean;
    data: AvailableResource[];
  }> {
    return this.http.get<...>(
      `${this.baseUrl}/api/v1/tenant/${tenantId}/available-resources`,
      { withCredentials: true }
    );
  }
}
```

**Tareas**:

- [ ] **5.2.1** Crear archivo `app-resource.service.ts`
- [ ] **5.2.2** Implementar métodos HTTP
- [ ] **5.2.3** Agregar manejo de errores

---

### ✅ Fase 6: Frontend - UI

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 3 horas

#### 6.1 Modificar componente de roles

**Archivo**: `sso-portal/src/app/modules/admin/pages/roles/roles.component.ts`

**Cambios**:

```typescript
// Agregar propiedades:
availableResources: AvailableResource[] = [];
selectedAppId: string = '';
filteredResources: AppResource[] = [];
filteredActions: string[] = [];

// Modificar addPermissionForm:
addPermissionForm = {
  applicationId: '',
  resource: '',
  action: '',
};

// ELIMINAR estas propiedades hardcodeadas:
// availableResources = ['users', 'applications', 'roles', 'permissions'];
// availableActions = ['create', 'read', 'update', 'delete', 'grant_access', 'revoke_access'];

// Nuevos métodos:
async loadAvailableResources() {
  this.appResourceService.getAvailableResourcesForTenant(this.tenantId)
    .subscribe({
      next: (response) => {
        this.availableResources = response.data;
      },
      error: (err) => {
        console.error('Error loading resources:', err);
      }
    });
}

onAppChange() {
  const appId = this.addPermissionForm.applicationId;
  if (!appId) {
    this.filteredResources = [];
    return;
  }

  const app = this.availableResources.find(a => a.applicationId === appId);
  this.filteredResources = app?.resources || [];
  this.addPermissionForm.resource = '';
  this.addPermissionForm.action = '';
}

onResourceChange() {
  const resource = this.addPermissionForm.resource;
  if (!resource) {
    this.filteredActions = [];
    return;
  }

  // Get unique actions for selected resource
  this.filteredActions = [
    ...new Set(
      this.filteredResources
        .filter(r => r.resource === resource)
        .map(r => r.action)
    )
  ];
  this.addPermissionForm.action = '';
}

getResourceDescription(resource: string, action: string): string {
  const found = this.filteredResources.find(
    r => r.resource === resource && r.action === action
  );
  return found?.description || '';
}
```

**Tareas**:

- [ ] **6.1.1** Importar `AppResourceService`
- [ ] **6.1.2** Eliminar arrays hardcodeados
- [ ] **6.1.3** Agregar propiedades dinámicas
- [ ] **6.1.4** Implementar métodos de filtrado
- [ ] **6.1.5** Llamar `loadAvailableResources()` en `ngOnInit`

---

#### 6.2 Modificar template de roles

**Archivo**: `sso-portal/src/app/modules/admin/pages/roles/roles.component.html`

**Cambios en tabla de permisos**:

```html
<!-- Agregar columna de aplicación -->
<thead>
  <tr>
    <th>Aplicación</th>
    <th>Recurso</th>
    <th>Acción</th>
    <th>Fecha</th>
    <th>Acciones</th>
  </tr>
</thead>
<tbody>
  <tr *ngFor="let permission of permissions">
    <td>
      <span
        class="px-2 py-1 text-xs font-semibold rounded-full"
        [class.bg-blue-100]="permission.appId === 'sso'"
        [class.text-blue-800]="permission.appId === 'sso'"
        [class.bg-green-100]="permission.appId !== 'sso'"
        [class.text-green-800]="permission.appId !== 'sso'"
      >
        {{ permission.applicationName || 'SSO' }}
      </span>
    </td>
    <td>{{ permission.resource }}</td>
    <td>{{ permission.action }}</td>
    <td>{{ permission.createdAt | date: 'dd/MM/yyyy' }}</td>
    <td>...</td>
  </tr>
</tbody>
```

**Cambios en modal de agregar permiso**:

```html
<div class="space-y-4">
  <!-- Select de aplicación -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1"> Aplicación * </label>
    <select
      [(ngModel)]="addPermissionForm.applicationId"
      name="applicationId"
      (change)="onAppChange()"
      required
      class="w-full px-3 py-2 border border-gray-300 rounded-lg"
    >
      <option value="">Selecciona una aplicación</option>
      <option *ngFor="let app of availableResources" [value]="app.applicationId">
        {{ app.applicationName }}
      </option>
    </select>
  </div>

  <!-- Select de recurso (dinámico) -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1"> Recurso * </label>
    <select
      [(ngModel)]="addPermissionForm.resource"
      name="resource"
      (change)="onResourceChange()"
      [disabled]="!addPermissionForm.applicationId"
      required
      class="w-full px-3 py-2 border border-gray-300 rounded-lg"
    >
      <option value="">Selecciona un recurso</option>
      <option *ngFor="let resource of getUniqueResources()" [value]="resource">
        {{ resource }}
      </option>
    </select>
  </div>

  <!-- Select de acción (dinámico) -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1"> Acción * </label>
    <select
      [(ngModel)]="addPermissionForm.action"
      name="action"
      [disabled]="!addPermissionForm.resource"
      required
      class="w-full px-3 py-2 border border-gray-300 rounded-lg"
    >
      <option value="">Selecciona una acción</option>
      <option *ngFor="let action of filteredActions" [value]="action">
        {{ action }}
        <span
          *ngIf="getResourceDescription(addPermissionForm.resource, action)"
          class="text-gray-500 text-sm"
        >
          - {{ getResourceDescription(addPermissionForm.resource, action) }}
        </span>
      </option>
    </select>
  </div>
</div>
```

**Tareas**:

- [ ] **6.2.1** Agregar columna de aplicación en tabla
- [ ] **6.2.2** Modificar modal para selects dinámicos
- [ ] **6.2.3** Agregar badges para categorías (opcional)
- [ ] **6.2.4** Probar flujo completo en navegador

---

### ✅ Fase 7: SDK para Integración de Apps

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 2 horas

#### 7.1 Crear SDK

**Carpeta**: `sdk-client/` (en raíz del proyecto backend)

**Estructura**:

```
sdk-client/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── SSOResourceRegistry.ts
│   └── types.ts
└── README.md
```

**Código**: `sdk-client/src/SSOResourceRegistry.ts`

```typescript
export interface ResourceDefinition {
  resource: string;
  action: string;
  description?: string;
  category?: string;
}

export interface SSOConfig {
  ssoBaseUrl: string;
  appId: string;
  apiKey?: string; // For future auth
}

export class SSOResourceRegistry {
  private config: SSOConfig;

  constructor(config: SSOConfig) {
    this.config = config;
  }

  /**
   * Register resources for your application
   * Call this on app startup
   */
  async registerResources(
    resources: ResourceDefinition[]
  ): Promise<{ success: boolean; count: number }> {
    try {
      const response = await fetch(
        `${this.config.ssoBaseUrl}/api/v1/application/${this.config.appId}/resources`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${this.config.apiKey}` // Future
          },
          body: JSON.stringify({ resources }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to register resources: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Registered ${data.count} resources for app ${this.config.appId}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to register resources:', error);
      throw error;
    }
  }

  /**
   * Get current registered resources
   */
  async getResources(): Promise<ResourceDefinition[]> {
    const response = await fetch(
      `${this.config.ssoBaseUrl}/api/v1/application/${this.config.appId}/resources`
    );
    const data = await response.json();
    return data.resources;
  }
}
```

**Ejemplo de uso**: `sdk-client/README.md`

````markdown
# SSO Resource Registry SDK

## Installation

```bash
npm install @empire/sso-resource-sdk
```
````

## Usage

### 1. Register Resources on App Startup

```typescript
import { SSOResourceRegistry } from '@empire/sso-resource-sdk';

const registry = new SSOResourceRegistry({
  ssoBaseUrl: 'https://sso.empire.com',
  appId: 'billing', // Your app ID
});

// Define your app's resources
const resources = [
  {
    resource: 'invoices',
    action: 'create',
    description: 'Crear nuevas facturas',
    category: 'financial',
  },
  {
    resource: 'invoices',
    action: 'approve',
    description: 'Aprobar facturas pendientes',
    category: 'financial',
  },
  {
    resource: 'invoices',
    action: 'void',
    description: 'Anular facturas',
    category: 'financial',
  },
  {
    resource: 'clients',
    action: 'create',
    description: 'Registrar nuevos clientes',
    category: 'crm',
  },
];

// Register on startup
await registry.registerResources(resources);
```

### 2. Examples by App Type

#### Billing App

```typescript
const billingResources = [
  { resource: 'invoices', action: 'create', category: 'financial' },
  { resource: 'invoices', action: 'approve', category: 'financial' },
  { resource: 'invoices', action: 'void', category: 'financial' },
  { resource: 'invoices', action: 'export', category: 'financial' },
  { resource: 'payments', action: 'process', category: 'financial' },
  { resource: 'payments', action: 'refund', category: 'financial' },
];
```

#### Inventory App

```typescript
const inventoryResources = [
  { resource: 'products', action: 'create', category: 'catalog' },
  { resource: 'products', action: 'update_price', category: 'catalog' },
  { resource: 'products', action: 'transfer', category: 'logistics' },
  { resource: 'warehouses', action: 'adjust_stock', category: 'logistics' },
  { resource: 'orders', action: 'fulfill', category: 'logistics' },
  { resource: 'orders', action: 'cancel', category: 'logistics' },
];
```

#### HR App

```typescript
const hrResources = [
  { resource: 'employees', action: 'hire', category: 'management' },
  { resource: 'employees', action: 'terminate', category: 'management' },
  { resource: 'payroll', action: 'process', category: 'financial' },
  { resource: 'time_off', action: 'approve', category: 'management' },
];
```

````

**Tareas**:
- [ ] **7.1.1** Crear estructura de carpetas en `sdk-client/`
- [ ] **7.1.2** Crear `package.json` con metadata
- [ ] **7.1.3** Implementar `SSOResourceRegistry`
- [ ] **7.1.4** Crear documentación completa en README
- [ ] **7.1.5** (Opcional) Publicar a npm registry privado

---

### ✅ Fase 8: Testing
**Estado**: ⏳ Pendiente
**Duración Estimada**: 2 horas

#### 8.1 Tests Backend
**Archivos**: Crear en `src/services/__tests__/`

**Casos de prueba**:
```typescript
describe('AppResourceService', () => {
  test('should register resources for an app')
  test('should validate permission exists in catalog')
  test('should reject invalid permission')
  test('should get resources for tenant with multiple apps')
})

describe('RoleService with App Permissions', () => {
  test('should create permission with valid applicationId')
  test('should reject permission for non-existent resource')
  test('should reject permission for app not enabled in tenant')
  test('should list permissions with application data')
})
````

**Tareas**:

- [ ] **8.1.1** Crear test para `AppResourceService`
- [ ] **8.1.2** Crear test para `RoleService` modificado
- [ ] **8.1.3** Ejecutar `npm test` y verificar que pasan

---

#### 8.2 Tests E2E con Postman/curl

**Flujo completo**:

```bash
# 1. Login como system admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empire.com","password":"xxx"}'

# 2. Registrar recursos de app "billing"
curl -X POST http://localhost:3000/api/v1/application/billing/resources \
  -H "Cookie: sso_session=xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {"resource":"invoices","action":"approve","description":"Aprobar facturas"},
      {"resource":"invoices","action":"void","description":"Anular facturas"}
    ]
  }'

# 3. Login como tenant admin
curl -X POST http://localhost:3000/api/v1/auth/login ...

# 4. Obtener recursos disponibles para tenant
curl http://localhost:3000/api/v1/tenant/{tenantId}/available-resources \
  -H "Cookie: sso_session=xxx"

# 5. Crear rol personalizado
curl -X POST http://localhost:3000/api/v1/role \
  -d '{"name":"Accountant","tenantId":"xxx"}'

# 6. Agregar permiso de app billing
curl -X POST http://localhost:3000/api/v1/role/{roleId}/permission \
  -d '{"applicationId":"xxx","resource":"invoices","action":"approve"}'

# 7. Listar permisos del rol (debe incluir app name)
curl http://localhost:3000/api/v1/role/{roleId}/permission
```

**Tareas**:

- [ ] **8.2.1** Crear colección Postman con flujo completo
- [ ] **8.2.2** Ejecutar flujo E2E y verificar respuestas
- [ ] **8.2.3** Probar casos de error (recurso inválido, app no habilitada, etc.)

---

#### 8.3 Tests Frontend

**Casos de prueba**:

1. Navegar a gestión de roles de un tenant
2. Abrir modal "Agregar Permiso"
3. Seleccionar aplicación "SSO" → Ver recursos SSO
4. Seleccionar aplicación "Billing" → Ver recursos de Billing
5. Seleccionar recurso → Ver acciones filtradas
6. Ver descripción del permiso
7. Crear permiso y verificar que aparece en lista con badge de app

**Tareas**:

- [ ] **8.3.1** Probar flujo completo en navegador
- [ ] **8.3.2** Verificar que selects se actualizan dinámicamente
- [ ] **8.3.3** Verificar que tabla muestra columna de aplicación
- [ ] **8.3.4** Probar con múltiples apps habilitadas

---

### ✅ Fase 9: Documentación

**Estado**: ⏳ Pendiente  
**Duración Estimada**: 1 hora

#### 9.1 Actualizar documentación existente

**Archivos a actualizar**:

- `README.md`: Agregar sección de permisos por aplicación
- `APP_BACKEND_INTEGRATION.md`: Agregar sección de registro de recursos

**Secciones nuevas**:

````markdown
## Resource Registration

Each integrated application must register its resources/actions on startup:

```typescript
import { SSOResourceRegistry } from '@empire/sso-resource-sdk';

await registry.registerResources([{ resource: 'invoices', action: 'approve', description: '...' }]);
```
````

## Permission Model

Permissions are now tied to specific applications:

- `applicationId`: Required - The app that owns this resource
- `resource`: The entity (invoices, products, users)
- `action`: The operation (create, approve, transfer)

Example: Permission to approve invoices in Billing app

```json
{
  "applicationId": "uuid-of-billing-app",
  "resource": "invoices",
  "action": "approve"
}
```

````

**Tareas**:
- [ ] **9.1.1** Actualizar `README.md` con ejemplo de registro de recursos
- [ ] **9.1.2** Actualizar `APP_BACKEND_INTEGRATION.md` con guía completa
- [ ] **9.1.3** Agregar diagramas de flujo (opcional)

---

### ✅ Fase 10: Deployment y Validación Final
**Estado**: ⏳ Pendiente
**Duración Estimada**: 1 hora

#### 10.1 Preparar para deployment

**Checklist**:
- [ ] **10.1.1** Verificar que todas las migrations se ejecutan correctamente
- [ ] **10.1.2** Verificar seed completo con recursos SSO
- [ ] **10.1.3** Compilar backend: `npm run build`
- [ ] **10.1.4** Compilar frontend: `npm run build`
- [ ] **10.1.5** Verificar variables de entorno necesarias

---

#### 10.2 Validación final

**Flujo de validación completo**:
1. ✅ DB tiene tabla `app_resources` con recursos SSO
2. ✅ Backend compila sin errores TypeScript
3. ✅ Endpoints responden correctamente
4. ✅ Frontend carga recursos dinámicamente
5. ✅ Se puede crear rol con permisos de app específica
6. ✅ Validación de permisos funciona (rechaza recursos no registrados)
7. ✅ SDK puede registrar recursos de app externa

**Tareas**:
- [ ] **10.2.1** Ejecutar checklist de validación
- [ ] **10.2.2** Probar con app de prueba externa
- [ ] **10.2.3** Deployment a staging
- [ ] **10.2.4** Smoke test en staging

---

## Estado de Implementación

### Resumen por Fase

| Fase | Nombre | Estado | Progreso | Fecha Inicio | Fecha Fin |
|------|--------|--------|----------|--------------|-----------|
| 0 | Preparación | ⏳ Pendiente | 0% | - | - |
| 1 | Schema y BD | ⏳ Pendiente | 0% | - | - |
| 2 | Repositorios | ⏳ Pendiente | 0% | - | - |
| 3 | Servicios | ⏳ Pendiente | 0% | - | - |
| 4 | API Endpoints | ⏳ Pendiente | 0% | - | - |
| 5 | Frontend Models | ⏳ Pendiente | 0% | - | - |
| 6 | Frontend UI | ⏳ Pendiente | 0% | - | - |
| 7 | SDK | ⏳ Pendiente | 0% | - | - |
| 8 | Testing | ⏳ Pendiente | 0% | - | - |
| 9 | Documentación | ⏳ Pendiente | 0% | - | - |
| 10 | Deployment | ⏳ Pendiente | 0% | - | - |

**Leyenda**:
- ⏳ Pendiente
- 🟡 En Progreso
- ✅ Completado
- ❌ Bloqueado

---

### Checklist de Tareas Global

#### Fase 1 - Schema y BD
- [ ] 1.1.1 Modificar prisma/schema.prisma
- [ ] 1.1.2 Ejecutar prisma:generate
- [ ] 1.1.3 Verificar TypeScript
- [ ] 1.2.1 Agregar tabla app_resources a migration
- [ ] 1.2.2 Modificar tabla permissions en migration
- [ ] 1.2.3 Agregar seed de recursos SSO
- [ ] 1.2.4 Borrar y recrear DB
- [ ] 1.2.5 Ejecutar migración
- [ ] 1.2.6 Ejecutar seed
- [ ] 1.2.7 Verificar datos en DB

#### Fase 2 - Repositorios
- [ ] 2.1.1 Crear appResourceRepo.prisma.ts
- [ ] 2.1.2 Implementar funciones del repo
- [ ] 2.1.3 Agregar logging
- [ ] 2.2.1 Actualizar createPermission
- [ ] 2.2.2 Actualizar listPermissionsByRole
- [ ] 2.2.3 Actualizar deletePermissionByResourceAction
- [ ] 2.2.4 Corregir tipos TypeScript

#### Fase 3 - Servicios
- [ ] 3.1.1 Crear appResource.ts service
- [ ] 3.1.2 Implementar métodos con validaciones
- [ ] 3.1.3 Agregar logs de auditoría
- [ ] 3.1.4 Validar permisos de acceso
- [ ] 3.2.1 Importar AppResourceService en role.ts
- [ ] 3.2.2 Modificar CreatePermissionInput
- [ ] 3.2.3 Actualizar addPermission con validaciones
- [ ] 3.2.4 Actualizar removePermissionByResourceAction
- [ ] 3.2.5 Actualizar getRolePermissions

#### Fase 4 - API Endpoints
- [ ] 4.1.1 Crear appResource.ts routes
- [ ] 4.1.2 Implementar 3 endpoints
- [ ] 4.1.3 Agregar middleware auth
- [ ] 4.1.4 Registrar rutas en index.ts
- [ ] 4.2.1 Actualizar createPermissionSchema
- [ ] 4.2.2 Actualizar GET permissions response
- [ ] 4.2.3 Actualizar DELETE permission
- [ ] 4.2.4 Probar con Postman

#### Fase 5 - Frontend Models
- [ ] 5.1.1 Actualizar models/index.ts
- [ ] 5.1.2 Verificar TypeScript
- [ ] 5.2.1 Crear app-resource.service.ts
- [ ] 5.2.2 Implementar métodos HTTP
- [ ] 5.2.3 Agregar manejo de errores

#### Fase 6 - Frontend UI
- [ ] 6.1.1 Importar AppResourceService
- [ ] 6.1.2 Eliminar arrays hardcodeados
- [ ] 6.1.3 Agregar propiedades dinámicas
- [ ] 6.1.4 Implementar métodos de filtrado
- [ ] 6.1.5 Llamar loadAvailableResources
- [ ] 6.2.1 Agregar columna de aplicación
- [ ] 6.2.2 Modificar modal
- [ ] 6.2.3 Agregar badges
- [ ] 6.2.4 Probar en navegador

#### Fase 7 - SDK
- [ ] 7.1.1 Crear estructura sdk-client/
- [ ] 7.1.2 Crear package.json
- [ ] 7.1.3 Implementar SSOResourceRegistry
- [ ] 7.1.4 Crear README con docs
- [ ] 7.1.5 (Opcional) Publicar a npm

#### Fase 8 - Testing
- [ ] 8.1.1 Tests AppResourceService
- [ ] 8.1.2 Tests RoleService
- [ ] 8.1.3 Ejecutar npm test
- [ ] 8.2.1 Colección Postman
- [ ] 8.2.2 Ejecutar flujo E2E
- [ ] 8.2.3 Probar casos de error
- [ ] 8.3.1 Probar en navegador
- [ ] 8.3.2 Verificar selects dinámicos
- [ ] 8.3.3 Verificar tabla
- [ ] 8.3.4 Probar con múltiples apps

#### Fase 9 - Documentación
- [ ] 9.1.1 Actualizar README.md
- [ ] 9.1.2 Actualizar APP_BACKEND_INTEGRATION.md
- [ ] 9.1.3 Agregar diagramas

#### Fase 10 - Deployment
- [ ] 10.1.1 Verificar migrations
- [ ] 10.1.2 Verificar seed
- [ ] 10.1.3 Compilar backend
- [ ] 10.1.4 Compilar frontend
- [ ] 10.1.5 Verificar env vars
- [ ] 10.2.1 Checklist validación
- [ ] 10.2.2 Probar con app externa
- [ ] 10.2.3 Deploy a staging
- [ ] 10.2.4 Smoke test

---

## Guía de Integración para Aplicaciones

### Paso 1: Instalar SDK

```bash
npm install @empire/sso-resource-sdk
````

### Paso 2: Definir Recursos de tu App

Identifica todos los recursos (entidades) y acciones que tu app maneja:

```typescript
const myAppResources = [
  // Format: { resource, action, description, category }
  {
    resource: 'entity_name',
    action: 'operation',
    description: 'User-friendly description',
    category: 'group',
  },
];
```

### Paso 3: Registrar en Startup

En el punto de entrada de tu aplicación (ej: `index.ts`, `app.ts`):

```typescript
import { SSOResourceRegistry } from '@empire/sso-resource-sdk';

const registry = new SSOResourceRegistry({
  ssoBaseUrl: process.env.SSO_BASE_URL,
  appId: 'your-app-id', // Must match appId in applications table
});

// Register on startup
async function registerResources() {
  try {
    await registry.registerResources(myAppResources);
    console.log('✅ Resources registered successfully');
  } catch (error) {
    console.error('❌ Failed to register resources:', error);
    // Decide: fail startup or continue?
  }
}

registerResources();
```

### Paso 4: Naming Conventions

**Best Practices**:

- **Resources**: Singular, lowercase, snake_case → `invoice`, `product`, `purchase_order`
- **Actions**: Verb, lowercase, snake_case → `create`, `approve`, `void`, `transfer`, `adjust_stock`
- **Categories**: Group related resources → `financial`, `inventory`, `crm`, `hr`

**Examples**:

| App       | Resource   | Action       | Description                 | Category   |
| --------- | ---------- | ------------ | --------------------------- | ---------- |
| Billing   | invoices   | create       | Crear nuevas facturas       | financial  |
| Billing   | invoices   | approve      | Aprobar facturas pendientes | financial  |
| Billing   | invoices   | void         | Anular facturas             | financial  |
| Billing   | payments   | process      | Procesar pagos              | financial  |
| Inventory | products   | create       | Crear productos             | catalog    |
| Inventory | products   | transfer     | Transferir entre almacenes  | logistics  |
| Inventory | warehouses | adjust_stock | Ajustar inventario          | logistics  |
| HR        | employees  | hire         | Contratar empleados         | management |
| HR        | payroll    | process      | Procesar nómina             | financial  |

---

## API Reference

### App Resources

#### POST /api/v1/application/:appId/resources

Register or update resources for an application.

**Auth**: System Admin (future: API Key)

**Request**:

```json
{
  "resources": [
    {
      "resource": "invoices",
      "action": "approve",
      "description": "Aprobar facturas pendientes",
      "category": "financial"
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "count": 5,
  "resources": [...]
}
```

---

#### GET /api/v1/application/:appId/resources

Get all resources for an application.

**Auth**: SSO Session + Tenant Member

**Response**:

```json
{
  "success": true,
  "resources": [
    {
      "id": "uuid",
      "applicationId": "uuid",
      "resource": "invoices",
      "action": "approve",
      "description": "Aprobar facturas pendientes",
      "category": "financial",
      "isActive": true,
      "createdAt": "2026-01-30T..."
    }
  ],
  "count": 5
}
```

---

#### GET /api/v1/tenant/:tenantId/available-resources

Get all available resources for a tenant (SSO + enabled apps).

**Auth**: SSO Session + Tenant Admin

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "applicationId": "uuid",
      "applicationName": "Single Sign-On",
      "appId": "sso",
      "resources": [...]
    },
    {
      "applicationId": "uuid",
      "applicationName": "Billing System",
      "appId": "billing",
      "resources": [...]
    }
  ]
}
```

---

### Permissions (Modified)

#### POST /api/v1/role/:roleId/permission

Add permission to role. Now requires `applicationId`.

**Auth**: SSO Session + Tenant Admin

**Request** (CHANGED):

```json
{
  "applicationId": "uuid", // REQUIRED
  "resource": "invoices",
  "action": "approve"
}
```

**Validation**:

- Checks that resource/action exists in app's catalog
- Checks that app is enabled for tenant
- Prevents modifying default roles (admin, member, viewer)

**Response**:

```json
{
  "success": true,
  "permission": {
    "id": "uuid",
    "roleId": "uuid",
    "applicationId": "uuid",
    "resource": "invoices",
    "action": "approve",
    "createdAt": "2026-01-30T..."
  }
}
```

---

#### GET /api/v1/role/:roleId/permission

List permissions for a role. Now includes application data.

**Response** (CHANGED):

```json
{
  "success": true,
  "permissions": [
    {
      "id": "uuid",
      "applicationId": "uuid",
      "applicationName": "Billing System", // NEW
      "appId": "billing", // NEW
      "resource": "invoices",
      "action": "approve",
      "createdAt": "2026-01-30T..."
    }
  ],
  "count": 3
}
```

---

## Notas de Migración

### Breaking Changes

1. **Permission.applicationId es ahora REQUERIDO**
   - Antes: `applicationId` era nullable
   - Ahora: Todos los permisos deben tener un `applicationId`
   - Acción: Se borrará la DB y se recreará con seed

2. **CreatePermissionDto requiere applicationId**
   - Antes: `{ resource, action }`
   - Ahora: `{ applicationId, resource, action }`
   - Afecta: Frontend, cualquier app que llame la API

3. **Recursos hardcodeados eliminados del frontend**
   - Antes: Arrays estáticos en `roles.component.ts`
   - Ahora: Carga dinámica desde API
   - Beneficio: Cada app define sus propios recursos

### Migration Path

Dado que NO necesitamos backward compatibility:

1. ✅ **Borrar base de datos completa**

   ```sql
   DROP DATABASE sso_db;
   CREATE DATABASE sso_db;
   ```

2. ✅ **Ejecutar migración actualizada**

   ```bash
   npm run migrate:up
   ```

3. ✅ **Ejecutar seed con recursos SSO**

   ```bash
   npm run seed:complete
   ```

4. ✅ **Verificar que app SSO tiene recursos registrados**

### Post-Migration Checklist

- [ ] Tabla `app_resources` existe con seed de SSO
- [ ] Tabla `permissions` tiene columna `application_id NOT NULL`
- [ ] Aplicación SSO está registrada con `appId='sso'`
- [ ] Al menos 15 recursos SSO están registrados
- [ ] Unique constraint en `(application_id, resource, action)`
- [ ] Foreign key de `permissions.application_id` → `applications.id`

---

## Próximos Pasos

Una vez completadas todas las fases, las mejoras futuras incluyen:

1. **API Key Authentication para Apps**
   - Actualmente: System admin registra recursos
   - Futuro: Apps se autentican con API key

2. **Permission Templates**
   - Roles predefinidos por app (ej: "Accountant", "Warehouse Manager")
   - Facilita configuración inicial

3. **Permission Groups/Categories UI**
   - Agrupar permisos por categoría en la UI
   - Checkboxes para asignar categorías completas

4. **Resource Versioning**
   - Permitir que apps actualicen recursos sin romper roles existentes
   - Deprecation warnings

5. **Audit Log de Cambios**
   - Registrar quién agregó/removió cada permiso
   - Timeline de cambios en roles

6. **Permission Validation Middleware**
   - Helper para apps que validen permisos del usuario
   - `@RequirePermission('invoices:approve')`

---

**Fin del Documento** ✅
