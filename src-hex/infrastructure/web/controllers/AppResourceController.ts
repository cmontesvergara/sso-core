import { Request, Response, NextFunction } from 'express';
import { AdminAppResourceUseCases } from '../../../application/use-cases/admin/AdminAppResourceUseCases';

export class AppResourceController {
  constructor(private readonly resources: AdminAppResourceUseCases) {}

  /** POST /api/v2/app-resources */
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.resources.registerAppResources(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/app-resources/:appId */
  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resources = await this.resources.getAppResources(req.params.appId);
      res.json({ success: true, resources, count: resources.length });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/app-resources/tenant/:tenantId */
  getRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const resources = await this.resources.getAvailableResourcesForTenant(req.params.tenantId, userId);
      res.json({ success: true, resources, count: resources.length });
    } catch (error) { next(error); }
  };
}
