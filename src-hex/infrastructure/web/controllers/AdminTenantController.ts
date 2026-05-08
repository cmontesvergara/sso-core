import { Request, Response, NextFunction } from 'express';
import { AdminTenantUseCases } from '../../../application/use-cases/admin/AdminTenantUseCases';

export class AdminTenantController {
  constructor(private readonly tenants: AdminTenantUseCases) {}

  /** POST /api/v1/tenant */
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const tenant = await this.tenants.createTenant(req.body, userId);
      res.status(201).json({ success: true, tenant });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/tenant/:tenantId */
  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = await this.tenants.getTenantById(req.params.tenantId);
      res.json({
        success: true,
        tenant: {
          id: tenant.id, name: tenant.name, slug: tenant.slug,
          memberCount: tenant.members.length,
          roleCount:   tenant.roles.length,
          createdAt:   tenant.createdAt,
        },
      });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/tenant */
  getRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const tenants = await this.tenants.getUserTenants(userId);
      res.json({ success: true, tenants, count: tenants.length });
    } catch (error) { next(error); }
  };

  /**
   * POST /api/v1/tenant/:tenantId/members
   * Frontend can send { email, role } or { userId, role }.
   * resolveUserId looks up the user by email when userId is absent.
   */
  postRoute4 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId: bodyUserId, email, role } = req.body;
      const resolvedId = await this.tenants.resolveUserId(bodyUserId, email);
      if (!resolvedId) throw new Error('User not found with provided email or userId');
      const member = await this.tenants.addMember(req.params.tenantId, resolvedId, role);
      res.status(201).json({ success: true, member });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/tenant/:tenantId/members */
  getRoute5 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await this.tenants.getTenantMembers(req.params.tenantId);
      res.json({ success: true, members, count: members.length });
    } catch (error) { next(error); }
  };

  /** PUT /api/v1/tenant/:tenantId/members/:memberId */
  putRoute6 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, memberId } = req.params;
      const updated = await this.tenants.updateMemberRole(tenantId, memberId, req.body.role);
      res.json({ success: true, member: updated });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/tenant/:tenantId/members/:memberId */
  deleteRoute7 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, memberId } = req.params;
      await this.tenants.removeMember(tenantId, memberId);
      res.json({ success: true, message: 'Member removed from tenant' });
    } catch (error) { next(error); }
  };

  /** PUT /api/v1/tenant/:tenantId */
  putRoute8 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = await this.tenants.updateTenant(req.params.tenantId, req.body);
      res.json({ success: true, message: 'Tenant updated successfully', tenant });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/tenant/:tenantId */
  deleteRoute8b = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.tenants.deleteTenant(req.params.tenantId);
      res.json({ success: true, message: 'Tenant deleted successfully' });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/tenant/:tenantId/apps */
  getRoute9 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apps = await this.tenants.getTenantApps(req.params.tenantId);
      res.json({ success: true, applications: apps });
    } catch (error) { next(error); }
  };

  /** POST /api/v1/tenant/:tenantId/apps */
  postRoute10 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.tenants.addAppToTenant(req.params.tenantId, req.body.applicationId);
      res.status(201).json({ success: true });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/tenant/:tenantId/apps/:applicationId */
  deleteRoute11 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.tenants.removeAppFromTenant(req.params.tenantId, req.params.applicationId);
      res.json({ success: true });
    } catch (error) { next(error); }
  };
}
