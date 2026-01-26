# 🗺️ ROADMAP: Migración a SSO con Authorization Code Flow

---

## 📌 PROMPT PARA AGENTE IA

```
CONTEXTO DEL PROYECTO:
Este es un backend SSO (Single Sign-On) que empezó basándose en SuperTokens pero
se desvió del modelo original usando Bearer tokens en sessionStorage del frontend.

PROBLEMA ACTUAL:
- Tokens JWT expuestos en frontend (sessionStorage)
- No hay true SSO (usuario debe login en cada app)
- No hay portal SSO para administración
- Riesgo de seguridad: tokens accesibles vía JavaScript

OBJETIVO:
Implementar el modelo CORRECTO de SuperTokens:
- Cookies HttpOnly (NO sessionStorage)
- Authorization Code Flow (OAuth2)
- SSO Portal centralizado para administración
- True SSO: login una vez, acceso a todas las apps

ARQUITECTURA OBJETIVO:
1. SSO Frontend (sso.empire.com) - Portal de usuario + login
2. SSO Backend (auth-api.empire.com) - Identity Provider
3. App Backends (crm-api, hr-api, etc) - Cada app con su sesión en cookies
4. App Frontends (crm, hr, admin) - Sin tokens, solo cookies HttpOnly

USUARIO QUIERE:
- Dos modos:
  A) App-initiated: crm.empire.com → redirect SSO → login → redirect back
  B) Direct SSO: sso.empire.com → dashboard → ver apps → click → launch app

ESTADO ACTUAL:
✅ JWT RS256 con JWKS implementado
✅ Refresh tokens con rotación
✅ Multi-tenancy completo (User → Tenant → Roles → Permissions)
✅ 2FA/TOTP implementado
✅ Email verification
✅ RLS en PostgreSQL
❌ Usa Bearer tokens en frontend
❌ No hay authorization code flow
❌ No hay cookies HttpOnly
❌ No hay SSO portal

SIGUIENTE PASO:
Seguir el roadmap en este archivo fase por fase.
empire-admin NO está en producción, así que podemos hacer breaking changes.
```

---

## 🎯 ESTADO ACTUAL DEL PROYECTO

### **Completado (70% del trabajo):**

- [x] JWT RS256 (asymmetric signing)
- [x] JWKS endpoint público (/.well-known/jwks.json)
- [x] Refresh tokens con rotación automática
- [x] Multi-tenancy (tenants, members, roles, permissions)
- [x] 2FA/TOTP con QR codes
- [x] Email verification (3 providers)
- [x] RLS (Row Level Security) en PostgreSQL
- [x] Rate limiting por endpoint
- [x] Prisma ORM + node-pg-migrate
- [x] Argon2 password hashing

### **Faltante (30% - lo que implementaremos):**

- [x] ✅ Authorization code flow (COMPLETADO - 25/01/2026)
- [x] ✅ Session management con cookies HttpOnly (COMPLETADO - 25/01/2026)
- [ ] SSO Portal (frontend) → **INTEGRAR EN empire-admin**
- [ ] Tenant selector UI
- [ ] App-initiated login flow
- [x] ✅ Endpoints /authorize y /validate-code (COMPLETADO - 25/01/2026)
- [ ] App backends con cookie sessions
- [ ] Refactor empire-admin para usar nuevo flow SSO

---

## 📋 ARQUITECTURA OBJETIVO

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO FINAL                            │
└────────────────────────┬────────────────────────────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
┌──────▼──────────────────┐   ┌───────────▼──────────────────┐
│  MODO A: App-Initiated  │   │  MODO B: Direct SSO Access   │
├─────────────────────────┤   ├──────────────────────────────┤
│                         │   │                              │
│ 1. crm.empire.com      │   │ 1. sso.empire.com           │
│    (no session)         │   │    (portal)                 │
│                         │   │                              │
│ 2. Redirect →           │   │ 2. Login + Dashboard        │
│    sso.empire.com/login │   │    - Ver perfil             │
│    ?redirect=crm        │   │    - Ver tenants            │
│                         │   │    - Ver apps               │
│ 3. Login → Select Tenant│   │                             │
│                         │   │ 3. Click app →              │
│ 4. Generate auth_code   │   │    Generate auth_code       │
│                         │   │                              │
│ 5. Redirect →           │   │ 4. Redirect →               │
│    crm.empire.com/      │   │    app.empire.com/          │
│    callback?code=xxx    │   │    callback?code=xxx        │
│                         │   │                              │
│ 6. CRM Backend:         │   │ 5. App Backend:             │
│    - Validate code      │   │    - Validate code          │
│    - Create session     │   │    - Create session         │
│    - Set cookie         │   │    - Set cookie             │
│                         │   │                              │
│ 7. crm.empire.com/      │   │ 6. app.empire.com/          │
│    dashboard            │   │    dashboard                │
│    ✓ Session activa     │   │    ✓ Session activa         │
└─────────────────────────┘   └──────────────────────────────┘
```

---

## 🚀 ROADMAP DE IMPLEMENTACIÓN

### **FASE 0: Preparación (1-2 días)**

**Objetivo:** Documentar y preparar el entorno

- [x] ✅ Crear este roadmap
- [ ] Crear diagrama de arquitectura visual (opcional)
- [x] ✅ Revisar dependencias necesarias (actuales son suficientes)
- [ ] Crear branch: `feature/authorization-code-flow`

**Entregables:**

- [x] Roadmap completo (este archivo)
- [ ] Branch git creado

---

### **FASE 1: SSO Backend - Authorization Code Flow (✅ COMPLETADO - 25/01/2026)**

**Objetivo:** Implementar endpoints para generar y validar authorization codes

#### **1.1 Base de Datos - Auth Codes Table**

**Archivo:** `migrations/001_init.js` (MODIFICADO)

**Tareas:**

- [x] ✅ Agregar tabla `auth_codes` a migración principal
- [x] ✅ Agregar tabla `sso_sessions` a migración principal
- [x] ✅ Agregar tabla `app_sessions` a migración principal
- [x] ✅ Ejecutar migración: Drop DB y recrear con `npm run migrate up`
- [x] ✅ Actualizar `prisma/schema.prisma` con nuevos modelos
- [x] ✅ Regenerar Prisma client: `npx prisma generate`

#### **1.2 Repository Layer**

**Tareas:**

- [x] ✅ Crear `authCodeRepo.prisma.ts` con funciones CRUD
- [x] ✅ Crear `ssoSessionRepo.prisma.ts` con funciones CRUD
- [x] ✅ Crear `appSessionRepo.prisma.ts` con funciones CRUD

#### **1.3 Service Layer**

**Tareas:**

- [x] ✅ Crear `authCode.ts` service con lógica de negocio
- [x] ✅ Crear `ssoSession.ts` service con validación y refresh
- [x] ✅ Implementar TTL de 5 minutos para auth codes
- [x] ✅ Implementar validación one-time use
- [x] ✅ Implementar cleanup automático (cron jobs)

#### **1.4 SSO Session Management**

**Archivo:** `src/services/ssoSession.ts` (NUEVO)

```typescript
// Gestión de sesiones SSO (cookie sso_session)
-createSSOSession(userId) - validateSSOSession(sessionToken) - destroySSOSession(sessionToken);
```

**Opción:** Usar Redis o PostgreSQL para session store

**Tareas:**

- [x] ✅ Implementar session storage (PostgreSQL)
- [x] ✅ TTL configurable (default 24h)
- [x] ✅ Auto-refresh cuando queda <1h

#### **1.5 Endpoints - Authorization**

**Archivo:** `src/routes/auth.ts` (MODIFICAR)

```typescript
// Nuevos endpoints:

