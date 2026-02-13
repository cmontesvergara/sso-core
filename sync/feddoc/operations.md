# SSO Core — Operaciones

## Deploy

### Requisitos de Producción

| Componente | Mínimo | Recomendado |
| :--- | :--- | :--- |
| Node.js | 18 LTS | 20 LTS |
| PostgreSQL | 14 | 16 |
| RAM | 512 MB | 1 GB |
| Disco | 1 GB | 5 GB |

### Docker

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  sso-core:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sso_prod
      POSTGRES_USER: sso_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sso_user -d sso_prod"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

**Comandos de despliegue:**

```bash
# Build y levantar
docker-compose up -d --build

# Ejecutar migraciones
docker-compose exec sso-core npx prisma migrate deploy

# Ejecutar seed
docker-compose exec sso-core npm run seed:complete

# Ver logs
docker-compose logs -f sso-core
```

### Reverse Proxy (Nginx)

```nginx
upstream sso_backend {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl http2;
    server_name sso.empire.com;

    ssl_certificate     /etc/ssl/certs/empire.com.pem;
    ssl_certificate_key /etc/ssl/private/empire.com.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    location / {
        proxy_pass http://sso_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_domain localhost $host;
    }
}

server {
    listen 80;
    server_name sso.empire.com;
    return 301 https://$host$request_uri;
}
```

### Escalado

**Horizontal** — El SSO Core es **stateless** (sesiones en PostgreSQL):

1. Desplegar múltiples instancias del backend
2. Usar load balancer (Nginx, HAProxy, ALB)
3. Configurar pool de conexiones (PgBouncer)

**Vertical:**

1. Aumentar RAM y CPU del servidor
2. Configurar `connection_limit` de Prisma
3. Optimizar PostgreSQL (`shared_buffers`, `work_mem`)

---

## Configuración

### Checklist de Producción

