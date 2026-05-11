import { Request, Response, NextFunction } from 'express';
import { AdminStatsUseCases } from '../../../application/use-cases/admin/AdminStatsUseCases';
import { AuthEventsUseCases } from '../../../application/use-cases/admin/AuthEventsUseCases';

export class StatsController {
  constructor(
    private readonly stats: AdminStatsUseCases,
    private readonly authEvents: AuthEventsUseCases,
  ) {}

  getRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.stats.getGlobalStats();
      res.json({ success: true, stats: data });
    } catch (error) { next(error); }
  };

  /**
   * GET /api/v3/stats/auth-events
   * Query params:
   *   - tenantId (optional) — filter by tenant (via AppSession join)
   *   - userId   (optional) — filter by user
   *   - days     (optional, default 30) — lookback window
   */
  getAuthEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.query['tenantId'] as string | undefined;
      const userId   = req.query['userId']   as string | undefined;
      const days     = parseInt(req.query['days'] as string ?? '30', 10);

      const data = await this.authEvents.getAuthEventSummary({ tenantId, userId, days });
      res.json({ success: true, ...data });
    } catch (error) { next(error); }
  };
}