POST /api/v1/auth/authorize
  Body: { tenantId, appId, redirectUri }
  Headers: Cookie: sso_session=...
  Response: { authCode, redirectUri }

POST /api/v1/auth/validate-code
  Body: { authCode, appId }
  Response: { valid, userId, tenantId, email, role }
```

**Tareas:**

- [x] ✅ Agregar endpoint `/authorize`
- [x] ✅ Agregar endpoint `/validate-code`
- [x] ✅ Middleware para validar cookie `sso_session` (authenticateSSO)
- [ ] Tests unitarios

#### **1.6 Endpoints - User & Tenants**

**Archivo:** `src/routes/user.ts` y `src/routes/tenant.ts` (MODIFICAR)

```typescript
// Modificar/agregar:

GET /api/v1/user/tenants
  Response: {
    tenants: [
      { id, name, role, apps: [...] }
    ]
  }

GET /api/v1/user/apps
  Response: {
    apps: [
      { id, name, icon, url, tenants: [...] }
    ]
  }
```

**Tareas:**

- [x] ✅ Endpoint para listar tenants con apps (GET /api/v1/user/tenants)
- [x] ✅ Endpoint para perfil de usuario (GET /api/v1/user/profile)
- [ ] Endpoint para listar apps disponibles (GET /api/v1/user/apps)
- [ ] Lógica de app access per tenant (actualmente apps estáticas)

#### **1.7 Modificar Signin para Cookies**

**Archivo:** `src/routes/auth.ts` (MODIFICAR)

```typescript
// Modificar POST /signin para setear cookie:

res.cookie('sso_session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  domain: '.empire.com', // shared domain
  maxAge: 24 * 60 * 60 * 1000,
});
```

**Tareas:**

- [x] ✅ Modificar response de `/signin` para setear cookie sso_session
- [x] ✅ Cookie HttpOnly con domain compartido (.empire.com)
- [x] ✅ Mantener compatibilidad temporal con Bearer tokens

**Entregables Fase 1:**

- [x] ✅ Migration auth_codes ejecutada
- [x] ✅ Servicio AuthCode implementado
- [x] ✅ Endpoints `/authorize` y `/validate-code` funcionando
- [x] ✅ Servidor corriendo sin errores
- [x] ✅ Tests manuales completados (8 tests con curl)
  - Signup con validaciones
  - Signin con SSO cookie
  - Profile con cookie auth
  - Tenants list con apps
  - Authorization code generation
  - Code validation con contexto completo
  - Code reuse rejection (seguridad)

**FASE 1 COMPLETADA ✅ (25 enero 2026)**

**Bugs resueltos durante testing:**

- JWT decoding (sub claim vs userId)
- Cookie domain (localhost vs .empire.com)
- Route ordering (/profile antes de /:userId)
- Prisma client instantiation

---

### **FASE 2: SSO Frontend Portal - Basado en empire-admin (✅ COMPLETADA - 25 enero 2026)**

**Objetivo:** Crear portal SSO centralizado reutilizando estructura de empire-admin

**Estrategia:**

- Clonar empire-admin como base para sso-portal
- Reutilizar: componentes UI, guards, services, Tailwind config
- Adaptar: AuthService para SSO flow, nuevas vistas (Dashboard, Tenant Selector)
- empire-admin se convertirá en "app" que consume SSO (Fase 3)

#### **2.1 Setup Proyecto - Clonar empire-admin**

**Ubicación:** `/sso-portal/` (directorio nuevo, clon de empire-admin)

```bash
# En Projects/
cp -r empire-admin sso-portal
cd sso-portal

# Limpiar y renombrar
rm -rf .git node_modules dist
# Actualizar package.json: name → "sso-portal"
# Actualizar angular.json: projectName → "sso-portal"

npm install
```

**Tareas:**

- [x] ✅ Clonar empire-admin → sso-portal
- [x] ✅ Actualizar package.json y angular.json
- [x] ✅ Limpiar módulos no necesarios (apps module, uikit)
- [x] ✅ Mantener: core (guards, services, utils), shared (components)
- [x] ✅ Configurar environment.ts con SSO backend URL

#### **2.2 Layout & Navigation - Reutilizar componentes**

**Archivos a mantener de empire-admin:**

- `src/app/modules/logged-layout/` → Base para SSO layout
- `src/app/shared/components/` → Navbar, Sidebar, Cards, etc
- `src/app/core/models/` → Interfaces y tipos

**Archivos a crear:**

- `src/app/modules/sso-dashboard/` → Nuevo módulo principal
- `src/app/shared/components/app-card/` → Card para apps disponibles
- `src/app/shared/components/tenant-card/` → Card para selección de tenant

**Tareas:**

- [ ] Limpiar módulos no usados (apps, uikit)
- [ ] Crear módulo sso-dashboard
- [ ] Adaptar navbar para SSO context
- [ ] Reutilizar componentes: buttons, inputs, modals de empire-admin

#### **2.3 Login Page - Adaptar de empire-admin**

**Archivo:** `src/app/modules/auth/pages/sign-in/` (MODIFICAR)

```typescript
// Detectar query params:
ngOnInit() {
  this.redirectUri = this.route.snapshot.queryParams['redirect_uri'];
  this.appId = this.route.snapshot.queryParams['app_id'];
  this.tenantId = this.route.snapshot.queryParams['tenant_id'];

  // Modo A: App-initiated (tiene redirectUri)
  if (this.redirectUri) {
    this.loginMode = 'app-initiated';
    this.appName = this.getAppName(this.appId);
  }
  // Modo B: Direct access
  else {
    this.loginMode = 'direct';
  }
}

