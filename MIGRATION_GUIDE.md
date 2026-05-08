# Migration Guide: Auth v1 → Auth v2 (Bearer JWT)

**Fecha:** 2026-04-16  
**Versión:** 1.0.0  
**Estado:** En curso  
**Fecha de deprecación v1:** 2026-05-01

---

## 📋 Resumen

BigSo SSO está migrando de autenticación basada en **cookies** (v1) a autenticación basada en **Bearer JWT** (v2). Esta migración mejora:

- ✅ Soporte nativo para PKCE (OAuth 2.1)
- ✅ Tokens JWT con RS256 y JWKS
- ✅ Refresh token rotation con family tracking
- ✅ Mejor soporte para aplicaciones móviles y server-to-server
- ✅ Separación clara entre sesiones web y API

---

## 🗓️ Timeline

| Fecha | Evento |
|-------|--------|
| 2026-04-16 | Anuncio de migración, v2 estable |
| 2026-04-16 | v1 marcado como deprecated (warnings en logs) |
| 2026-05-01 | **v1 será eliminado** |
| 2026-05-15 | Fin de soporte para clientes v1 |

---

## 🔍 ¿Cómo saber si mi aplicación usa v1?

Tu aplicación usa **v1** si:

```javascript
// ❌ Usa cookies directamente
res.cookie('sso_session', token);
const session = req.cookies.sso_session;

// ❌ Llama a endpoints v1
POST /api/v1/auth/signin
POST /api/v1/auth/refresh
POST /api/v1/auth/signout
```

Tu aplicación usa **v2** si:

```javascript
// ✅ Usa Bearer tokens
Authorization: Bearer <token>

// ✅ Llama a endpoints v2
POST /api/v2/auth/login
POST /api/v2/auth/refresh
POST /api/v2/auth/logout
```

---

## 🚀 Pasos de Migración

### Paso 1: Actualizar endpoint de login

**Antes (v1):**
```javascript
// POST /api/v1/auth/signin
const response = await fetch('/api/v1/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Respuesta: cookie sso_session
const { user } = await response.json();
```

**Después (v2):**
```javascript
// POST /api/v2/auth/login
const response = await fetch('/api/v2/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email, 
    password,
    appId: 'my-app-id',      // Requerido en v2
    tenantId: 'tenant-123'   // Requerido en v2
  })
});

const { ssoToken, expiresIn, user } = await response.json();

// Guardar token para usar en requests futuros
localStorage.setItem('access_token', ssoToken);
```

### Paso 2: Usar token en requests API

**Antes (v1):**
```javascript
// Cookie se envía automáticamente
const response = await fetch('/api/v1/users/me');
```

**Después (v2):**
```javascript
// Agregar Bearer token manualmente
const response = await fetch('/api/v2/users/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

### Paso 3: Implementar refresh de token

**Antes (v1):**
```javascript
// Cookie refresh automática
const response = await fetch('/api/v1/auth/refresh', {
  method: 'POST',
  body: JSON.stringify({ refreshToken })
});
```

**Después (v2):**
```javascript
// Refresh con cookie httpOnly (recomendado)
const response = await fetch('/api/v2/auth/refresh', {
  method: 'POST',
  credentials: 'include'  // Envía cookie v2_refresh_token
});

const { tokens } = await response.json();
// tokens.accessToken es el nuevo token
```

### Paso 4: Logout

**Antes (v1):**
```javascript
await fetch('/api/v1/auth/signout', {
  method: 'POST'
});
```

**Después (v2):**
```javascript
await fetch('/api/v2/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});

// Limpiar storage local
localStorage.removeItem('access_token');
```

---

## 📦 Cambios por Endpoint

### Login

| Campo | v1 | v2 | Notas |
|-------|----|----|-------|
| URL | `/api/v1/auth/signin` | `/api/v2/auth/login` | Nuevo nombre |
| Method | POST | POST | Igual |
| Body | `{ email, password }` | `{ email\|nuid, password, appId, tenantId }` | appId y tenantId requeridos |
| Response | `{ user }` + cookie | `{ ssoToken, expiresIn, user }` | Token explícito |

### Refresh

| Campo | v1 | v2 | Notas |
|-------|----|----|-------|
| URL | `/api/v1/auth/refresh` | `/api/v2/auth/refresh` | - |
| Auth | refreshToken en body | Cookie httpOnly | Más seguro |
| Response | `{ accessToken, refreshToken }` | `{ tokens: { accessToken } }` | Estructura anidada |

### Logout

| Campo | v1 | v2 | Notas |
|-------|----|----|-------|
| URL | `/api/v1/auth/signout` | `/api/v2/auth/logout` | Nuevo nombre |
| Auth | Cookie sso_session | Bearer token | Híbrido soportado |

---

## 🛠️ Migración por Framework

### Angular (sso-portal)

```typescript
// 1. Crear interceptor para agregar Bearer token
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = localStorage.getItem('access_token');
    
    if (token && !req.url.includes('/auth/')) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(req);
  }
}

