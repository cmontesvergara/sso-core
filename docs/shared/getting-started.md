---
title: "Primeros Pasos"
---

# Primeros Pasos

Guía completa para levantar el SSO Core en tu entorno local y verificar que todo funciona.

## Prerrequisitos

| Software | Versión Mínima | Notas |
| :--- | :--- | :--- |
| Node.js | 18+ | Recomendado: LTS |
| PostgreSQL | 14+ | O vía Docker |
| npm | 9+ | Incluido con Node.js |
| OpenSSL | 1.1+ | Para generar claves JWT |

## Instalación

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

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

Las variables mínimas requeridas son:

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

> [!TIP]
> Consulta la [Guía de Configuración](../configuration) para ver todas las variables disponibles, incluyendo las opcionales con sus valores por defecto.

### 4. Generar claves RSA para JWT

El sistema utiliza firma asimétrica RS256. Genera el par de claves:

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

Configura las rutas en `.env`:

```bash
PRIVATE_KEY_PATH=./keys/private.pem
PUBLIC_KEY_PATH=./keys/public.pem
```

> [!WARNING]
> Nunca incluyas las claves privadas en el repositorio. Asegúrate de que `keys/` está en `.gitignore`.

### 5. Iniciar la base de datos

**Con Docker** (recomendado):

```bash
docker-compose up -d postgres
```

**Sin Docker** — asegúrate de que PostgreSQL está corriendo y la base de datos existe:

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

Esto crea las aplicaciones base, roles predeterminados y datos de configuración:

```bash
npm run seed:complete
```

> [!NOTE]
> El seed crea un usuario SuperAdmin por defecto. Revisa la salida del comando para obtener las credenciales iniciales.

### 9. Iniciar el servidor

```bash
npm run dev
```

## Verificación

Confirma que el servidor está funcionando:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "ok"
}
```

### Prueba de registro y login

1. **Registrar un usuario:**

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

2. **Iniciar sesión:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "nuid": "test@example.com",
    "password": "SecurePass123!"
  }'
```

> [!TIP]
> El flag `-c cookies.txt` guarda la cookie `sso_session` para usarla en peticiones posteriores. Para usar la cookie: `-b cookies.txt`.

3. **Obtener perfil (con cookie SSO):**

```bash
curl http://localhost:3000/api/v1/user/profile \
  -b cookies.txt
```

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

## Siguientes Pasos

- [Configuración](../configuration) — Variables de entorno y config.yaml en detalle.
- [Arquitectura](../architecture) — Diagrama de componentes y flujos.
- [API Reference](../api-reference) — Todos los endpoints disponibles.
