import { Router } from 'express';
import { AppResourceController } from '../controllers/AppResourceController';

import { RequestHandler } from 'express';
export function createAppResourceRouter(controller: AppResourceController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/', requireAuth, controller.postRoute1);
  router.get('/:appId', requireAuth, controller.getRoute2);
  router.get('/tenant/:tenantId/available', requireAuth, controller.getRoute3);
  return router;
}