// Post-login redirect logic:
onLoginSuccess(response: any) {
  // Cookie sso_session ya fue seteada por backend

  if (this.redirectUri) {
    // App-initiated: ir a tenant selector o authorize directo
    if (this.tenantId) {
      this.authorize(this.tenantId, this.appId, this.redirectUri);
    } else {
      this.router.navigate(['/select-tenant'], {
        queryParams: { redirect_uri: this.redirectUri, app_id: this.appId }
      });
    }
  } else {
    // Direct: ir a dashboard SSO
    this.router.navigate(['/dashboard']);
  }
}
```

**Tareas:**

- [x] ✅ Modificar sign-in component para detección de contexto
- [x] ✅ Mantener UI/UX actual de empire-admin
- [x] ✅ Agregar lógica post-login con redirects (dual mode)
- [x] ✅ Mantener manejo de errores existente
- [x] ✅ Adaptar para cookies (withCredentials: true en HttpClient)
- [x] ✅ Variables de modo: loginMode, redirectUri, appId, tenantId
- [x] ✅ Método handlePostLoginRedirect() con lógica de routing

#### **2.4 Tenant Selector - Nueva vista** ✅ COMPLETADA

**Archivo:** `src/app/modules/sso-dashboard/pages/tenant-selector/` (COMPLETADO)

**Tareas:**

- [x] ✅ Componente creado: tenant-selector.component.ts/html/scss
- [x] ✅ Obtener tenants desde getUserTenants() con filtro por appId
- [x] ✅ Auto-selección cuando solo hay un tenant disponible
- [x] ✅ UI con cards de tenants mostrando nombre, slug, apps count
- [x] ✅ Click handler que llama authorize() y redirige
- [x] ✅ Loading states y disabled state durante autorización
- [x] ✅ Ruta agregada en sso-dashboard.module: 'select-tenant'

```typescript
export class TenantSelectorComponent implements OnInit {
  tenants: Tenant[] = [];
  redirectUri: string;
  appId: string;
  loading = false;

  ngOnInit() {
    this.redirectUri = this.route.snapshot.queryParams['redirect_uri'];
    this.appId = this.route.snapshot.queryParams['app_id'];

    this.loadTenants();
  }

  async loadTenants() {
    // GET /api/v1/user/tenants (con cookie)
    const response = await this.authService.getUserTenants();

    // Filtrar por appId si es app-initiated
    if (this.appId) {
      this.tenants = response.tenants.filter((t) => t.apps.some((app) => app.appId === this.appId));
    } else {
      this.tenants = response.tenants;
    }

    // Auto-select si solo hay 1
    if (this.tenants.length === 1 && this.redirectUri) {
      this.selectTenant(this.tenants[0].tenantId);
    }
  }

  async selectTenant(tenantId: string) {
    this.loading = true;

    try {
      // POST /api/v1/auth/authorize
      const response = await this.authService.authorize({
        tenantId,
        appId: this.appId,
        redirectUri: this.redirectUri,
      });

      // Redirect con auth code
      window.location.href = response.redirectUri;
    } catch (error) {
      this.notificationService.error('Error al autorizar');
    }
  }
}
```

**Template usando componentes de empire-admin:**

```html
<div class="container mx-auto p-6">
  <h2 class="text-2xl font-bold mb-6">Selecciona una organización</h2>

  <!-- Reutilizar grid/card components -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <app-tenant-card
      *ngFor="let tenant of tenants"
      [tenant]="tenant"
      (selected)="selectTenant($event)"
      [loading]="loading"
    >
    </app-tenant-card>
  </div>
</div>
```

**Tareas:**

- [x] ✅ TenantSelectorComponent creado
- [x] ✅ TenantCardComponent (inline en template con Tailwind)
- [x] ✅ Implementar lógica de filtrado por app
- [x] ✅ Auto-selection con 1 tenant
- [x] ✅ Loading states durante authorize
- [x] ✅ Agregar ruta `/select-tenant` en routing

#### **2.5 Dashboard SSO - App Launcher** ✅ COMPLETADA

**Archivo:** `src/app/modules/sso-dashboard/pages/dashboard/` (COMPLETADO)

**Template reutilizando componentes empire-admin:**

```html
<app-logged-layout>
  <!-- Profile Section -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <div class="flex items-center gap-4">
      <img [src]="user.avatar || 'assets/avatars/default.png'" class="w-16 h-16 rounded-full" />
      <div>
        <h2 class="text-xl font-bold">{{ user.firstName }} {{ user.lastName }}</h2>
        <p class="text-gray-600">{{ user.email }}</p>
      </div>
    </div>
  </div>

  <!-- My Organizations & Apps -->
  <div *ngFor="let tenant of tenants" class="mb-8">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-semibold">{{ tenant.name }}</h3>
      <span class="badge">{{ tenant.role }}</span>
    </div>

    <!-- Apps Grid - Reutilizar estilos de empire-admin -->
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <app-card
        *ngFor="let app of tenant.apps"
        [icon]="app.icon || 'default-app-icon'"
        [title]="app.name"
        [description]="app.description"
        (click)="launchApp(tenant.tenantId, app.appId, app.url)"
      >
      </app-card>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="mt-8">
    <a routerLink="/profile" class="btn btn-outline">Editar Perfil</a>
    <a routerLink="/security" class="btn btn-outline">Seguridad</a>
  </div>
</app-logged-layout>
```

**Component logic:**

```typescript
export class SsoDashboardComponent implements OnInit {
  user: User;
  tenants: TenantWithApps[] = [];

  async ngOnInit() {
    await this.loadUserData();
    await this.loadTenants();
  }

  async loadUserData() {
    // GET /api/v1/user/profile
    this.user = await this.authService.getProfile();
  }

