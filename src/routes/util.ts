import { NextFunction, Request, Response, Router } from 'express';
import { countries, genders, maritalStatuses } from '../constants/enums';

const router = Router();

/**
 * GET /api/v1/util/enums/genders
 * Get list of available genders
 *
 * Response: {
 *   genders: [{ value: string, label: string }]
 * }
 */
router.get('/enums/genders', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      genders,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/util/enums/countries
 * Get list of available countries
 *
 * Response: {
 *   countries: [{ code: string, name: string }]
 * }
 */
router.get('/enums/countries', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      countries,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/util/enums/marital_statuses
 * Get list of available marital statuses
 *
 * Response: {
 *   maritalStatuses: [{ value: string, label: string }]
 * }
 */
router.get('/enums/marital_statuses', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      maritalStatuses,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
