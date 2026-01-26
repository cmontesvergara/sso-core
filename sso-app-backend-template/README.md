# SSO App Backend Template

Template reutilizable para crear backends de aplicaciones que usan el sistema SSO de Empire. Este template implementa la gestión de sesiones basada en cookies HttpOnly y el intercambio de códigos de autorización.

## 📋 Descripción

Este template proporciona todo lo necesario para que una aplicación (frontend) pueda autenticarse con el sistema SSO de Empire:

- **Intercambio de códigos de autorización**: Valida códigos recibidos del SSO y crea sesiones locales
- **Gestión de sesiones**: Almacena sesiones con cookies HttpOnly seguras
- **Endpoints de autenticación**: Login, logout, validación de sesión
- **Middleware de protección**: Para endpoints que requieren autenticación
- **Configuración flexible**: Variables de entorno para adaptarse a cada app

## 🏗️ Arquitectura

```
┌─────────────────┐
│  App Frontend   │ (Angular/React/Vue)
│  localhost:4200 │
└────────┬────────┘
         │ withCredentials: true
         ▼
┌─────────────────┐
│  App Backend    │ (Este template)
│  localhost:4300 │
└────────┬────────┘
         │ Valida códigos
         ▼
┌─────────────────┐
│   SSO Backend   │ (Identity Provider)
│  localhost:3000 │
└─────────────────┘
```

## 🚀 Uso Rápido

### 1. Copiar el template

```bash
# Desde el directorio donde quieres crear tu app backend
cp -r /path/to/sso-app-backend-template my-app-backend
cd my-app-backend
```

### 2. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con los valores de tu aplicación
nano .env
```

**Variables importantes:**

```env
APP_ID=my_app              # ID único de tu app (crm, hr, analytics, etc.)
PORT=4300                  # Puerto del backend
FRONTEND_URL=http://localhost:4200
SSO_BACKEND_URL=http://localhost:3000
COOKIE_NAME=my_app_session # Debe ser único por aplicación
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Ejecutar el servidor

```bash
# Desarrollo con auto-reload
npm run dev

# Producción
npm start
```

## 📁 Estructura del Proyecto

```
sso-app-backend-template/
├── server.js           # Servidor Express principal
├── package.json        # Dependencias
├── .env.example        # Configuración de ejemplo
├── .gitignore         # Archivos ignorados por Git
└── README.md          # Esta documentación
```

## 🔌 Endpoints Disponibles

### Autenticación

#### `POST /api/auth/exchange`

Intercambia un authorization code por una sesión.

**Request:**

```json
{
  "code": "abc123xyz"
}
```

**Response (éxito):**

```json
{
  "success": true,
  "user": {
    "userId": "uuid",
    "tenantId": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Cookie seteada:** `my_app_session` (HttpOnly, 24h)

---

#### `GET /api/auth/session`

Obtiene la sesión actual del usuario autenticado.

**Response (sesión válida):**

```json
{
  "user": {
    "userId": "uuid",
    "tenantId": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "expiresAt": "2026-01-26T12:00:00.000Z"
}
```

**Response (sin sesión):**

```json
{
  "success": false,
  "error": "No session found"
}
```

---

#### `POST /api/auth/logout`

Cierra la sesión del usuario.

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Ejemplo de Endpoint Protegido

#### `GET /api/protected/example`

Ejemplo de endpoint que requiere autenticación.

**Headers:** Cookie con `my_app_session`

**Response:**

```json
{
  "success": true,
  "message": "This is a protected endpoint",
  "user": {
    "userId": "uuid",
    "tenantId": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

### Health Check

#### `GET /health`

Verifica que el servidor está funcionando.

**Response:**

```json
{
  "status": "ok",
  "app": "my_app",
  "timestamp": "2026-01-25T10:30:00.000Z"
}
```

## 🛡️ Middleware de Autenticación

El template incluye un middleware `requireAuth` que puedes usar para proteger tus endpoints:

```javascript
// Importar desde server.js o extraer a módulo separado
function requireAuth(req, res, next) {
  const sessionId = req.cookies[COOKIE_NAME];

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const session = getSession(sessionId);

  if (!session) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({
      success: false,
      error: 'Session expired',
    });
  }

  req.session = session;
  req.user = session.user;
  next();
}

// Usar en tus rutas
app.get('/api/my-protected-endpoint', requireAuth, (req, res) => {
  // req.user contiene la info del usuario
  const { userId, tenantId } = req.user;

  // Tu lógica aquí...
  res.json({ data: 'Protected data' });
});
```

## 🔧 Personalización

### Agregar tus propios endpoints

Simplemente agrega tus rutas después de los endpoints de auth:

```javascript
// En server.js, después de los endpoints existentes

app.get('/api/customers', requireAuth, async (req, res) => {
  const { tenantId } = req.user;

  // Query con filtro de tenant
  const customers = await getCustomers(tenantId);

  res.json({ customers });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const { userId, tenantId } = req.user;
  const orderData = req.body;

  // Crear orden asociada al usuario y tenant
  const order = await createOrder({ ...orderData, userId, tenantId });

  res.json({ order });
});
```

### Cambiar el almacenamiento de sesiones

Por defecto, las sesiones se almacenan en memoria (Map). Para producción, se recomienda usar Redis o PostgreSQL:

**Opción 1: Redis**

```javascript
const redis = require('redis');
const client = redis.createClient();

async function createSession(userData) {
  const sessionId = generateSessionId();
  await client.setEx(
    `session:${sessionId}`,
    86400, // 24 horas
    JSON.stringify(userData)
  );
  return sessionId;
}

async function getSession(sessionId) {
  const data = await client.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

async function deleteSession(sessionId) {
  await client.del(`session:${sessionId}`);
}
```

**Opción 2: PostgreSQL**

```sql
CREATE TABLE app_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

```javascript
async function createSession(userData) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  await prisma.appSession.create({
    data: {
      id: sessionId,
      userId: userData.user.userId,
      tenantId: userData.user.tenantId,
      data: userData,
      expiresAt,
    },
  });

  return sessionId;
}
```

## 🔐 Seguridad

### Cookies HttpOnly

Las cookies se configuran con:

- **httpOnly**: true - JavaScript no puede acceder
- **secure**: true en producción (requiere HTTPS)
- **sameSite**: 'lax' - Protección contra CSRF
- **domain**: Configurable para compartir entre subdominios
- **maxAge**: 24 horas por defecto

### CORS

El servidor acepta requests solo desde `FRONTEND_URL`. En producción, configura el origen correcto:

```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // Importante para cookies
  })
);
```

### Validación de códigos

Los códigos de autorización:

- Son validados con el SSO backend antes de crear sesión
- Son de un solo uso (el SSO los invalida después del primer uso)
- Expiran en 5 minutos
- Están asociados a un tenant y app específicos

## 📝 Integración con Frontend

Tu frontend Angular/React/Vue debe:

### 1. Incluir credentials en requests

**Angular:**

```typescript
this.http
  .post('http://localhost:4300/api/auth/exchange', { code }, { withCredentials: true })
  .subscribe((response) => {
    // Cookie seteada automáticamente
    this.router.navigate(['/dashboard']);
  });