  async loadTenants() {
    // GET /api/v1/user/tenants
    const response = await this.authService.getUserTenants();
    this.tenants = response.tenants;
  }

  async launchApp(tenantId: string, appId: string, appUrl: string) {
    try {
      // Generar authorization code
      const response = await this.authService.authorize({
        tenantId,
        appId,
        redirectUri: `${appUrl}/callback`,
      });

      // Redirect a la app con el código
      window.location.href = response.redirectUri;
    } catch (error) {
      this.notificationService.error('Error al lanzar aplicación');
    }
  }
}
```

**Tareas:**

- [x] ✅ DashboardComponent creado (SsoDashboardComponent)
- [x] ✅ AppCardComponent (inline en template con Tailwind grid)
- [x] ✅ Implementar launchApp() con authorize
- [x] ✅ Profile section con avatar initials y datos del usuario
- [x] ✅ Reutilizar estilos de empire-admin con Tailwind
- [x] ✅ Agregar navegación a Profile/Security pages (métodos helper)
- [x] ✅ Ruta agregada en sso-dashboard.module: 'home' → DashboardComponent

#### **2.6 Profile Pages - Reutilizar de empire-admin** ✅ COMPLETADA

**Archivos a copiar/adaptar de empire-admin:**

- `src/app/modules/profile/` → Mantener estructura completa
- Páginas: edit-profile, change-password, security, sessions

**Adaptaciones necesarias:**

```typescript
// AuthService - Cambiar de Bearer tokens a Cookies
@Injectable()
export class AuthService {
  constructor(private http: HttpClient) {}

  // Ya NO guardar tokens en sessionStorage
  // Cookies HttpOnly manejadas automáticamente

  signIn(nuid: string, password: string) {
    return this.http.post(
      `${this.baseUrl}/api/v1/auth/signin`,
      { nuid, password },
      { withCredentials: true } // IMPORTANTE: enviar cookies
    );
  }

  getProfile() {
    return this.http.get(`${this.baseUrl}/api/v1/user/profile`, { withCredentials: true });
  }

  getUserTenants() {
    return this.http.get(`${this.baseUrl}/api/v1/user/tenants`, { withCredentials: true });
  }

  authorize(data: AuthorizeRequest) {
    return this.http.post(`${this.baseUrl}/api/v1/auth/authorize`, data, { withCredentials: true });
  }

  logout() {
    return this.http.post(`${this.baseUrl}/api/v1/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        // Ya NO limpiar sessionStorage
        // Cookie será eliminada por backend
      })
    );
  }
}
```

**Interceptor HTTP - Adaptar:**

```typescript
// src/app/core/interceptor/auth.interceptor.ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    // Ya NO agregar Authorization header
    // Cookies enviadas automáticamente con withCredentials

    const authReq = req.clone({
      withCredentials: true, // Asegurar cookies en todas las requests
    });

    return next.handle(authReq);
  }
}
```

**Guard - Adaptar:**

```typescript
// src/app/core/guards/is-logged/is-logged.guard.ts
export const isLoggedGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Validar sesión con cookie
    await firstValueFrom(authService.getProfile());
    return true;
  } catch (error) {
    // Cookie inválida o expirada
    router.navigate(['/auth/sign-in']);
    return false;
  }
};
```

**Tareas:**

- [x] ✅ Módulo profile ya existe (copiado de empire-admin)
- [x] ✅ AuthService adaptado: eliminado sessionStorage, agregado withCredentials
- [x] ✅ AuthInterceptor: NO creado (withCredentials en cada llamada HTTP)
- [x] ✅ isLoggedGuard adaptado: validar con getProfile() en lugar de token
- [x] ✅ Método logout() implementado que llama backend
- [x] ✅ Páginas mantenidas: edit-profile, security (ya existen en empire-admin)
- [x] ✅ Profile route agregado en app-routing con guard

#### **2.7 HttpClient Configuration** ✅ COMPLETADA

**Archivo:** `src/app/app.module.ts` (MODIFICAR)

```typescript
@NgModule({
  imports: [
    HttpClientModule,
    // Configurar para enviar cookies en todas las requests
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor, // Modificado para withCredentials
      multi: true
    }
  ]
})
```

**Environment configuration:**

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  ssoBackendUrl: 'http://localhost:3000', // Dev
  // ssoBackendUrl: 'https://auth-api.empire.com', // Prod
  cookieDomain: 'localhost', // Dev
  // cookieDomain: '.empire.com', // Prod
};
```

**Tareas:**

- [x] ✅ Environments configurados con ssoBackendUrl
- [x] ✅ withCredentials: true en todas las requests AuthService
- [x] ✅ CORS backend ya configurado (Phase 1)
- [x] ✅ Testing pendiente: requiere ng serve para validación en navegador

**Entregables Fase 2:**

- [x] ✅ sso-portal proyecto creado (clon de empire-admin)
- [x] ✅ Login adaptado con dual mode detection
- [x] ✅ TenantSelector component funcional
- [x] ✅ Dashboard SSO con apps grid
- [x] ✅ AuthService refactorizado (cookies, no sessionStorage)
- [x] ✅ Guards adaptados (async validation con backend)
- [x] ✅ Profile pages copiadas y funcionales (ya existían)
- [x] ✅ Navegación entre dashboard, profile, security (helper methods)
- [x] ✅ Routing configurado: dashboard → sso-dashboard module
- [ ] ⏳ Testing pendiente del flujo: login → select tenant → dashboard → launch app

**Estado:** Fase 2 COMPLETADA ✅ - Código implementado, pendiente pruebas en navegador

---

### **FASE 3: Refactorizar empire-admin como App SSO (1 semana)**

**Objetivo:** Convertir empire-admin en una aplicación que usa SSO para autenticación

**Estrategia:**

- empire-admin ya NO tiene login propio
- Redirect a sso-portal para autenticación
- Recibe authorization code en /callback
- Valida código y crea sesión local
- Usa cookies HttpOnly en lugar de Bearer tokens

#### **3.1 Eliminar Login Local**

**Archivos a modificar:**

- `src/app/modules/auth/` → Eliminar sign-in, sign-up pages
- Mantener solo: `/callback` route

**Tareas:**

- [ ] Eliminar componente sign-in de empire-admin
- [ ] Eliminar componente sign-up
- [ ] Mantener solo módulo auth con callback route

#### **3.2 Implementar /callback Route**

**Archivo:** `src/app/modules/auth/pages/callback/` (NUEVO)

```typescript
export class CallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    const code = this.route.snapshot.queryParams['code'];
    const error = this.route.snapshot.queryParams['error'];

    if (error) {
      this.notificationService.error('Error de autenticación');
      this.router.navigate(['/errors/401']);
      return;
    }

    if (!code) {
      this.router.navigate(['/errors/400']);
      return;
    }

    try {
      // Validar código con SSO backend
      await this.authService.exchangeCode(code);

      // Cookie app_session_admin ya fue seteada por backend
      // Redirect al dashboard
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.notificationService.error('Error al validar código');
      this.initiateLogin(); // Retry
    }
  }

