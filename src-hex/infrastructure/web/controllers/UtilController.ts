import { Request, Response, NextFunction } from 'express';
import { maritalStatuses, genders, countries } from '../../../domain/constants/enums';

export class UtilController {
  getRoute1 = (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ genders }); }
    catch (error) { next(error); }
  };

  getRoute2 = (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ countries }); }
    catch (error) { next(error); }
  };

  getRoute3 = (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ maritalStatuses }); }
    catch (error) { next(error); }
  };
}
