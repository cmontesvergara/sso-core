# SSO Core — Onboarding

## Propósito del Sistema

SSO Core es un **Identity Provider (IdP)** centralizado que implementa un flujo de **Authorization Code** inspirado en OAuth 2.0 con cookies HttpOnly.

Proporciona:

- **Autenticación centralizada** — Authorization Code Flow con códigos de un solo uso
- **Multi-tenancy** — Aislamiento de datos con Row-Level Security (RLS) en PostgreSQL
- **RBAC granular** — Roles y permisos por aplicación y por tenant
- **2FA** — Autenticación de dos factores con TOTP y códigos de respaldo
- **Gestión de aplicaciones** — Registro centralizado, control por tenant y acceso por usuario

---

## Dependencias

| Software | Versión Mínima | Notas |
| :--- | :--- | :--- |
| Node.js | 18+ | Recomendado: LTS |
| PostgreSQL | 14+ | O vía Docker |
| npm | 9+ | Incluido con Node.js |
| OpenSSL | 1.1+ | Para generar claves JWT |

### Stack Tecnológico

| Tecnología | Propósito |
| :--- | :--- |
| Node.js + Express 4.18 | Backend API |
| PostgreSQL + Prisma | Base de datos con ORM |
| JWT (RS256) | Tokens de autenticación (firma asimétrica) |
| Argon2 | Hashing de contraseñas |
| Joi | Validación de schemas |
| express-rate-limit | Protección por endpoint |
| Nodemailer / Resend | Verificación y notificaciones |

---

## Instrucciones de Setup

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd sso-core
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Variables mínimas requeridas:

```bash
# Base de datos
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sso_dev
DB_USER=postgres
DB_PASSWORD=tu_password

# JWT (obligatorio)
JWT_SECRET=tu-secreto-seguro-aqui
```

### 4. Generar claves RSA para JWT

El sistema utiliza firma asimétrica RS256:

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

Configurar en `.env`:

```bash
PRIVATE_KEY_PATH=./keys/private.pem
PUBLIC_KEY_PATH=./keys/public.pem
```

> **⚠️ Nunca incluyas las claves privadas en el repositorio.** Asegúrate de que `keys/` está en `.gitignore`.

### 5. Iniciar la base de datos

**Con Docker** (recomendado):

```bash
docker-compose up -d postgres
```

**Sin Docker** — asegúrate de que PostgreSQL está corriendo:

```bash
createdb sso_dev
```

### 6. Ejecutar migraciones

```bash
npm run migrate up
```

### 7. Generar el cliente Prisma

```bash
npx prisma generate
```

### 8. Ejecutar el seed inicial

```bash
npm run seed:complete
```

> El seed crea un usuario SuperAdmin por defecto. Revisa la salida del comando para obtener las credenciales iniciales.

---

## Ejecución Local

```bash
npm run dev
```

Verificar que el servidor está corriendo:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "ok"
}
```

### Prueba rápida de registro y login

**Registrar un usuario:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Iniciar sesión:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "nuid": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Obtener perfil:**

```bash
curl http://localhost:3000/api/v1/user/profile \
  -b cookies.txt
```

---

## Estructura del Proyecto

```
sso-core/
├── src/
│   ├── routes/          # Endpoints de la API
│   ├── services/        # Lógica de negocio
│   ├── repositories/    # Capa de acceso a datos (Prisma)
│   ├── middleware/       # Auth, SSO, error handling
│   ├── config/          # Sistema de configuración
│   └── utils/           # Utilidades (logger, helpers)
├── prisma/
│   └── schema.prisma    # Definición del esquema de BD
├── migrations/          # Migraciones de base de datos
├── keys/                # Claves JWT (no versionado)
└── config.yaml          # Configuración declarativa
```

---

## Configuración Detallada

### Sistema de configuración de tres capas

```
Variables de Entorno (.env) > _value (config.yaml) > _default (config.yaml)
```

### Variables Obligatorias

| Campo | Variable de Entorno | Descripción |
| :--- | :--- | :--- |
| `database.type` | `DB_TYPE` | Tipo de BD (`postgresql`) |
| `database.host` | `DB_HOST` | Host de la base de datos |
| `database.port` | `DB_PORT` | Puerto de la base de datos |
| `database.name` | `DB_NAME` | Nombre de la base de datos |
| `database.user` | `DB_USER` | Usuario de la base de datos |
| `database.password` | `DB_PASSWORD` | Contraseña de la BD |
| `jwt.secret` | `JWT_SECRET` | Secreto para firmar tokens JWT |

### Valores por Defecto

| Campo | Default | Descripción |
| :--- | :--- | :--- |
| `port` | `3567` | Puerto del servidor |
| `host` | `localhost` | Host del servidor |
| `jwt.algorithm` | `HS256` | Algoritmo JWT |
| `access_token_validity` | `3600` | Validez del access token (1h) |
| `refresh_token_validity` | `604800` | Validez del refresh token (7d) |
| `session.expiry_time` | `3600` | Expiración de sesión (1h) |
| `logging.level` | `info` | Nivel de logging |
| `cors.enabled` | `true` | CORS habilitado |

---

## Problemas Comunes

### "Mandatory field missing"

La aplicación no inicia si falta un campo obligatorio. Solución:

```bash
export JWT_SECRET="my-secret-key"
# o
echo "JWT_SECRET=my-secret-key" >> .env
```

### `.env` no se lee

El ConfigManager no carga `.env` automáticamente. Asegúrate de usar `dotenv`:

```typescript
import dotenv from 'dotenv';
dotenv.config();
await Config.load();
```

### Default no se aplica

Si el campo tiene un valor vacío `""` en `config.yaml`, el default no se aplica. Usa `null` o elimina el campo.

---

## Canales de Soporte

| Canal | Propósito |
| :--- | :--- |
| `#sso-core` | Soporte general y consultas |
| Documentación técnica | Arquitectura, API Reference, Database Schema |
| Repositorio | Issues y Pull Requests |