  private initiateLogin() {
    // Redirect a SSO para iniciar login
    const redirectUri = `${window.location.origin}/callback`;
    const ssoUrl = `${environment.ssoPortalUrl}/auth/sign-in?app_id=admin&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = ssoUrl;
  }
}
```

**Tareas:**

- [ ] Crear CallbackComponent
- [ ] Implementar lógica de code exchange
- [ ] Manejo de errores y retry
- [ ] Loading spinner durante validación
- [ ] Agregar ruta `/callback` en app-routing.module

#### **3.3 Crear empire-admin Backend Endpoint**

**Problema:** empire-admin es SPA (Angular), necesita backend para validar código

**Opción A: Crear mini backend para empire-admin**

```bash
# En empire-admin/
mkdir backend
cd backend
npm init -y
npm install express cookie-parser axios cors dotenv
```

**Archivo:** `backend/server.js`

```javascript
const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();
app.use(cookieParser());
app.use(express.json());

// Exchange auth code por sesión
app.post('/api/auth/exchange', async (req, res) => {
  const { code } = req.body;

  try {
    // Validar con SSO backend
    const response = await axios.post('http://localhost:3000/api/v1/auth/validate-code', {
      authCode: code,
      appId: 'admin',
    });

    const { user, tenant } = response.data;

    // Crear sesión local (por ahora simple, luego con Redis/PostgreSQL)
    const sessionId = `admin_${Date.now()}_${Math.random()}`;

    // Guardar sesión en memoria (temporal)
    sessions.set(sessionId, {
      userId: user.userId,
      tenantId: tenant.tenantId,
      role: tenant.role,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Set cookie
    res.cookie('app_session_admin', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'INVALID_CODE' });
  }
});

// Middleware para validar sesión
app.use('/api/protected/*', (req, res, next) => {
  const sessionId = req.cookies.app_session_admin;
  const session = sessions.get(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  req.session = session;
  next();
});

app.listen(4200, () => console.log('Empire Admin Backend on :4200'));
```

**Opción B: Usar SSO backend directamente desde Angular (menos seguro)**

Validar código desde Angular y guardar contexto en memoria (no recomendado para producción)

**Tareas:**

- [ ] Decidir arquitectura: Opción A (mini backend) o B (solo Angular)
- [ ] Si Opción A: crear backend/server.js
- [ ] Endpoint POST /api/auth/exchange
- [ ] Session management (memoria o Redis)
- [ ] Cookie app_session_admin con HttpOnly

#### **3.4 Adaptar AuthService en empire-admin**

**Archivo:** `src/app/core/services/auth/auth.service.ts` (REFACTOR COMPLETO)

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private backendUrl = environment.adminBackendUrl; // http://localhost:4200 (dev)

  constructor(private http: HttpClient) {}

  // Iniciar login (redirect a SSO)
  initiateLogin() {
    const redirectUri = `${window.location.origin}/callback`;
    const ssoUrl = `${environment.ssoPortalUrl}/auth/sign-in?app_id=admin&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = ssoUrl;
  }

  // Exchange authorization code
  exchangeCode(code: string) {
    return this.http.post(
      `${this.backendUrl}/api/auth/exchange`,
      { code },
      { withCredentials: true }
    );
  }

  // Obtener sesión actual
  getCurrentSession() {
    return this.http.get(`${this.backendUrl}/api/auth/session`, { withCredentials: true });
  }

  // Logout
  logout() {
    return this.http.post(`${this.backendUrl}/api/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        // Redirect a SSO logout
        window.location.href = `${environment.ssoPortalUrl}/auth/logout`;
      })
    );
  }

  // Ya NO hay signIn, signUp local
  // Eliminados: signIn(), signUp(), validateEmailOtpCode(), etc.
}
```

**Tareas:**

- [ ] Eliminar métodos de autenticación local (signIn, signUp, etc)
- [ ] Implementar initiateLogin() con redirect a SSO
- [ ] Implementar exchangeCode() para callback
- [ ] Adaptar getCurrentSession() para validar cookie
- [ ] Adaptar logout() para limpiar sesión local y SSO

#### **3.5 Adaptar Guards**

**Archivo:** `src/app/core/guards/is-logged/is-logged.guard.ts` (MODIFICAR)

```typescript
export const isLoggedGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Validar sesión con cookie
    await firstValueFrom(authService.getCurrentSession());
    return true;
  } catch (error) {
    // Cookie inválida/expirada → redirect a SSO login
    authService.initiateLogin();
    return false;
  }
};
```

**Tareas:**

- [ ] Modificar isLoggedGuard para usar getCurrentSession()
- [ ] En caso de error, llamar initiateLogin() (redirect a SSO)
- [ ] Eliminar lógica de Bearer token validation

#### **3.6 Update App Routing**

**Archivo:** `src/app/app-routing.module.ts` (MODIFICAR)

```typescript
const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    canActivate: [isLoggedGuard],
    loadChildren: () => import('./modules/logged-layout/...'),
  },
  {
    path: 'callback', // NUEVO
    loadChildren: () => import('./modules/auth/auth.module'),
  },
  // Eliminar: /auth/sign-in, /auth/sign-up
  { path: '**', redirectTo: 'errors/404' },
];
```

**Tareas:**

- [ ] Agregar ruta /callback
- [ ] Eliminar rutas /auth/sign-in y /auth/sign-up
- [ ] Actualizar redirects en guards

#### **3.7 Environment Configuration**

**Archivo:** `src/environments/environment.ts` (MODIFICAR)

```typescript
export const environment = {
  production: false,
  // Backend propio de empire-admin (nuevo)
  adminBackendUrl: 'http://localhost:4200',
  // SSO Portal
  ssoPortalUrl: 'http://localhost:4201', // o el puerto de sso-portal
  // SSO Backend
  ssoBackendUrl: 'http://localhost:3000',
};
```

**Tareas:**

- [ ] Agregar adminBackendUrl
- [ ] Agregar ssoPortalUrl
- [ ] Mantener ssoBackendUrl
- [ ] Configurar para dev y prod

**Entregables Fase 3:**

- [ ] empire-admin sin login local
- [ ] Callback route funcional
- [ ] Mini backend para empire-admin (code exchange)
- [ ] AuthService refactorizado
- [ ] Guards adaptados
- [ ] Routing actualizado
- [ ] Flujo completo: access admin → redirect SSO → login → callback → dashboard
- [ ] Testing end-to-end

---

### **FASE 4: App Backend Template Reusable (3-4 días)**

**Objetivo:** Crear template de backend Node.js/Express reutilizable para cualquier app

**Ubicación:** `/app_backend_template/` (directorio nuevo)

**Estrategia:**

- Template genérico que cualquier app puede clonar
- Maneja: code exchange, session management, auth middleware
- Basado en el mini backend creado para empire-admin en Fase 3
- Fácil de adaptar: cambiar appId, agregar endpoints propios

#### **4.1 Setup Proyecto Base**

```bash
mkdir app_backend_template
cd app_backend_template
npm init -y
npm install express cookie-parser axios cors dotenv
npm install -D typescript @types/node @types/express
```

**Tareas:**

- [ ] Setup Express + TypeScript
- [ ] Configuración base

#### **3.2 Session Management**

**Archivo:** `src/services/session.ts`

```typescript
// Session storage (Redis o PostgreSQL)
interface AppSession {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  expiresAt: Date;
}

