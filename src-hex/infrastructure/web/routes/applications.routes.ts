import { Router, RequestHandler } from 'express';
import { ApplicationsController } from '../controllers/ApplicationsController';

export function createApplicationsRouter(controller: ApplicationsController, requireAuth: RequestHandler): Router {
  const router = Router();

  // ── Global app CRUD ───────────────────────────────────────────────────────
  router.get('/',                   requireAuth, controller.getRoute1);
  router.post('/',                  requireAuth, controller.postRoute1);
  router.get('/:applicationId',     requireAuth, controller.getRoute2);
  router.put('/:applicationId',     requireAuth, controller.putRoute1);
  router.delete('/:applicationId',  requireAuth, controller.deleteRoute1);

  // ── Tenant-scoped app management ─────────────────────────────────────────
  // NOTE: specific sub-paths (tenant/, user/) MUST come before /:applicationId to avoid conflicts
  router.get('/tenant/:tenantId',                                          requireAuth, controller.getRoute3);
  router.post('/tenant/:tenantId',                                         requireAuth, controller.postRoute4);
  router.delete('/tenant/:tenantId/:applicationId',                        requireAuth, controller.deleteRoute5);

  // ── User app access ───────────────────────────────────────────────────────
  router.get('/tenant/:tenantId/:applicationId/users',                     requireAuth, controller.getRoute6);
  router.get('/user/:tenantId/my-apps',                                    requireAuth, controller.getRoute7);

  // Grant — new hex URL AND legacy frontend alias
  router.post('/tenant/:tenantId/:applicationId/users',                    requireAuth, controller.postRoute8);
  router.post('/tenant/:tenantId/:applicationId/grant',                    requireAuth, controller.postRoute8); // alias

  // Bulk grant
  router.post('/tenant/:tenantId/:applicationId/users/bulk',               requireAuth, controller.postRoute9);

  // Revoke — new hex URL AND legacy frontend alias
  router.delete('/tenant/:tenantId/:applicationId/users/:userId',          requireAuth, controller.deleteRoute10);
  router.delete('/tenant/:tenantId/:applicationId/revoke/:userId',         requireAuth, controller.deleteRoute10); // alias

  return router;
}