```

**Axios:**

```javascript
axios.defaults.withCredentials = true;

await axios.post('http://localhost:4300/api/auth/exchange', { code });
```

**Fetch:**

```javascript
fetch('http://localhost:4300/api/auth/exchange', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
});
```

### 2. Crear componente de callback

```typescript
// callback.component.ts
ngOnInit() {
  const code = this.route.snapshot.queryParams['code'];

  if (code) {
    this.authService.exchangeCode(code).subscribe(
      () => this.router.navigate(['/dashboard']),
      () => this.redirectToSSO()
    );
  }
}

redirectToSSO() {
  const redirectUri = encodeURIComponent('http://localhost:4200/auth/callback');
  window.location.href =
    `http://localhost:4201?app_id=my_app&redirect_uri=${redirectUri}`;
}
```

### 3. Configurar guard

```typescript
// auth.guard.ts
canActivate(): Observable<boolean> {
  return this.http.get('http://localhost:4300/api/auth/session',
    { withCredentials: true }
  ).pipe(
    map(session => !!session.user),
    catchError(() => {
      this.redirectToSSO();
      return of(false);
    })
  );
}
```

## 🚀 Deployment

### Variables de entorno para producción

```env
APP_ID=my_app
PORT=4300
SSO_BACKEND_URL=https://auth-api.empire.com
FRONTEND_URL=https://my-app.empire.com
COOKIE_NAME=my_app_session
COOKIE_DOMAIN=.empire.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
SESSION_MAX_AGE=86400000
NODE_ENV=production
```

### Consideraciones

1. **HTTPS**: Obligatorio en producción (cookie secure)
2. **Session Store**: Migrar de Map a Redis/PostgreSQL
3. **Logging**: Considerar usar Winston o similar
4. **Monitoring**: Agregar health checks más detallados
5. **Rate Limiting**: Proteger contra ataques de fuerza bruta
6. **Error Handling**: Mejorar manejo de errores para producción

## 📚 Ejemplos de Uso

### Crear backend para CRM

```bash
cp -r sso-app-backend-template crm-backend
cd crm-backend

# .env
APP_ID=crm
PORT=4301
FRONTEND_URL=http://localhost:4202
COOKIE_NAME=crm_session

npm install
npm start
```

### Crear backend para HR

```bash
cp -r sso-app-backend-template hr-backend
cd hr-backend

# .env
APP_ID=hr
PORT=4302
FRONTEND_URL=http://localhost:4203
COOKIE_NAME=hr_session

npm install
npm start
```

## 🐛 Troubleshooting

### Cookie no se está seteando

- Verifica que `withCredentials: true` esté en el frontend
- Verifica que CORS esté configurado con `credentials: true`
- En desarrollo con localhost, usa `COOKIE_DOMAIN=localhost`
- Verifica en DevTools → Application → Cookies

### Session no válida después de exchange

- Revisa logs del servidor para ver el response del SSO
- Verifica que `APP_ID` coincida con el registrado en el SSO
- Verifica que `SSO_BACKEND_URL` sea correcto

### Error de CORS

- Verifica que `FRONTEND_URL` coincida exactamente con el origen
- No uses `*` en producción
- Asegúrate de incluir `credentials: true` en CORS

## 📖 Recursos

- [Documentación SSO Empire](../README.md)
- [Roadmap de Migración](../ROADMAP_SSO_MIGRATION.md)
- [Guía de Arquitectura](../docs-archive/ARCHITECTURE.md)

## 📄 Licencia

MIT © EmpireSoft

---

**Creado:** 25 de enero de 2026  
**Versión:** 1.0.0  
**Mantenido por:** EmpireSoft Team
