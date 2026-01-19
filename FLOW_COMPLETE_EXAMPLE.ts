// ============================================================================
// FLUJO COMPLETO: Frontend → SSO → App Backend → Database
// ============================================================================

/**
 * Este archivo documenta paso a paso qué ocurre cuando un usuario:
 * 1. Hace login en el SSO
 * 2. Obtiene un token JWT
 * 3. Accede a una aplicación cliente (App Backend)
 * 4. Realiza una acción que requiere acceso a datos del tenant
 */

// ============================================================================
// PASO 1: Usuario inicia sesión en el SSO Frontend
// ============================================================================

// URL: https://auth.company.com/login
// El usuario ingresa credenciales

request_1_login = {
  method: 'POST',
  url: 'https://auth.company.com/api/v1/auth/signin',
  body: {
    email: 'john@acme-corp.com',
    password: 'securePassword123'
  }
};

response_1_signin = {
  status: 200,
  body: {
    success: true,
    user: {
      id: 'user_123',
      email: 'john@acme-corp.com',
      firstName: 'John',
      tenants: [
        {
          id: 'tenant_acme_1',
          name: 'Acme Corp',
          role: 'admin'
        },
        {
          id: 'tenant_acme_2',
          name: 'Acme Sales',
          role: 'member'
        }
      ]
    },
    // JWT con información de usuario (sin tenant específico)
    accessToken: 'eyJhbGc...',  // expires_in: 15 min
    refreshToken: 'refresh_...',  // expires_in: 7 days
    expiresIn: 900
  }
};

// ============================================================================
// PASO 2: Frontend selecciona un tenant
// ============================================================================

// El usuario elige trabajar en "Acme Corp" (tenant_acme_1)
// El frontend guarda:
// - localStorage['accessToken'] = 'eyJhbGc...'
// - localStorage['refreshToken'] = 'refresh_...'
// - localStorage['selectedTenant'] = 'tenant_acme_1'
// 
// Y redirige al app backend

// ============================================================================
// PASO 3: Frontend accede a la App Backend
// ============================================================================

// El usuario es redirigido a:
// URL: https://acme-corp.app.company.com/dashboard

// El frontend prepara el request al App Backend:

request_3_app_backend = {
  method: 'GET',
  url: 'https://acme-corp.app.company.com/api/users',
  headers: {
    // Estrategia 1: Del hostname
    // Host: acme-corp.app.company.com
    // → App Backend extrae "acme-corp"
    
    // O Estrategia 2: Header explícito
    'X-Tenant-ID': 'tenant_acme_1',
    
    // O Estrategia 3: Del path
    // URL: /tenant_acme_1/users
    // → App Backend extrae del path
    
    'Authorization': 'Bearer eyJhbGc...',  // JWT del SSO
    'Accept': 'application/json'
  }
};

// ============================================================================
// PASO 4: App Backend procesa el request
// ============================================================================

/**
 * Ejecución en App Backend:
 * 
 * 1. tenantMiddleware intercepta el request
 * 2. Extrae X-Tenant-ID (o del hostname/path)
 * 3. Extrae token JWT del header Authorization
 * 4. Valida el token con SSO Backend
 */

process_4_app_backend = {
  // Sub-paso 4a: Extrae tenantId del request
  tenantId_extracted: 'tenant_acme_1',  // del header o hostname
  
  // Sub-paso 4b: Extrae JWT token
  token_extracted: 'eyJhbGc...',
  
  // Sub-paso 4c: App Backend valida con SSO Backend
  request_4c_to_sso = {
    method: 'POST',
    url: 'https://auth.company.com/api/v1/auth/validate-tenant',
    headers: {
      'Authorization': 'Bearer eyJhbGc...',
      'Content-Type': 'application/json'
    },
    body: {
      tenantId: 'tenant_acme_1'
    }
  };
  
  // SSO Backend verifica:
  // 1. ¿El JWT es válido? (firma RS256)
  // 2. ¿El usuario existe? (SELECT * FROM users WHERE id = 'user_123')
  // 3. ¿El usuario es miembro de tenant_acme_1?
  //    (SELECT * FROM tenant_members WHERE user_id='user_123' AND tenant_id='tenant_acme_1')
  // 4. ¿Cuál es su rol? (SELECT role FROM tenant_members ...)
  // 5. ¿Qué permisos tiene? (SELECT permission FROM roles_permissions ...)
  
  response_4c_from_sso = {
    status: 200,
    body: {
      userId: 'user_123',
      email: 'john@acme-corp.com',
      tenantId: 'tenant_acme_1',
      role: 'admin',
      permissions: [
        'users:read',
        'users:write',
        'users:delete',
        'team:manage',
        'settings:manage',
        // ... todas las permisos del rol admin
      ]
    }
  };
  
  // Sub-paso 4d: App Backend guarda en req.tenant
  req.tenant = {
    userId: 'user_123',
    email: 'john@acme-corp.com',
    tenantId: 'tenant_acme_1',
    role: 'admin',
    permissions: [/* ... */]
  };
  
  // Sub-paso 4e: App Backend configura sesión PostgreSQL
  // SET app.current_tenant_id = 'tenant_acme_1'
  // SET app.current_user_id = 'user_123'
  // (PostgreSQL RLS usará estos valores automáticamente)
};

