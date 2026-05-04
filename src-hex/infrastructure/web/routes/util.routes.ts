import { Router } from 'express';
import { UtilController } from '../controllers/UtilController';

import { RequestHandler } from 'express';
export function createUtilRouter(controller: UtilController, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/enums/genders', controller.getRoute1);
  router.get('/enums/countries', controller.getRoute2);
  router.get('/enums/marital_statuses', controller.getRoute3);
  return router;
}
