import { Request, Response, NextFunction } from 'express';
import { AdminApplicationUseCases } from '../../../application/use-cases/admin/AdminApplicationUseCases';

export class ApplicationsController {
  constructor(private readonly apps: AdminApplicationUseCases) {}

  /** GET /api/v2/applications */
  getRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applications = await this.apps.listApplications(req.query);
      res.json({ success: true, applications });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/applications/:applicationId */
  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const app = await this.apps.getApplicationById(req.params.applicationId);
      if (!app) throw new Error('Application not found');
      res.json({ success: true, application: app });
    } catch (error) { next(error); }
  };

  /** POST /api/v2/applications — create a new global application */
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const application = await this.apps.createApplication(req.body);
      res.status(201).json({ success: true, application });
    } catch (error) { next(error); }
  };

  /** PUT /api/v2/applications/:applicationId — update global app */
  putRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const application = await this.apps.updateApplication(req.params.applicationId, req.body);
      res.json({ success: true, application });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v2/applications/:applicationId — delete global app */
  deleteRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.apps.deleteApplication(req.params.applicationId);
      res.json({ success: true, message: 'Application deleted' });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/applications/tenant/:tenantId */
  getRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantApps = await this.apps.listTenantApps(req.params.tenantId);
      res.json({ success: true, applications: tenantApps });
    } catch (error) { next(error); }
  };

  /** POST /api/v2/applications/tenant/:tenantId */
  postRoute4 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.apps.addAppToTenant(req.params.tenantId, req.body.applicationId);
      res.status(201).json({ success: true });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v2/applications/tenant/:tenantId/:applicationId */
  deleteRoute5 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.apps.removeAppFromTenant(req.params.tenantId, req.params.applicationId);
      res.json({ success: true, message: 'Application removed from tenant successfully' });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/applications/tenant/:tenantId/:applicationId/users */
  getRoute6 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.apps.listUsersWithAppAccess(req.params.tenantId, req.params.applicationId);
      res.json({ success: true, users });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/applications/user/:tenantId/my-apps */
  getRoute7 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const applications = await this.apps.listUserAppsInTenant(userId, req.params.tenantId);
      res.json({ success: true, applications });
    } catch (error) { next(error); }
  };

  /**
   * POST /api/v2/applications/tenant/:tenantId/:applicationId/users  (new hex URL)
   * POST /api/v2/applications/tenant/:tenantId/:applicationId/grant   (alias — legacy frontend)
   */
  postRoute8 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = (req as any).userId;
      const access = await this.apps.grantUserAppAccess({
        userId: req.body.userId, tenantId, applicationId, grantedBy: userId,
      });
      res.status(201).json({ success: true, access });
    } catch (error) { next(error); }
  };

  /** POST /api/v2/applications/tenant/:tenantId/:applicationId/users/bulk */
  postRoute9 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, applicationId } = req.params;
      const userId = (req as any).userId;
      const grants = req.body.userIds.map((uid: string) => ({ userId: uid, tenantId, applicationId, grantedBy: userId }));
      const count = await this.apps.grantBulkAppAccess(grants);
      res.status(201).json({ success: true, message: `Granted access to ${count} users`, count });
    } catch (error) { next(error); }
  };

  /**
   * DELETE /api/v2/applications/tenant/:tenantId/:applicationId/users/:userId  (hex URL)
   * DELETE /api/v2/applications/tenant/:tenantId/:applicationId/revoke/:userId  (alias — legacy frontend)
   */
  deleteRoute10 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.apps.revokeUserAppAccess(req.params.userId, req.params.tenantId, req.params.applicationId);
      res.json({ success: true, message: 'Access revoked successfully' });
    } catch (error) { next(error); }
  };
}