// ============================================================================
// PASO 5: App Backend ejecuta el endpoint /api/users
// ============================================================================

/**
 * El handler GET /api/users ejecuta:
 */

process_5_handler = {
  // 1. Valida permisos
  has_permission_users_read: true,  // ✓ admin puede leer
  
  // 2. Ejecuta query SQL
  sql_query: `
    SELECT id, email, name, role, status, created_at
    FROM users
    WHERE tenant_id = $1  -- 'tenant_acme_1'
    ORDER BY created_at DESC
    LIMIT 100
  `,
  
  // 3. PostgreSQL RLS añade validación adicional
  // Ejemplo: hay un RLS policy
  rls_policy: `
    CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  `,
  
  // Aunque el SQL tenga "WHERE tenant_id = $1",
  // PostgreSQL también verifica que el usuario tenga permiso
  // (capas de defensa múltiples)
  
  // 4. La query retorna SOLO usuarios de tenant_acme_1
  query_result: [
    {
      id: 'user_a1',
      email: 'alice@acme-corp.com',
      name: 'Alice',
      role: 'member',
      status: 'active',
      created_at: '2024-01-15'
    },
    {
      id: 'user_b2',
      email: 'bob@acme-corp.com',
      name: 'Bob',
      role: 'member',
      status: 'active',
      created_at: '2024-01-14'
    }
  ]
};

// ============================================================================
// PASO 6: App Backend retorna respuesta
// ============================================================================

response_6_to_frontend = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'  // Seguridad: no cachear datos sensibles
  },
  body: {
    success: true,
    tenant: {
      id: 'tenant_acme_1',
      role: 'admin'
    },
    users: [
      {
        id: 'user_a1',
        email: 'alice@acme-corp.com',
        name: 'Alice',
        role: 'member'
      },
      {
        id: 'user_b2',
        email: 'bob@acme-corp.com',
        name: 'Bob',
        role: 'member'
      }
    ],
    count: 2
  }
};

// ============================================================================
// PASO 7: Frontend renderiza los datos
// ============================================================================

// El frontend recibe la respuesta y la renderiza:
// - Tabla con usuarios del tenant
// - Solo muestra datos de tenant_acme_1
// - El usuario no puede ver usuarios de tenant_acme_2 (otros tenant)

// ============================================================================
// ESCENARIO ALTERNATIVO: Usuario intenta acceder a otro tenant
// ============================================================================

/**
 * ¿Qué ocurre si el usuario intenta:
 * 
 * GET https://acme-corp.app.company.com/api/users
 * Headers: {
 *   'X-Tenant-ID': 'tenant_evil_999',  // ← Intenta acceder a otro tenant
 *   'Authorization': 'Bearer eyJhbGc...'
 * }
 */

process_evil_attempt = {
  // 1. App Backend intenta validar con SSO
  request_to_sso = {
    method: 'POST',
    url: 'https://auth.company.com/api/v1/auth/validate-tenant',
    body: {
      tenantId: 'tenant_evil_999'  // Intenta acceder a tenant que NO es miembro
    },
    headers: {
      'Authorization': 'Bearer eyJhbGc...'
    }
  };
  
  // 2. SSO Backend verifica:
  // SELECT * FROM tenant_members
  // WHERE user_id = 'user_123' AND tenant_id = 'tenant_evil_999'
  // → NO ENCONTRADO (0 filas)
  
  response_from_sso = {
    status: 403,
    body: {
      error: 'Forbidden',
      reason: 'User is not a member of this tenant'
    }
  };
  
  // 3. App Backend rechaza el request
  response_to_attacker = {
    status: 403,
    body: {
      error: 'Tenant access denied',
      reason: 'User is not a member of this tenant'
    }
  };
};

