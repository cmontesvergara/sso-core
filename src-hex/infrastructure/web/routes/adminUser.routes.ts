import { Router, RequestHandler } from 'express';
import { AdminUserController } from '../controllers/AdminUserController';

export function createAdminUserRouter(controller: AdminUserController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/list',             requireAuth, controller.getRoute1);
  router.get('/profile',          requireAuth, controller.getRoute2);
  router.get('/tenants',          requireAuth, controller.getRoute3);
  router.put('/profile',          requireAuth, controller.putRoute4);
  router.put('/:userId/status',   requireAuth, controller.putStatusRoute);        // before /:userId
  router.get('/:userId/tenants',  requireAuth, controller.getTenantsByUserRoute); // before /:userId
  router.get('/:userId',          requireAuth, controller.getRoute5);
  router.put('/:userId',          requireAuth, controller.putRoute6);
  router.delete('/:userId',       requireAuth, controller.deleteRoute7);
  return router;
}
