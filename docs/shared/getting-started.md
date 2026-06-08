---
title: "Primeros Pasos"
---

# Primeros Pasos

Guía completa para levantar BIGSO IdP Core en tu entorno local.

## Prerrequisitos

| Software | Versión Mínima | Notas |
|:---|:---|:---|
| Node.js | 18+ | Recomendado: LTS |
| PostgreSQL | 14+ | O vía Docker |
| Redis | 6+ | Para sesiones y cache |
| npm | 9+ | Incluido con Node.js |
| OpenSSL | 1.1+ | Para generar claves JWT |

## Instalación

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd idp-core
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

Las variables **mínimas** requeridas son:

```bash
# Base de datos (obligatorias)
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=idp_core
DB_USER=postgres
DB_PASSWORD=tu_password

# JWT (obligatorias)
JWT_SECRET=tu-secreto-jwt-minimo-32-caracteres
JWT_ISSUER=bigso.co
JWT_KID=idp-key-2026

# App defaults (obligatorias)
DEFAULT_APP_ID=app-default
DEFAULT_TENANT_ID=tenant-default

# Email (opcional, para desarrollo usa 'ethereal')
EMAIL_PROVIDER=ethereal
```

> [!TIP]
> Consulta la [Guía de Configuración](../configuration) para ver todas las variables disponibles.

### 4. Generar claves RSA para JWT

El sistema utiliza firma asimétrica RS256. Genera el par de claves:

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

> [!WARNING]
> Nunca incluyas las claves privadas en el repositorio. Asegúrate de que `keys/` está en `.gitignore`.

### 5. Iniciar PostgreSQL y Redis

**Con Docker Compose** (recomendado):

```bash
docker-compose up -d postgres redis
```

**Sin Docker** — asegúrate de que PostgreSQL y Redis están corriendo:

```bash
# Crear base de datos
createdb -U postgres idp_core

# Verificar Redis
redis-cli ping  # Debe responder PONG
```

### 6. Ejecutar migraciones

```bash
# Generar cliente Prisma
npm run prisma:generate

# Aplicar migraciones
npm run migrate:up
```

### 7. Ejecutar el seed inicial

Esto crea datos de configuración base:

```bash
npm run seed:complete
```

> [!NOTE]
> El seed crea usuarios y tenants de ejemplo. Revisa la salida para credenciales.

### 8. Iniciar el servidor

**Modo desarrollo con hot-reload:**

```bash
npm run dev:watch:hex
```

El servidor estará disponible en `http://localhost:3567`.

## Verificación

Confirma que el servidor está funcionando:

```bash
# Health check
curl http://localhost:3567/health

# Respuesta esperada:
# { "status": "ok", "timestamp": "..." }

# JWKS endpoint
curl http://localhost:3567/.well-known/jwks.json
```

### Prueba de registro y login

1. **Registrar un usuario:**

```bash
curl -X POST http://localhost:3567/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

2. **Iniciar sesión:**

```bash
curl -X POST http://localhost:3567/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "nuid": "test@example.com",
    "password": "SecurePass123!"
  }'
```

> [!TIP]
> El flag `-c cookies.txt` guarda la cookie `sso_session`. Usa `-b cookies.txt` en peticiones siguientes.

3. **Obtener perfil (con cookie SSO):**

```bash
curl http://localhost:3567/api/v1/user/me \
  -b cookies.txt
```

## Estructura del Proyecto (Arquitectura Hexagonal)

```
idp-core/
├── src-hex/                    # 🏗️ Código fuente principal
│   ├── domain/                 # Entidades, value objects, errores
│   ├── application/            # Casos de uso, DTOs, ports
│   ├── infrastructure/         # Implementaciones (Prisma, Express)
│   ├── interfaces/            # Entry points (HTTP, CLI)
│   └── __tests__/             # Tests por capa
├── docs/shared/               # 📚 Documentación
├── prisma/                    # Schema y migraciones
├── migrations/                # Migraciones SQL adicionales
├── keys/                      # Claves JWT (no versionado)
├── config.yaml                # Configuración centralizada
└── index.ts                   # Entry point
```

### Convenciones de Carpetas

| Capa | Propósito | Regla de Dependencias |
|:---|:---|:---|
| `src-hex/domain/` | Lógica de negocio pura | No importa de ninguna otra capa |
| `src-hex/application/` | Orquestación de casos de uso | Solo importa de `domain/` |
| `src-hex/infrastructure/` | Implementaciones de frameworks | Importa de `application/` y `domain/` |
| `src-hex/interfaces/` | Adaptadores externos | Importa de `infrastructure/` |

## Scripts Útiles

```bash
# Desarrollo
npm run dev:watch:hex      # Modo hexagonal con hot-reload
npm run dev:hex             # Modo hexagonal sin watch

# Build y start
npm run build               # Compilar TypeScript
npm start                   # Iniciar en producción

# Testing
npm test                    # Ejecutar tests
npm run test:watch          # Tests en modo watch

# Database
npm run migrate:create      # Crear nueva migración
npm run migrate:up          # Aplicar migraciones
npm run migrate:down        # Revertir última migración
npm run prisma:generate     # Regenerar cliente Prisma

# Linting y formatting
npm run lint                # Verificar código
npm run lint:fix            # Corregir automáticamente
npm run format              # Formatear con Prettier
```

## Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

```bash
npm run prisma:generate
```

### Error: "JWT verification failed"

```bash
# Regenerar claves
rm keys/*.pem
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

### Error: "Connection refused" PostgreSQL

```bash
# Verificar PostgreSQL
docker-compose ps  # Si usas Docker
pg_isready -h localhost -p 5432
```

### Error: "Redis connection failed"

```bash
# Verificar Redis
redis-cli ping  # Debe responder PONG
```

## Siguientes Pasos

- [Arquitectura](../architecture) — Entiende la arquitectura hexagonal
- [API Reference](../api-reference) — Todos los endpoints disponibles
- [Configuración](../configuration) — Variables de entorno en detalle
- [Integración de Apps](../application-integration) — Conecta tu aplicación

---

*Documentación actualizada para arquitectura hexagonal v2.0*
