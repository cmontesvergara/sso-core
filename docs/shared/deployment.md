---
title: "Deployment"
---

# Deployment

Guía para desplegar el SSO Core en entornos de staging y producción.

## Requisitos

| Componente | Mínimo | Recomendado |
| :--- | :--- | :--- |
| Node.js | 18 LTS | 20 LTS |
| PostgreSQL | 14 | 16 |
| RAM | 512 MB | 1 GB |
| Disco | 1 GB | 5 GB |

## Docker

### Dockerfile

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

### Docker Compose

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

### Comandos

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

## Checklist de Producción

Antes de deployar a producción, verifica que:

### Variables de Entorno

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` es un string largo y aleatorio (32+ chars)
- [ ] `DB_PASSWORD` es seguro
- [ ] `COOKIE_DOMAIN` establecido (ej. `.empire.com`)
- [ ] `CORS_ORIGIN` solo incluye orígenes de confianza

### Seguridad

- [ ] Claves RSA generadas y almacenadas de forma segura
- [ ] `PRIVATE_KEY_PATH` apunta a la clave privada
- [ ] `PUBLIC_KEY_PATH` apunta a la clave pública
- [ ] Las claves NO están en el repositorio
- [ ] Rate limiting configurado apropiadamente

### Base de Datos

- [ ] Migraciones ejecutadas
- [ ] RLS habilitado en tablas sensibles
- [ ] Backups automáticos configurados
- [ ] Connection pooling configurado

### Red

- [ ] HTTPS habilitado (via reverse proxy)
- [ ] Certificados SSL válidos
- [ ] Firewall configura acceso solo a puertos necesarios

## Reverse Proxy (Nginx)

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

        # Cookie passthrough
        proxy_cookie_domain localhost $host;
    }
}

server {
    listen 80;
    server_name sso.empire.com;
    return 301 https://$host$request_uri;
}
```

## Health Checks

El SSO Core expone endpoints de health check:

| Endpoint | Método | Propósito |
| :--- | :--- | :--- |
| `/health` | GET | Verificar que el servidor está corriendo |
| `/ready` | GET | Verificar conexión a BD y dependencias |

Ejemplo de uso con Docker:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Monitoreo

### Logs

El nivel de logging se controla con `LOG_LEVEL`:

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

## Backups

### Base de Datos

```bash
# Backup completo
pg_dump -h localhost -U sso_user -d sso_prod > backup_$(date +%Y%m%d).sql

# Backup comprimido
pg_dump -h localhost -U sso_user -d sso_prod | gzip > backup_$(date +%Y%m%d).sql.gz

# Restaurar
gunzip < backup_20260212.sql.gz | psql -h localhost -U sso_user -d sso_prod
```

### Claves JWT

> [!CAUTION]
> Si pierdes la clave privada, todos los tokens existentes se invalidan. Almacena backups de las claves en un lugar seguro y separado (HSM, Vault, KMS).

## Escalado

### Horizontal

El SSO Core es **stateless** (las sesiones están en PostgreSQL). Para escalar horizontalmente:

1. Despliega múltiples instancias del backend
2. Usa un load balancer (Nginx, HAProxy, ALB)
3. Configura un pool de conexiones a PostgreSQL (PgBouncer)

### Vertical

Para escalar verticalmente:

1. Aumenta RAM y CPU del servidor
2. Configura `connection_limit` de Prisma
3. Optimiza PostgreSQL (`shared_buffers`, `work_mem`)
