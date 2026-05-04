import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';

import { RequestHandler } from 'express';
export function createStatsRouter(controller: StatsController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/', requireAuth, controller.getRoute1);
  return router;
}
