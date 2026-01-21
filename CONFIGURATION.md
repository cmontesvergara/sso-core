# 🔧 Sistema de Configuración

## Descripción General

El backend de SSO utiliza un **sistema de configuración declarativo** que combina:

1. **`config.yaml`** - Configuración con metadatos por variable
2. **Variables de entorno** (`.env`) - Sobrescribe valores de `config.yaml`
3. **Validación automática** - Verifica campos obligatorios al iniciar

## Prioridad de Configuración

```
Variables de entorno (.env) > _value > _default
```

## Formato de Configuración

Cada variable puede tener tres propiedades:

```yaml
nombre_variable:
  _mandatory: true      # ¿Es obligatoria? (true/false)
  _default: valor       # Valor por defecto si no se define
  _value: valor_actual  # Valor actual/configurado
```

### Sintaxis Simplificada

```yaml
# Variable simple con valor
port:
  _value: 3567

# Variable con default
host:
  _default: localhost
  _value: localhost

# Variable obligatoria
jwt:
  secret:
    _mandatory: true
    _value: my-secret-key

# Variable obligatoria sin valor inicial (debe venir de .env)
database:
  password:
    _mandatory: true
    _value: null
```

## Ejemplos Prácticos

### Ejemplo 1: Variable Opcional con Default

```yaml
port:
  _default: 3567
  _value: 3567
```

- Si `_value` está vacío/null → usa `3567` (default)
- Si existe variable `PORT` en `.env` → usa ese valor
- No es obligatoria, siempre tendrá un valor

### Ejemplo 2: Variable Obligatoria

```yaml
database:
  password:
    _mandatory: true
    _value: '@Password21'
```

- **DEBE** tener un valor (ya sea `_value` o variable de entorno `DB_PASSWORD`)
- Si está vacío → la app NO inicia y muestra error
- `_mandatory: true` garantiza que no se olvide configurar

### Ejemplo 3: Variable Anidada

```yaml
session:
  expiry_time:
    _default: 3600
    _value: 3600
  refresh_threshold:
    _default: 600
    _value: 600
```

Acceso en código: `Config.get('session.expiry_time')` → `3600`

### Ejemplo 4: Arrays y Objetos

```yaml
cors:
  methods:
    _default:
      - GET
      - POST
      - PUT
      - DELETE
    _value:
      - GET
      - POST
      - PUT
      - DELETE
```

## Campos Obligatorios

Campos marcados con `_mandatory: true` que **DEBEN** tener valor:

| Campo | Variable de Entorno | Descripción |
|-------|---------------------|-------------|
| `database.type` | `DB_TYPE` | Tipo de BD (postgresql, mysql) |
| `database.host` | `DB_HOST` | Host de la base de datos |
| `database.port` | `DB_PORT` | Puerto de la base de datos |
| `database.name` | `DB_NAME` | Nombre de la base de datos |
| `database.user` | `DB_USER` | Usuario de la base de datos |
| `database.password` | `DB_PASSWORD` | Contraseña de la BD |
| `jwt.secret` | `JWT_SECRET` | Secreto para firmar tokens JWT |

**Si falta algún campo obligatorio**, la aplicación **NO iniciará**:

```
❌ Configuration validation failed:
   Mandatory field 'jwt.secret' is missing or empty
Configuration validation failed: 1 mandatory field(s) missing
```
## Valores por Defecto

Campos con `_default` que se usan si `_value` está vacío:

| Campo | Default | Descripción |
|-------|---------|-------------|
| `port` | `3567` | Puerto del servidor |
| `host` | `localhost` | Host del servidor |
| `jwt.algorithm` | `HS256` | Algoritmo JWT |
| `access_token_validity` | `3600` | Validez token acceso (1h) |
| `refresh_token_validity` | `604800` | Validez token refresh (7d) |
| `session.expiry_time` | `3600` | Expiración de sesión |
| `logging.level` | `info` | Nivel de logging |
| `cors.enabled` | `true` | CORS habilitado |
| `features.email_verification` | `true` | Verificación email |
| `features.multitenancy` | `true` | Multitenancy |rue` |
| `features.multitenancy` | `true` |

## Variables de Entorno

### Mapeo de Variables

Las variables de entorno sobrescriben los valores del `config.yaml`:

#### Servidor
- `PORT` → `port`
- `HOST` → `host`
- `NODE_ENV` → environment mode

#### Base de Datos
- `DB_TYPE` → `database.type`
- `DB_HOST` → `database.host`
- `DB_PORT` → `database.port`
- `DB_NAME` → `database.name`
- `DB_USER` → `database.user`
- `DB_PASSWORD` → `database.password`
- `DATABASE_URL` → `database.url` (alternativa)

#### JWT
- `JWT_SECRET` → `jwt.secret` ⚠️ **OBLIGATORIO**
- `JWT_ALGORITHM` → `jwt.algorithm`
- `JWT_ISS` → `jwt.iss`
- `JWT_AUD` → `jwt.aud`
- `JWT_KID` → `jwt.kid`
- `PRIVATE_KEY_PATH` → `jwt.private_key_path`
- `PUBLIC_KEY_PATH` → `jwt.public_key_path`

#### Tokens
- `ACCESS_TOKEN_VALIDITY` → `access_token_validity`
- `REFRESH_TOKEN_VALIDITY` → `refresh_token_validity`

#### Logging
- `LOG_LEVEL` → `logging.level`

#### CORS
- `CORS_ORIGIN` → `cors.origin`
- `CORS_CREDENTIALS` → `cors.credentials`
- `CORS_METHODS` → `cors.methods`

#### Rate Limiting
- `RATE_LIMIT_WINDOW_MS` → `rateLimit.windowMs`
- `RATE_LIMIT_MAX` → `rateLimit.max`

## Ejemplos de Uso

### Ejemplo 1: Desarrollo Local

**`config.yaml`:**
```yaml
database:
  type: postgresql
  host: localhost
  port: 5432
  name: sso_dev
  user: dev_user
  password: dev_pass

