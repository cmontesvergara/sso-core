import { Request, Response, NextFunction } from 'express';
import { AdminRoleUseCases } from '../../../application/use-cases/admin/AdminRoleUseCases';

export class RoleController {
  constructor(private readonly roles: AdminRoleUseCases) {}

  /** POST /api/v1/role */
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await this.roles.createRole(req.body, (req as any).userId);
      res.status(201).json({ success: true, role });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/role/:tenantId */
  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await this.roles.getTenantRoles(req.params.tenantId);
      res.json({ success: true, roles, count: roles.length });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/role?tenantId=... */
  getRouteAllRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const roles = await this.roles.getAllRoles(tenantId);
      res.json({ success: true, roles, count: roles.length });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/role/:roleId */
  getRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await this.roles.getRoleById(req.params.roleId);
      res.json({ success: true, role });
    } catch (error) { next(error); }
  };

  /** PUT /api/v1/role/:roleId */
  putRoute4 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await this.roles.updateRole(req.params.roleId, req.body);
      res.json({ success: true, role });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/role/:roleId */
  deleteRoute5 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.roles.deleteRole(req.params.roleId);
      res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) { next(error); }
  };

  /** POST /api/v1/role/:roleId/permissions */
  postRoute6 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const permission = await this.roles.addPermission(req.params.roleId, req.body);
      res.status(201).json({ success: true, permission });
    } catch (error) { next(error); }
  };

  /** GET /api/v1/role/:roleId/permissions */
  getRoute7 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const permissions = await this.roles.getRolePermissions(req.params.roleId);
      res.json({ success: true, permissions, count: permissions.length });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/role/:roleId/permissions/:permissionId */
  deleteRoute8 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.roles.removePermission(req.params.permissionId);
      res.json({ success: true, message: 'Permission removed from role' });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v1/role/:roleId/permissions — by resource/action */
  deleteRoute9 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId, resource, action } = req.body;
      await this.roles.removePermissionByResourceAction(req.params.roleId, applicationId, resource, action);
      res.json({ success: true, message: 'Permission removed from role' });
    } catch (error) { next(error); }
  };
}
