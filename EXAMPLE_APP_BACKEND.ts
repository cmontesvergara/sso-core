// ============================================================================
// EJEMPLO: App Backend que usa Tenants del SSO
// ============================================================================
// 
// Esta es una aplicación Express típica (CRM, e-commerce, etc) que:
// 1. Recibe requests de usuarios autenticados vía SSO
// 2. Valida el tenant de cada request
// 3. Filtra datos por tenant automáticamente
// 4. Usa RLS de PostgreSQL para seguridad adicional
//
// ============================================================================

import axios from 'axios';
import express from 'express';
import { Pool } from 'pg';

const app = express();
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SSO_BASE = 'https://auth.company.com';

// ============================================================================
// MIDDLEWARE: Valida JWT y Tenant del SSO Backend
// ============================================================================

interface TenantContext {
  userId: string;
  email: string;
  tenantId: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Middleware 1: Extrae tenantId y valida con SSO
 */
async function tenantMiddleware(req, res, next) {
  try {
    // ─────────────────────────────────────────────────────────────
    // PASO 1: Obtener tenantId (3 estrategias)
    // ─────────────────────────────────────────────────────────────

    let tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      // Alternativa: del hostname
      // acme-corp.app.company.com → acme-corp
      const hostname = req.get('host')?.split('.')[0];
      if (hostname) {
        tenantId = hostname;
      }
    }

    if (!tenantId) {
      // Alternativa: del path
      // /acme-corp/users → acme-corp
      const pathMatch = req.path.match(/^\/([a-z0-9-]+)\//);
      if (pathMatch) {
        tenantId = pathMatch[1];
      }
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing tenant context',
        hint: 'Provide X-Tenant-ID header or use tenant in hostname/path'
      });
    }

    // ─────────────────────────────────────────────────────────────
    // PASO 2: Obtener JWT token
    // ─────────────────────────────────────────────────────────────

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);  // Remove "Bearer "

    // ─────────────────────────────────────────────────────────────
    // PASO 3: Validar token + tenant membership con SSO Backend
    // ─────────────────────────────────────────────────────────────

    try {
      const response = await axios.post(
        `${SSO_BASE}/api/v1/auth/validate-tenant`,
        { tenantId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const { userId, email, role, permissions } = response.data;

      // ─────────────────────────────────────────────────────────────
      // PASO 4: Guardar en request para handlers
      // ─────────────────────────────────────────────────────────────

      req.tenant = {
        userId,
        email,
        tenantId,
        role,
        permissions: permissions || []
      };

      // ─────────────────────────────────────────────────────────────
      // PASO 5: Set PostgreSQL session variable para RLS
      // ─────────────────────────────────────────────────────────────

      await db.query('SET app.current_tenant_id = $1', [tenantId]);
      await db.query('SET app.current_user_id = $1', [userId]);

      next();
    } catch (error: any) {
      if (error.response?.status === 403) {
        return res.status(403).json({
          error: 'Tenant access denied',
          reason: error.response.data.reason
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Middleware 2: Valida permisos específicos para una acción
 */
function requirePermission(resource: string, action: string) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const permission = `${resource}:${action}`;
    const hasPermission = req.tenant.permissions.includes(permission);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        have: req.tenant.permissions
      });
    }

    next();
  };
}

// ============================================================================
// HANDLERS: Endpoints que retornan datos filtrados por tenant
// ============================================================================

/**
 * GET /api/users
 * Retorna usuarios del tenant actual
 */
app.get(
  '/api/users',
  tenantMiddleware,
  requirePermission('users', 'read'),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;

      const result = await db.query(
        `SELECT id, email, name, role, status, created_at
         FROM users
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [tenantId]
      );

      res.json({
        success: true,
        tenant: {
          id: tenantId,
          role: req.tenant!.role
        },
        users: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/users
 * Crea un nuevo usuario en el tenant actual
 */
app.post(
  '/api/users',
  tenantMiddleware,
  requirePermission('users', 'write'),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { email, name, role } = req.body;

      // Validaciones
      if (!email || !name) {
        return res.status(400).json({ error: 'Missing email or name' });
      }

      if (!['admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Insert (con tenant_id automático)
      const result = await db.query(
        `INSERT INTO users (tenant_id, email, name, role, created_at, created_by)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         RETURNING id, email, name, role, created_at`,
        [tenantId, email, name, role, req.tenant!.userId]
      );

      res.status(201).json({
        success: true,
        user: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error.code === '23505') {  // Unique violation
        return res.status(409).json({ error: 'User already exists' });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/users/:userId
 * Obtiene un usuario específico del tenant actual
 */
app.get(
  '/api/users/:userId',
  tenantMiddleware,
  requirePermission('users', 'read'),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { userId } = req.params;

      const result = await db.query(
        `SELECT id, email, name, role, status, created_at, updated_at
         FROM users
         WHERE tenant_id = $1 AND id = $2
         LIMIT 1`,
        [tenantId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/users/:userId
 * Actualiza un usuario del tenant actual
 */
app.put(
  '/api/users/:userId',
  tenantMiddleware,
  requirePermission('users', 'write'),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { userId } = req.params;
      const { name, role, status } = req.body;

      // Verifica que el usuario existe en este tenant
      const existing = await db.query(
        'SELECT id FROM users WHERE tenant_id = $1 AND id = $2',
        [tenantId, userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update
      const result = await db.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             role = COALESCE($2, role),
             status = COALESCE($3, status),
             updated_at = NOW()
         WHERE tenant_id = $4 AND id = $5
         RETURNING id, email, name, role, status, updated_at`,
        [name, role, status, tenantId, userId]
      );

      res.json({
        success: true,
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/users/:userId
 * Elimina un usuario del tenant actual
 */
app.delete(
  '/api/users/:userId',
  tenantMiddleware,
  requirePermission('users', 'delete'),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.tenantId;
      const { userId } = req.params;

      const result = await db.query(
        `DELETE FROM users
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, email`,
        [tenantId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        message: 'User deleted',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/tenant/info
 * Retorna información del tenant actual
 */
app.get(
  '/api/tenant/info',
  tenantMiddleware,
  async (req, res) => {
    try {
      const { tenantId, role, permissions } = req.tenant!;

      res.json({
        success: true,
        tenant: {
          id: tenantId,
          currentUserRole: role,
          permissions
        }
      });
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// STARTUP
// ============================================================================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`App Backend running on port ${PORT}`);
  console.log(`SSO Backend: ${SSO_BASE}`);
  console.log(`Database: ${process.env.DATABASE_URL}`);
});

export default app;
