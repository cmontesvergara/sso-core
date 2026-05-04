import { Router } from 'express';
import { RoleController } from '../controllers/RoleController';

import { RequestHandler } from 'express';
export function createRoleRouter(controller: RoleController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/', requireAuth, controller.getRouteAllRoles);
  router.post('/', requireAuth, controller.postRoute1);
  router.get('/tenant/:tenantId', requireAuth, controller.getRoute2);
  router.get('/:roleId', requireAuth, controller.getRoute3);
  router.put('/:roleId', requireAuth, controller.putRoute4);
  router.delete('/:roleId', requireAuth, controller.deleteRoute5);
  router.post('/:roleId/permission', requireAuth, controller.postRoute6);
  router.get('/:roleId/permission', requireAuth, controller.getRoute7);
  router.delete('/:roleId/permission/:permissionId', requireAuth, controller.deleteRoute8);
  router.delete('/:roleId/permission', requireAuth, controller.deleteRoute9);
  return router;
}