// ============================================================================
// ESCENARIO 3: Realizar una acción que requiere permisos específicos
// ============================================================================

/**
 * User John (admin) intenta crear un nuevo usuario en tenant_acme_1
 */

request_create_user = {
  method: 'POST',
  url: 'https://acme-corp.app.company.com/api/users',
  headers: {
    'X-Tenant-ID': 'tenant_acme_1',
    'Authorization': 'Bearer eyJhbGc...',
    'Content-Type': 'application/json'
  },
  body: {
    email: 'newuser@acme-corp.com',
    name: 'New User',
    role: 'member'
  }
};

/**
 * Procesamiento en App Backend:
 * 1. tenantMiddleware valida con SSO
 * 2. Obtenemos: role='admin', permissions=['users:write', ...]
 * 3. requirePermission('users', 'write') middleware chequea
 * 4. ✓ Admin tiene users:write
 * 5. Handler ejecuta INSERT
 */

process_create = {
  // Validaciones ejecutadas:
  step_1: 'tenantMiddleware → SSO validation',
  step_2: `req.tenant = {
    userId: 'user_123',
    role: 'admin',
    permissions: ['users:read', 'users:write', 'users:delete', ...]
  }`,
  step_3: 'requirePermission("users", "write") checks',
  step_4: 'John is admin → has users:write ✓',
  step_5: `INSERT INTO users (tenant_id, email, name, role, created_at, created_by)
    VALUES ('tenant_acme_1', 'newuser@acme-corp.com', 'New User', 'member', NOW(), 'user_123')`,
  step_6: 'PostgreSQL RLS: tenant_id = current_setting(app.current_tenant_id) ✓',
  step_7: 'User created successfully'
};

response_create = {
  status: 201,
  body: {
    success: true,
    user: {
      id: 'user_new_1',
      email: 'newuser@acme-corp.com',
      name: 'New User',
      role: 'member',
      created_at: '2024-01-20'
    }
  }
};

// ============================================================================
// ESCENARIO 4: User con permisos limitados intenta una acción prohibida
// ============================================================================

/**
 * User Alice (member) intenta eliminar un usuario
 * 
 * DELETE /api/users/user_b2
 * Headers: X-Tenant-ID: tenant_acme_1, Authorization: Bearer <token>
 */

process_alice_delete = {
  // 1. tenantMiddleware valida con SSO
  response_from_sso: {
    userId: 'user_a1',  // Alice
    role: 'member',
    permissions: ['users:read', 'team:view']  // ← NO tiene users:delete
  },
  
  // 2. Middleware requirePermission('users', 'delete') chequea
  has_delete_permission: false,
  
  // 3. Middleware rechaza antes de ejecutar el handler
  response_to_alice: {
    status: 403,
    body: {
      error: 'Insufficient permissions',
      required: 'users:delete',
      have: ['users:read', 'team:view']
    }
  }
};

// ============================================================================
// FLUJO DE TIEMPO REAL
// ============================================================================

timeline = `
┌────────────────────────────────────────────────────────────────────────────┐
│ T+0ms    Frontend → SSO Backend: POST /auth/signin                          │
│          Request: { email, password }                                       │
│          Response: { accessToken, refreshToken, tenants }                   │
│                                                                              │
│ T+100ms  Frontend: User selecciona tenant_acme_1                            │
│          localStorage['accessToken'] = 'eyJhbGc...'                         │
│          localStorage['selectedTenant'] = 'tenant_acme_1'                   │
│                                                                              │
│ T+150ms  Frontend → App Backend: GET /api/users                             │
│          Headers: X-Tenant-ID=tenant_acme_1, Authorization=Bearer...        │
│                                                                              │
│ T+160ms  App Backend → SSO Backend: POST /validate-tenant                   │
│          Request: { tenantId: 'tenant_acme_1' }                             │
│          Response: { userId, role, permissions }                            │
│                                                                              │
│ T+200ms  App Backend: tenantMiddleware complete                             │
│          Middleware requirePermission('users', 'read') checks ✓             │
│                                                                              │
│ T+210ms  App Backend: Handler executes query                                │
│          SELECT * FROM users WHERE tenant_id = 'tenant_acme_1'              │
│          PostgreSQL RLS validates tenant isolation                          │
│                                                                              │
│ T+250ms  App Backend → Frontend: Response { users: [...] }                  │
│          Status: 200                                                        │
│          Latency: ~100ms total                                              │
│                                                                              │
│ T+300ms  Frontend: Renders users list in UI                                 │
└────────────────────────────────────────────────────────────────────────────┘
`;