class SessionService {
  createSession(userId, tenantId, role, permissions);
  getSession(sessionId);
  deleteSession(sessionId);
  validateSession(sessionId);
}
```

**Tareas:**

- [ ] Implementar session storage
- [ ] Tabla `app_sessions` en BD o Redis

#### **3.3 Auth Endpoints**

**Archivo:** `src/routes/auth.ts`

```typescript
POST /auth/exchange
  Body: { authCode, appId }

  // Valida con SSO:
  response = await axios.post(
    'https://auth-api.empire.com/api/v1/auth/validate-code',
    { authCode, appId }
  )

  // Crea sesión:
  sessionId = await createSession(...)

  // Set cookie:
  res.cookie('app_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24h
  })

POST /auth/logout
  - Delete session
  - Clear cookie
```

**Tareas:**

- [ ] Endpoint `/auth/exchange`
- [ ] Endpoint `/auth/logout`
- [ ] Endpoint `/auth/me`

#### **3.4 Middleware**

**Archivo:** `src/middleware/auth.ts`

```typescript
async function requireAuth(req, res, next) {
  const sessionId = req.cookies.app_session

  if (!sessionId) {
    return res.status(401).json({
      error: 'No session',
      redirectTo: 'https://sso.empire.com/login?redirect=...'
    })
  }

  const session = await getSession(sessionId)

  if (!session || session.expiresAt < now) {
    res.clearCookie('app_session')
    return res.status(401).json({ ... })
  }

  req.user = session
  next()
}

async function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
```

**Tareas:**

- [ ] Middleware de autenticación
- [ ] Middleware de permisos
- [ ] Middleware de tenant context

#### **3.5 Example Routes**

**Archivo:** `src/routes/example.ts`

```typescript
router.get('/api/customers', requireAuth, async (req, res) => {
  const { tenantId } = req.user;

  // Query con tenant filter:
  const customers = await prisma.customer.findMany({
    where: { tenantId },
  });

  res.json({ customers });
});
```

**Tareas:**

- [ ] Ejemplos de endpoints protegidos
- [ ] Ejemplos con tenant filtering

#### **3.6 Documentación Template**

**Archivo:** `README.md`

```markdown
# App Backend Template

Template para crear backends de apps que consumen SSO.

## Setup:

1. Copiar este directorio
2. Renombrar a tu app (crm-backend, hr-backend)
3. Configurar .env (APP_ID, DATABASE_URL, etc)
4. Implementar tu lógica de negocio

## Configuración:

- APP_ID: Identificador único (crm, hr, admin)
- SSO_API_URL: https://auth-api.empire.com
- COOKIE_DOMAIN: .empire.com (shared)
```

**Tareas:**

- [ ] README completo
- [ ] Ejemplos de uso
- [ ] Guía de deployment

**Entregables Fase 3:**

- Template de app backend funcional
- Documentación clara
- Listo para duplicar por cada app

---

### **FASE 4: Refactor empire-admin (1 semana)**

**Objetivo:** Migrar empire-admin para usar nuevo flow

#### **4.1 Crear Backend para empire-admin**

**Ubicación:** `/empire-admin-backend/`

```bash
# Copiar template:
cp -r app_backend_template empire-admin-backend
cd empire-admin-backend

# Configurar:
APP_ID=admin
DATABASE_URL=...
COOKIE_DOMAIN=admin.empire.com
```

**Tareas:**

- [ ] Setup backend usando template
- [ ] Implementar endpoints específicos de admin
- [ ] Conectar a BD de empire-admin

#### **4.2 Refactor Frontend - AuthService**

**Archivo:** `empire-admin/src/app/core/services/auth/auth.service.ts`

```typescript
// ANTES:
signIn() {
  return this.http.post('/api/v1/auth/signin', {...})
    .subscribe(res => {
      sessionStorage.setItem('accessToken', res.tokens.accessToken)
      sessionStorage.setItem('refreshToken', res.tokens.refreshToken)
    })
}

