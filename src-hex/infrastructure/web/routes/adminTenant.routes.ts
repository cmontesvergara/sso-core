import { Router, RequestHandler } from 'express';
import { AdminTenantController } from '../controllers/AdminTenantController';

export function createAdminTenantRouter(controller: AdminTenantController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/',                                    requireAuth, controller.postRoute1);
  router.get('/',                                     requireAuth, controller.getRoute3);
  router.get('/:tenantId',                            requireAuth, controller.getRoute2);
  router.put('/:tenantId',                            requireAuth, controller.putRoute8);
  router.delete('/:tenantId',                         requireAuth, controller.deleteRoute8b);
  router.post('/:tenantId/members',                   requireAuth, controller.postRoute4);
  router.get('/:tenantId/members',                    requireAuth, controller.getRoute5);
  router.put('/:tenantId/members/:memberId',          requireAuth, controller.putRoute6);
  router.delete('/:tenantId/members/:memberId',       requireAuth, controller.deleteRoute7);
  router.get('/:tenantId/apps',                       requireAuth, controller.getRoute9);
  router.post('/:tenantId/apps',                      requireAuth, controller.postRoute10);
  router.delete('/:tenantId/apps/:applicationId',     requireAuth, controller.deleteRoute11);
  return router;
}
