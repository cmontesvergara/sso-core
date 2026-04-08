import { NextFunction, Request, Response, Router } from 'express';
import { authenticateV2AccessToken } from '../../middleware/v2Auth';
import { AppError } from '../../middleware/errorHandler';
import { findRoleByTenantAndName } from '../../repositories/roleRepo.prisma';
import { findApplicationByAppId } from '../../repositories/applicationRepo.prisma';
import { RoleService_Instance } from '../../services/role';

const router = Router();

router.get(
  '/:roleId/permission',
  authenticateV2AccessToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let { roleId } = req.params;
      const appId = req.query.appId as string;
      const userId = req.v2User!.userId;
      const systemRole = req.v2User!.systemRole;
      const tenants = req.v2User!.tenants;

      if (!appId) {
        throw new AppError(400, 'appId query parameter is required', 'MISSING_APP_ID');
      }

      const application = await findApplicationByAppId(appId);
      if (!application || !application.isActive) {
        throw new AppError(404, 'Application not found or inactive', 'APP_NOT_FOUND');
      }

      const isSystemAdmin = ['super_admin', 'system_admin'].includes(systemRole?.toLowerCase());

      if (!isSystemAdmin) {
        const hasAppAccess = tenants.some((t) => t.apps?.includes(appId));
        if (!hasAppAccess) {
          throw new AppError(403, 'Application not accessible for this user', 'APP_NOT_IN_TOKEN');
        }
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(roleId);

      if (!isUuid) {
        const tenant = tenants.find((t) => t.role === roleId && t.apps?.includes(appId));
        if (!tenant) {
          throw new AppError(404, `Role "${roleId}" not found in user's tenants for app "${appId}"`, 'ROLE_NOT_FOUND');
        }

        const roleRecord = await findRoleByTenantAndName(tenant.id, roleId);
        if (!roleRecord) {
          throw new AppError(404, `Role "${roleId}" not found in tenant`, 'ROLE_NOT_FOUND');
        }
        roleId = roleRecord.id;
      }

      const permissions = await RoleService_Instance.getRolePermissions(roleId, userId, systemRole);

      res.json({
        success: true,
        permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;