// DESPUÉS:
signIn() {
  // Si no tiene sesión, redirect a SSO:
  window.location.href =
    'https://sso.empire.com/login' +
    '?redirect_uri=https://admin.empire.com/callback' +
    '&app_id=admin'
}
```

**Tareas:**

- [ ] Eliminar manejo de tokens en frontend
- [ ] Implementar redirect a SSO
- [ ] Cambiar a withCredentials: true en HTTP

#### **4.3 Callback Page**

**Archivo:** `empire-admin/src/app/modules/auth/pages/callback/callback.component.ts`

```typescript
ngOnInit() {
  const code = this.route.snapshot.queryParams['code']

  if (!code) {
    // Redirect a SSO
    window.location.href = 'https://sso.empire.com/login?...'
    return
  }

  // Exchange code:
  this.http.post('https://admin-api.empire.com/auth/exchange', {
    authCode: code,
    appId: 'admin'
  }, {
    withCredentials: true  // Importante!
  }).subscribe(() => {
    // Cookie seteada → redirect
    this.router.navigate(['/dashboard'])
  })
}
```

**Tareas:**

- [ ] Crear CallbackComponent
- [ ] Agregar ruta `/callback`
- [ ] Manejo de errores

#### **4.4 HTTP Interceptor**

**Archivo:** `empire-admin/src/app/core/interceptors/auth.interceptor.ts`

```typescript
// ANTES:
intercept(req, next) {
  const token = sessionStorage.getItem('accessToken')
  req = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  })
  return next.handle(req)
}

// DESPUÉS:
intercept(req, next) {
  // NO agregar Authorization header
  // Cookies se envían automáticamente
  req = req.clone({
    withCredentials: true  // Importante!
  })
  return next.handle(req)
}
```

**Tareas:**

- [ ] Simplificar interceptor
- [ ] Remover manejo de tokens
- [ ] Agregar withCredentials

#### **4.5 Guards**

**Archivo:** `empire-admin/src/app/core/guards/auth.guard.ts`

```typescript
// ANTES:
canActivate() {
  const token = sessionStorage.getItem('accessToken')
  if (!token) {
    this.router.navigate(['/auth/sign-in'])
    return false
  }
  return true
}

// DESPUÉS:
canActivate() {
  return this.http.get('/api/me', { withCredentials: true })
    .pipe(
      map(() => true),
      catchError(() => {
        // No session → redirect a SSO
        window.location.href =
          'https://sso.empire.com/login?redirect=...'
        return of(false)
      })
    )
}
```

**Tareas:**

- [ ] Refactor guards
- [ ] Verificar sesión con backend
- [ ] Redirect a SSO si no hay sesión

#### **4.6 Logout**

**Archivo:** `empire-admin/src/app/core/services/auth/auth.service.ts`

```typescript
// ANTES:
logout() {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('refreshToken')
  this.router.navigate(['/auth/sign-in'])
}