#### Variables de Entorno

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` — string largo y aleatorio (32+ chars)
- [ ] `DB_PASSWORD` — password seguro
- [ ] `COOKIE_DOMAIN` — establecido (ej. `.empire.com`)
- [ ] `CORS_ORIGIN` — solo orígenes de confianza

#### Seguridad

- [ ] Claves RSA generadas y almacenadas de forma segura
- [ ] `PRIVATE_KEY_PATH` apunta a la clave privada
- [ ] `PUBLIC_KEY_PATH` apunta a la clave pública
- [ ] Las claves NO están en el repositorio
- [ ] Rate limiting configurado

#### Base de Datos

- [ ] Migraciones ejecutadas
- [ ] RLS habilitado en tablas sensibles
- [ ] Backups automáticos configurados
- [ ] Connection pooling configurado

#### Red

- [ ] HTTPS habilitado (via reverse proxy)
- [ ] Certificados SSL válidos
- [ ] Firewall — acceso solo a puertos necesarios

### Ejemplo de `.env` de Producción

```bash
DB_HOST=production-db.example.com
DB_PASSWORD=super-secure-password
JWT_SECRET=production-jwt-secret-very-long-and-random
PORT=8080
LOG_LEVEL=error
NODE_ENV=production
COOKIE_DOMAIN=.empire.com
```

### Rate Limiting

| Endpoint | Ventana | Máximo | Propósito |
| :--- | :--- | :--- | :--- |
| `/auth/signup` | 1 hora | 5 | Prevenir creación masiva de cuentas |
| `/auth/signin` | 15 min | 10 | Prevenir brute force |
| `/auth/refresh` | 1 min | 30 | Prevenir abuso de renovación |
| `/auth/signout` | 1 min | 60 | Protección general |

### CORS

```typescript
{
  origin: CORS_ORIGIN,       // Orígenes explícitos (no wildcard)
  credentials: true,         // Permite enviar cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

> Para que las cookies funcionen cross-origin, `origin` NO puede ser `*`. Debe ser un origen explícito.

---

## Monitoreo

### Health Checks

| Endpoint | Método | Propósito |
| :--- | :--- | :--- |
| `/health` | GET | Verificar que el servidor está corriendo |
| `/ready` | GET | Verificar conexión a BD y dependencias |

Ejemplo Docker healthcheck:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Logs

El nivel se controla con `LOG_LEVEL`:

| Nivel | Descripción |
| :--- | :--- |
| `error` | Solo errores críticos |
| `warn` | Errores + advertencias |
| `info` | Operaciones normales |
| `debug` | Detallado para desarrollo |

### Métricas Recomendadas

| Métrica | Descripción |
| :--- | :--- |
| Login attempts / min | Signins exitosos y fallidos |
| Active sessions | Sesiones SSO activas |
| Auth code generation | Códigos de autorización generados |
| Token refresh rate | Frecuencia de renovación de tokens |
| Rate limit hits | Peticiones bloqueadas por rate limiter |
| DB connection pool | Conexiones activas / disponibles |

---

## Alertas

| Alerta | Condición | Severidad |
| :--- | :--- | :--- |
| Health check failed | `/health` retorna error o timeout | Crítica |
| DB connection failure | `/ready` retorna error de conexión | Crítica |
| High rate limit hits | > 50 peticiones bloqueadas / min | Alta |
| Failed login spike | > 20 intentos fallidos / min | Alta |
| Session creation failure | Error al crear sesiones SSO | Alta |
| Disk usage > 80% | Volumen de PostgreSQL | Media |
| Slow queries | Queries > 2s | Media |
| Certificate expiration | SSL < 30 días | Media |

---

## Rollback

### Aplicación

```bash
# Si se desplegó con Docker, volver a la imagen anterior
docker-compose down
docker tag sso-core:latest sso-core:rollback
docker-compose up -d --build  # con imagen anterior

# Si se desplegó sin Docker
git checkout <commit-anterior>
npm install
npx prisma generate
npm run build
pm2 restart sso-core
```

### Migraciones de Base de Datos

```bash
# Revertir la última migración (verificar compatibilidad primero)
npx prisma migrate resolve --rolled-back <migration-name>
```

> **⚠️ Precaución:** Revertir migraciones puede causar pérdida de datos. Siempre verifica los scripts de rollback antes de ejecutar en producción.

### Backups

```bash
# Backup completo
pg_dump -h localhost -U sso_user -d sso_prod > backup_$(date +%Y%m%d).sql

# Backup comprimido
pg_dump -h localhost -U sso_user -d sso_prod | gzip > backup_$(date +%Y%m%d).sql.gz

# Restaurar
gunzip < backup_20260212.sql.gz | psql -h localhost -U sso_user -d sso_prod
```

> **⚠️ Si pierdes la clave privada JWT, todos los tokens existentes se invalidan.** Almacena backups de las claves en un lugar seguro (HSM, Vault, KMS).

---

## Incidentes Comunes

### El servidor no inicia

**Causa:** Campo obligatorio faltante.

```
❌ Configuration validation failed:
   Mandatory field 'jwt.secret' is missing or empty
```

**Solución:**

```bash
export JWT_SECRET="my-secret-key"
```

### Cookies no funcionan cross-origin

**Causa:** `CORS_ORIGIN` con wildcard `*` o `COOKIE_DOMAIN` no configurado.

**Solución:**

```bash
CORS_ORIGIN=https://app.empire.com
COOKIE_DOMAIN=.empire.com
```

### Error de conexión a PostgreSQL

**Causa:** Variables de BD incorrectas o servicio caído.

**Verificación:**

```bash
# Verificar que PostgreSQL está corriendo
pg_isready -h localhost -p 5432

# Verificar health del servicio
curl http://localhost:3000/ready
```

### Tokens JWT inválidos después de deploy

**Causa:** Las claves RSA cambiaron entre despliegues.

**Solución:** Asegurar que `PRIVATE_KEY_PATH` y `PUBLIC_KEY_PATH` apuntan a las mismas claves que firmaron los tokens activos. Si las claves rotaron, los usuarios deben re-autenticarse.

### Rate limiting bloqueando requests legítimos

**Causa:** Límites demasiado restrictivos o múltiples usuarios detrás del mismo IP.

**Solución:** Ajustar los valores en el código o configurar `X-Forwarded-For` en el reverse proxy para identificar IPs reales.
