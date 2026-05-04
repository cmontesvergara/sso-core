import { Router } from 'express';
import { MetadataController } from '../controllers/MetadataController';

import { RequestHandler } from 'express';
export function createMetadataRouter(controller: MetadataController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/:userId', requireAuth, controller.postRoute1);
  router.get('/:userId', requireAuth, controller.getRoute2);
  router.put('/:userId', requireAuth, controller.putRoute3);
  return router;
}