// 2. Registrar en app.module.ts
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ]
})
```

```typescript
// 3. Actualizar auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  login(email: string, password: string) {
    return this.http.post('/api/v2/auth/login', {
      email,
      password,
      appId: environment.appId,
      tenantId: environment.tenantId
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('access_token', response.ssoToken);
      })
    );
  }

  logout() {
    return this.http.post('/api/v2/auth/logout', {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`
      }
    }).pipe(
      tap(() => {
        localStorage.removeItem('access_token');
      })
    );
  }
}
```

### Express (ordamy-middleware)

```javascript
// 1. Actualizar ruta de exchange
app.post('/exchange-v2', async (req, res) => {
  const response = await fetch(`${SSO_URL}/api/v2/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: req.query.code,
      appId: process.env.APP_ID,
      codeVerifier: req.session.codeVerifier
    })
  });

  const { tokens, user } = await response.json();
  
  // Guardar token en sesión
  req.session.accessToken = tokens.accessToken;
});

// 2. Middleware de autenticación
function authenticateToken(req, res, next) {
  const token = req.session?.accessToken || 
                req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, jwksUrl);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### React / Next.js

```typescript
// 1. Crear hook de autenticación
function useAuth() {
  const [token, setToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, appId, tenantId })
    });

    const { ssoToken } = await response.json();
    localStorage.setItem('access_token', ssoToken);
    setToken(ssoToken);
  };

  const logout = async () => {
    await fetch('/api/v2/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    localStorage.removeItem('access_token');
    setToken(null);
  };

  return { token, login, logout };
}

// 2. Configurar fetch global
const originalFetch = window.fetch;
window.fetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('access_token');
  
  if (token && !url.includes('/auth/')) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
  }

  return originalFetch(url, options);
};
```

### Mobile (React Native / Flutter)

```typescript
// React Native - Storage seguro
import * as SecureStore from 'expo-secure-store';

async function storeToken(token: string) {
  await SecureStore.setItemAsync('access_token', token);
}

async function getToken() {
  return await SecureStore.getItemAsync('access_token');
}

// Configurar axios
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## ⚠️ Breaking Changes

### v1 → v2

1. **appId y tenantId son requeridos en login**
   - v1: opcionales (usaba defaults)
   - v2: requeridos explícitamente

2. **Estructura de respuesta cambiada**
   ```json
   // v1
   { "user": {...} }

   // v2
   { "ssoToken": "...", "expiresIn": 900, "user": {...} }
   ```

3. **Refresh token ahora es cookie httpOnly**
   - v1: refreshToken en response JSON
   - v2: Cookie `v2_refresh_token` automática

4. **Logout requiere Bearer token**
   - v1: Cookie automáticamente
   - v2: `Authorization: Bearer <token>` header

---

## 🧪 Testing

### Verificar migración

```bash
# Test login v2
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bigso.com","password":"SecurePass123!","appId":"test-app","tenantId":"tenant-123"}'

# Test endpoint protegido con Bearer
curl http://localhost:3000/api/v2/users/me \
  -H "Authorization: Bearer <tu_token>"

# Test refresh
curl -X POST http://localhost:3000/api/v2/auth/refresh \
  -b "v2_refresh_token=<refresh_token>" \
  --cookie-jar cookies.txt
```

### Checklist de migración

- [ ] Login usa `/api/v2/auth/login`
- [ ] Login envía `appId` y `tenantId`
- [ ] Requests API incluyen `Authorization: Bearer <token>`
- [ ] Refresh usa endpoint v2 con cookies
- [ ] Logout envía Bearer token
- [ ] Tokens se guardan en storage seguro (no localStorage en prod)
- [ ] Interceptor de auth configurado
- [ ] Tests de integración actualizados

---

## 🆘 Soporte

Si encuentras problemas durante la migración:

1. **Revisa los logs**: Los endpoints v1 ahora muestran warnings de deprecación
2. **Verifica el plan**: `/Users/cmontes/.claude/plans/migracion-auth-v1-v2.md`
3. **Memory Bank**: `../memory-bank/patterns-gotchas.md` tiene patrones actualizados

---

## 📚 Recursos Adicionales

- [Plan de Migración](/Users/cmontes/.claude/plans/migracion-auth-v1-v2.md)
- [Memory Bank - Architecture](../memory-bank/architecture.md)
- [Memory Bank - Patterns](../memory-bank/patterns-gotchas.md)
- [OAuth 2.1 Specification](https://oauth.net/2.1/)
- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