jwt:
  secret: dev-secret-key
```

**Sin `.env`** → Usa todos los valores de `config.yaml` + defaults

### Ejemplo 2: Producción con Variables de Entorno

**`.env`:**
```bash
DB_HOST=production-db.example.com
DB_PASSWORD=super-secure-password
JWT_SECRET=production-jwt-secret-very-long-and-random
PORT=8080
LOG_LEVEL=error
```

**Resultado:** Sobrescribe solo esos campos específicos, el resto viene de `config.yaml`

### Ejemplo 3: Docker con Secrets

```bash
docker run \
  -e DB_HOST=postgres.internal \
  -e DB_PASSWORD_FILE=/run/secrets/db_password \
## Flujo de Carga

```
┌──────────────────────────────────────────────────┐
│ 1. Cargar y Parsear config.yaml                 │
│    - Lee archivo YAML                            │
│    - Guarda configuración raw                    │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 2. Procesar Configuración                        │
│    - Para cada campo:                            │
│      • Si _value existe y no está vacío → usar   │
│      • Si _value vacío/null → usar _default      │
│    - Construir objeto config final               │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 3. Sobrescribir con Variables de Entorno         │
│    - Lee process.env.*                           │
│    - Sobrescribe valores existentes              │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 4. Validar Campos Obligatorios                   │
│    - Recorre rawConfig buscando _mandatory: true │
│    - Verifica que tengan valor                   │
│    - Si falta alguno → Error y NO inicia         │
│    - Si todos OK → ✅ Continúa                    │
└──────────────────────────────────────────────────┘
```

## Cómo Agregar Configuración

### Agregar Campo Obligatorio

```yaml
mi_seccion:
  campo_nuevo:
    _mandatory: true
    _value: null  # Forzará a definir en .env
```

### Agregar Campo Opcional con Default

```yaml
mi_seccion:
  campo_opcional:
    _default: valor_por_defecto
    _value: valor_por_defecto
```

### Agregar Campo Simple

```yaml
mi_seccion:
  campo_simple:
    _value: mi_valor
```
    api.timeout: 30000  # ← NUEVO
```

2. Si el campo no está definido, usará `30000` automáticamente

## Troubleshooting

### Problema: "Mandatory field missing"

**Solución:** Define el campo en `config.yaml` o en una variable de entorno:

```bash
export JWT_SECRET="my-secret-key"
# o
echo "JWT_SECRET=my-secret-key" >> .env
```

### Problema: Mi `.env` no se está leyendo

**Causa:** El ConfigManager NO carga archivos `.env` automáticamente.

**Solución:** Usa `dotenv` en tu código o Docker:

```typescript
// En src/index.ts
import dotenv from 'dotenv';
dotenv.config();

await Config.load();
```

### Problema: Default no se aplica

**Causa:** El campo tiene un valor vacío `""` en `config.yaml`.

**Solución:** Elimina el campo del `config.yaml` o usa `null`:

```yaml
# ❌ No funciona
port: ""

# ✅ Funciona
# port:  (comentado o eliminado)
```

## API del ConfigManager

```typescript
// Cargar configuración
await Config.load();

// Leer valores
const port = Config.get('port');  // 3567
const dbHost = Config.get('database.host');  // 'localhost'
const unknown = Config.get('unknown.key', 'default');  // 'default'

// Establecer valores (en runtime)
Config.set('logging.level', 'debug');

// Obtener toda la configuración
const allConfig = Config.getAll();
```

## Checklist de Configuración

- [ ] `config.yaml` tiene todos los campos no-sensibles
- [ ] `_validation.mandatory` lista todos los campos críticos
- [ ] `_validation.defaults` tiene valores razonables
- [ ] `.env.example` documenta todas las variables disponibles
- [ ] `.env` está en `.gitignore`
- [ ] Secretos solo en variables de entorno
- [ ] Documentación actualizada para tu equipo

---

**Última actualización:** 20 de enero de 2026
