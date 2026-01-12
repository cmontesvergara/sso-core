import { Router } from 'express';

const router = Router();

// API v1 documentation
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      auth: {
        signup: 'POST /api/v1/auth/signup',
        signin: 'POST /api/v1/auth/signin',
        signout: 'POST /api/v1/auth/signout',
        refresh: 'POST /api/v1/auth/refresh',
      },
      session: {
        verify: 'GET /api/v1/session/verify',
        refresh: 'POST /api/v1/session/refresh',
        revoke: 'POST /api/v1/session/revoke',
      },
      user: {
        getUser: 'GET /api/v1/user/:userId',
        updateUser: 'PUT /api/v1/user/:userId',
        deleteUser: 'DELETE /api/v1/user/:userId',
      },
      tenant: {
        createTenant: 'POST /api/v1/tenant',
        getTenant: 'GET /api/v1/tenant/:tenantId',
        updateTenant: 'PUT /api/v1/tenant/:tenantId',
      },
      role: {
        createRole: 'POST /api/v1/role',
        getRole: 'GET /api/v1/role/:roleId',
        addPermission: 'POST /api/v1/role/:roleId/permission',
      },
      emailVerification: {
        send: 'POST /api/v1/email-verification/send',
        verify: 'POST /api/v1/email-verification/verify',
      },
      metadata: {
        setMetadata: 'POST /api/v1/metadata/:userId',
        getMetadata: 'GET /api/v1/metadata/:userId',
        updateMetadata: 'PUT /api/v1/metadata/:userId',
      },
    },
  });
});

export default router;
