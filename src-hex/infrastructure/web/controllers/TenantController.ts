import { Request, Response, NextFunction } from 'express';
import { CreateTenantUseCase } from '../../../application/use-cases/tenant/CreateTenantUseCase';
import {
  AddUserToTenantUseCase,
  ChangeUserRoleUseCase,
} from '../../../application/use-cases/tenant/TenantMemberUseCase';
import { GetTenantPublicInfoUseCase } from '../../../application/use-cases/tenant/GetTenantPublicInfoUseCase';

/**
 * TenantController
 * HTTP adapter for tenant management use cases.
 */
export class TenantController {
  constructor(
    private createTenantUseCase: CreateTenantUseCase,
    private addUserToTenantUseCase: AddUserToTenantUseCase,
    private changeUserRoleUseCase: ChangeUserRoleUseCase,
    private getTenantPublicInfoUseCase: GetTenantPublicInfoUseCase
  ) { }

  /**
   * POST /api/v3/tenants
   */
  createTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.createTenantUseCase.execute({
        name: req.body.name,
        slug: req.body.slug,
        createdByUserId: (req as any).userId,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/tenants/:tenantId/members
   */
  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.addUserToTenantUseCase.execute({
        tenantId: req.params.tenantId,
        userId: req.body.userId,
        role: req.body.role ?? 'user',
        requestedByUserId: (req as any).userId,
      });
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v3/tenants/:tenantId/members/:userId/role
   */
  changeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.changeUserRoleUseCase.execute({
        tenantId: req.params.tenantId,
        userId: req.params.userId,
        newRole: req.body.role,
        requestedByUserId: (req as any).userId,
      });
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v3/tenants/:tenantId/info
   */
  getPublicInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantIdStr = req.params.tenantId;
      if (!tenantIdStr) {
        res.status(400).json({ error: 'TenantId is required' });
        return;
      }

      const tenantPublicInfo = await this.getTenantPublicInfoUseCase.execute({ tenantId: tenantIdStr });

      if (!tenantPublicInfo) {
        res.status(404).json({ error: 'Tenant not found or inactive' });
        return;
      }

      res.status(200).json({
        success: true,
        tenant: tenantPublicInfo
      });
    } catch (err) {
      next(err);
    }
  };
}
