import { Request, Response, NextFunction } from 'express';
import { AdminStatsUseCases } from '../../../application/use-cases/admin/AdminStatsUseCases';

export class StatsController {
  constructor(private readonly stats: AdminStatsUseCases) {}

  getRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.stats.getGlobalStats();
      res.json({ success: true, stats: data });
    } catch (error) { next(error); }
  };
}
