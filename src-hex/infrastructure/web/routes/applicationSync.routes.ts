import { Router } from 'express';
import { ApplicationSyncController } from '../controllers/ApplicationSyncController';

import { RequestHandler } from 'express';
export function createApplicationSyncRouter(controller: ApplicationSyncController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/:appId/sync-resources', requireAuth, controller.postRoute1);
  return router;
}