// ============================================================================
// SEGURIDAD EN CAPAS (Defense in Depth)
// ============================================================================

security_layers = `
Capa 1: JWT Signature Verification
  └─ SSO Backend verifica firma RS256 del token
  
Capa 2: User ID Extraction
  └─ Valida que user_id del JWT existe en BD
  
Capa 3: Tenant Membership Check
  └─ SELECT FROM tenant_members WHERE user_id = X AND tenant_id = Y
  
Capa 4: Role & Permissions Check
  └─ Get role from tenant_members
  └─ Get permissions from roles_permissions lookup
  
Capa 5: App Backend Permission Validation
  └─ requirePermission middleware checks req.tenant.permissions
  
Capa 6: PostgreSQL RLS Policy
  └─ WHERE tenant_id = current_setting('app.current_tenant_id')
  
Capa 7: Query-level Filtering
  └─ WHERE tenant_id = $1 en el SQL mismo
  
Resultado: Si UNA capa falla, otros no compensan.
           Múltiples capas = si UNA se explota, otras resisten.
`;

// ============================================================================
// CICLO DE VIDA DE UN JWT
// ============================================================================

jwt_lifecycle = `
┌─────────────────────────────────────────────────────────────────────────┐
│ JWT Lifecycle                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ [Creation]                                                               │
│ User signin → SSO signs JWT with private key                            │
│ JWT exp: 15 minutes                                                      │
│ ↓                                                                         │
│ [Storage]                                                                │
│ Frontend stores in localStorage                                         │
│ ↓                                                                         │
│ [Usage]                                                                  │
│ Every API request: Authorization: Bearer <JWT>                          │
│ SSO Backend: Verify signature using public key                          │
│ ↓                                                                         │
│ [Expiration]                                                             │
│ After 15 minutes: JWT is expired                                        │
│ Frontend catches 401 response                                           │
│ ↓                                                                         │
│ [Refresh]                                                                │
│ Frontend sends refreshToken to SSO                                      │
│ SSO issues new accessToken (+ new expiry)                               │
│ ↓                                                                         │
│ [Logout]                                                                 │
│ Frontend deletes tokens from localStorage                               │
│ SSO Backend adds JWT to blacklist (optional)                            │
│                                                                          │
│ Key Points:                                                              │
│ - accessToken: Short-lived (15 min), used for API requests             │
│ - refreshToken: Long-lived (7 days), used to get new accessToken      │
│ - RS256: Public key verification (no secret needed in App Backend)      │
│ - Tenant: Extracted from X-Tenant-ID, NOT from JWT payload            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
`;

// ============================================================================
// CÓDIGO: Validación con SSO en App Backend (resumen)
// ============================================================================

validation_pseudocode = `
async function tenantMiddleware(req, res, next) {
  // 1. Extract tenantId
  const tenantId = req.headers['x-tenant-id'] || extractFromHostname() || extractFromPath();
  
  // 2. Extract JWT
  const token = req.headers.authorization?.slice(7);
  
  // 3. Call SSO Backend
  const response = await axios.post(
    'https://auth.company.com/api/v1/auth/validate-tenant',
    { tenantId },
    { headers: { Authorization: \`Bearer \${token}\` } }
  );
  
  // 4. Handle response
  if (response.status === 200) {
    // User is member of this tenant
    req.tenant = {
      userId: response.data.userId,
      role: response.data.role,
      permissions: response.data.permissions,
      tenantId
    };
    
    // 5. Set PostgreSQL variables for RLS
    await db.query('SET app.current_tenant_id = $1', [tenantId]);
    
    next();
  } else if (response.status === 403) {
    // User is NOT member of this tenant
    res.status(403).json({ error: 'Access denied' });
  } else {
    // JWT invalid / user not found
    res.status(401).json({ error: 'Unauthorized' });
  }
}
`;

// ============================================================================
// FIN DEL FLUJO
// ============================================================================

export { process_4_app_backend, response_6_to_frontend, security_layers };