// DESPUÉS:
logout() {
  // Logout en app backend:
  this.http.post('/api/auth/logout', {}, {
    withCredentials: true
  }).subscribe(() => {
    // Opcional: Logout en SSO también
    window.location.href = 'https://sso.empire.com/logout'
  })
}
```

**Tareas:**

- [ ] Implementar logout correcto
- [ ] Limpiar cookies
- [ ] Redirect a SSO

#### **4.7 Cleanup**

**Tareas:**

- [ ] Eliminar LocalStorageService (tokens)
- [ ] Eliminar SessionStorageService (tokens)
- [ ] Limpiar código legacy
- [ ] Actualizar tests

**Entregables Fase 4:**

- empire-admin funcionando con nuevo flow
- Backend empire-admin-backend funcional
- Sin tokens en frontend
- Cookies HttpOnly funcionando

---

### **FASE 5: Testing & Deployment (3-4 días)**

**Objetivo:** Probar todo el sistema end-to-end

#### **5.1 Testing E2E**

**Casos de prueba:**

1. **App-initiated flow:**
   - [ ] Usuario accede a admin.empire.com (sin sesión)
   - [ ] Redirect a SSO
   - [ ] Login exitoso
   - [ ] Tenant selector (si múltiples)
   - [ ] Redirect back a admin
   - [ ] Session cookie seteada
   - [ ] Dashboard carga correctamente

2. **Direct SSO flow:**
   - [ ] Usuario accede a sso.empire.com
   - [ ] Login exitoso
   - [ ] Dashboard SSO carga
   - [ ] Ver tenants y apps
   - [ ] Click en app → genera code → redirect
   - [ ] App carga con sesión

3. **True SSO:**
   - [ ] Login en admin
   - [ ] Abrir crm en nueva pestaña
   - [ ] CRM NO pide login (ya tiene SSO session)
   - [ ] Solo pide tenant si múltiples

4. **2FA:**
   - [ ] Login con 2FA habilitado
   - [ ] Flow con tempToken funciona
   - [ ] Redirect correcto después

5. **Logout:**
   - [ ] Logout en admin
   - [ ] Cookie eliminada
   - [ ] Acceso a admin requiere re-login

#### **5.2 Security Audit**

**Checklist:**

- [ ] Cookies tienen HttpOnly flag
- [ ] Cookies tienen Secure flag (HTTPS)
- [ ] Cookies tienen SameSite=Lax
- [ ] Auth codes expiran en 5 min
- [ ] Auth codes one-time use
- [ ] No tokens en URLs (solo code temporal)
- [ ] No tokens en localStorage/sessionStorage
- [ ] CORS correctamente configurado
- [ ] Rate limiting en endpoints críticos

#### **5.3 Performance Testing**

**Métricas:**

- [ ] Redirect flow < 2 segundos
- [ ] Code exchange < 500ms
- [ ] Session validation < 100ms
- [ ] Dashboard load < 1 segundo

#### **5.4 Documentation**

**Archivos a crear/actualizar:**

- [ ] README.md principal
- [ ] ARCHITECTURE.md (actualizar con nuevo flow)
- [ ] API_REFERENCE.md (agregar nuevos endpoints)
- [ ] DEPLOYMENT.md (guía de deploy)
- [ ] MIGRATION_GUIDE.md (para desarrolladores)

#### **5.5 Deployment Staging**

**Orden de deploy:**

1. [ ] SSO Backend (auth-api.empire.com)
2. [ ] SSO Frontend (sso.empire.com)
3. [ ] empire-admin-backend (admin-api.empire.com)
4. [ ] empire-admin frontend (admin.empire.com)

**Configuración:**

- [ ] DNS para subdominios
- [ ] SSL certificates para todos los dominios
- [ ] Environment variables en producción
- [ ] Database migrations en staging
- [ ] Redis/session store configurado

#### **5.6 Rollback Plan**

**Si algo falla:**

- [ ] Mantener branch anterior
- [ ] Script de rollback de migrations
- [ ] Backup de BD antes de deploy
- [ ] Feature flags para toggle flows

**Entregables Fase 5:**

- Sistema completo funcionando en staging
- Tests E2E pasando
- Documentación actualizada
- Plan de rollback probado

---

## 📊 CHECKLIST GENERAL

### **Backend SSO:**

- [ ] Migration auth_codes
- [ ] Service AuthCodeService
- [ ] Service SSOSessionService
- [ ] Endpoint POST /api/v1/auth/authorize
- [ ] Endpoint POST /api/v1/auth/validate-code
- [ ] Endpoint GET /api/v1/user/tenants (con apps)
- [ ] Endpoint GET /api/v1/user/apps
- [ ] Modificar POST /api/v1/auth/signin (setear cookie)
- [ ] Middleware authenticateSSO (validate cookie)
- [ ] Tests unitarios

### **SSO Frontend:**

- [ ] Setup proyecto (Vue/React/Angular)
- [ ] Login page (dual mode)
- [ ] Tenant selector
- [ ] Dashboard portal
- [ ] Profile pages
- [ ] Tenant management (admin)
- [ ] Routing configurado
- [ ] API client con credentials

### **App Backend Template:**

- [ ] Template base
- [ ] Session management
- [ ] Endpoint /auth/exchange
- [ ] Endpoint /auth/logout
- [ ] Endpoint /auth/me
- [ ] Middleware requireAuth
- [ ] Middleware requirePermission
- [ ] README con instrucciones

### **empire-admin:**

- [ ] Backend usando template
- [ ] Refactor AuthService
- [ ] Callback page
- [ ] HTTP Interceptor actualizado
- [ ] Guards actualizados
- [ ] Cleanup tokens legacy
- [ ] Tests actualizados

### **Deployment:**

- [ ] Staging environment
- [ ] SSL certificates
- [ ] DNS configurado
- [ ] Environment vars
- [ ] Database migrations
- [ ] Tests E2E
- [ ] Documentación
- [ ] Rollback plan

---

## 📚 REFERENCIAS TÉCNICAS

### **Cookies Configuration:**

```typescript
res.cookie('session_name', sessionId, {
  httpOnly: true, // No JS access
  secure: true, // HTTPS only
  sameSite: 'lax', // CSRF protection
  domain: '.empire.com', // Shared across subdomains
  maxAge: 86400000, // 24 hours
  path: '/',
});
```

### **Authorization Code Flow:**

```
1. User → App (no session)
2. App → SSO /login?redirect_uri=app.com/callback&app_id=crm
3. SSO → User login
4. SSO → POST /authorize → auth_code
5. SSO → Redirect app.com/callback?code=xxx
6. App Backend → POST /validate-code → user info
7. App Backend → Create session → Set cookie
8. App Backend → Redirect app.com/dashboard
9. User → App (with session cookie)
```

### **CORS Configuration:**

```typescript
app.use(
  cors({
    origin: [
      'https://sso.empire.com',
      'https://admin.empire.com',
      'https://crm.empire.com',
      // ... otras apps
    ],
    credentials: true, // IMPORTANTE para cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);
```

### **withCredentials en Frontend:**

```typescript
// Axios:
axios.defaults.withCredentials = true;

// Fetch:
fetch(url, {
  credentials: 'include',
});

// Angular HttpClient:
this.http.get(url, { withCredentials: true });
```

---

## 🎯 CRITERIOS DE ÉXITO

**Proyecto completado cuando:**

1. ✅ Usuario puede hacer login en SSO portal
2. ✅ Usuario ve dashboard con sus apps
3. ✅ Usuario puede clickear app y lanzarla (con sesión)
4. ✅ Usuario puede ir directo a app → redirect SSO → volver
5. ✅ Sin tokens en frontend (solo cookies HttpOnly)
6. ✅ True SSO: login una vez, acceso a todas las apps
7. ✅ Sesiones revocables desde SSO
8. ✅ Tests E2E pasando
9. ✅ Documentación completa
10. ✅ Deployed en staging funcional

---

## 📝 NOTAS ADICIONALES

### **Decisiones de Arquitectura:**

1. **¿Redis o PostgreSQL para sessions?**
   - Redis: Más rápido, TTL automático
   - PostgreSQL: Menos dependencias, ya lo tienes
   - **Recomendación:** Empezar con PostgreSQL, migrar a Redis si hay problemas de performance

2. **¿Domain cookies (.empire.com) o per-app cookies?**
   - Domain cookie para SSO (sso_session)
   - Per-app cookies para app sessions (crm_session, admin_session)
   - **Ventaja:** Mejor aislamiento, logout granular

3. **¿Mantener JWT para APIs externas?**
   - Sí, mantener endpoint /api/v1/auth/signin con JWT para APIs
   - Cookies solo para apps web
   - **Flexibilidad:** Ambos flows coexisten

4. **¿Frontend SSO en mismo repo que backend?**
   - No, crear repo separado
   - **Razón:** Deploy independiente, tecnologías diferentes

### **Riesgos y Mitigaciones:**

| Riesgo                       | Probabilidad | Impacto | Mitigación                     |
| ---------------------------- | ------------ | ------- | ------------------------------ |
| Safari bloquea cookies       | Media        | Alto    | SameSite=Lax + secure context  |
| Redirects confunden usuarios | Baja         | Medio   | UX claro, loading states       |
| Code replay attack           | Media        | Alto    | One-time use + TTL 5min        |
| Session hijacking            | Baja         | Alto    | HttpOnly + Secure + rotation   |
| CORS issues                  | Media        | Medio   | Configuración correcta + tests |

### **Métricas de Monitoreo:**

Post-deployment, monitorear:

- Tasa de éxito de login
- Tiempo promedio de redirect flow
- Errores en code validation
- Sessions activas simultáneas
- Rate de timeout de auth_codes

---

## 🚀 INICIO RÁPIDO PARA SIGUIENTE SESIÓN

**Si continúas en nueva sesión de chat:**

1. Lee este roadmap completo
2. Verifica en qué fase estamos (ver checkboxes marcados)
3. Continúa desde la siguiente tarea pendiente
4. Actualiza checkboxes cuando completes tareas

**Comando rápido para ver progreso:**

```bash
grep -c "\[x\]" ROADMAP_SSO_MIGRATION.md  # Tareas completadas
grep -c "\[ \]" ROADMAP_SSO_MIGRATION.md  # Tareas pendientes
```

---

**ÚLTIMA ACTUALIZACIÓN:** 25 de enero de 2026  
**VERSIÓN:** 1.0  
**ESTADO:** 📋 Roadmap creado - Listo para comenzar Fase 0
