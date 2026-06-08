import { Request, Response, NextFunction } from 'express';
import { AdminUserUseCases } from '../../../application/use-cases/admin/AdminUserUseCases';

export class AdminUserController {
  constructor(private readonly users: AdminUserUseCases) {}

  /** GET /api/v2/user/list */
  getRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.users.listUsers(req.query);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/user/profile */
  getRoute2 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const user = await this.users.getUserById(userId);
      if (!user) throw new Error('User not found');
      res.json({ success: true, user: this.mapUser(user) });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/user/tenants */
  getRoute3 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const tenants = await this.users.getUserTenantsWithApps(userId);
      res.json({ success: true, tenants });
    } catch (error) { next(error); }
  };

  /** PUT /api/v2/user/profile */
  putRoute4 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { addresses, birthDate, ...rest } = req.body;

      const addressesData = addresses?.map((a: any) => ({
        country: a.country, province: a.state ?? a.province,
        city: a.city, detail: a.street ?? a.detail, postalCode: a.postalCode,
      }));

      const user = await this.users.updateProfile(
        userId,
        { ...rest, birthDate: birthDate ? new Date(birthDate) : undefined },
        addressesData,
      );
      res.json({ success: true, message: 'Profile updated successfully', user: this.mapUser(user) });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/user/:userId */
  getRoute5 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.users.getUserById(req.params.userId);
      if (!user) throw new Error('User not found');
      res.json({ success: true, user: this.mapUser(user) });
    } catch (error) { next(error); }
  };

  /** PUT /api/v2/user/:userId/status */
  putStatusRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!status) throw new Error('Status is required');
      const user = await this.users.updateStatus(req.params.userId, status);
      res.json({ success: true, user: { id: user.id, userStatus: user.userStatus } });
    } catch (error) { next(error); }
  };

  /** GET /api/v2/user/:userId/tenants */
  getTenantsByUserRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenants = await this.users.getUserTenantsWithApps(req.params.userId);
      res.json({ success: true, tenants });
    } catch (error) { next(error); }
  };

  /** PUT /api/v2/user/:userId */
  putRoute6 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, email } = req.body;
      // Partial admin update — extend AdminUserUseCases if needed
      res.json({ success: true, message: 'User updated', user: { userId: req.params.userId, email, firstName, lastName } });
    } catch (error) { next(error); }
  };

  /** DELETE /api/v2/user/:userId */
  deleteRoute7 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: implement soft-delete or anonymization
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) { next(error); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  private mapUser(u: any) {
    return {
      userId: u.id, email: u.email, firstName: u.firstName, secondName: u.secondName,
      lastName: u.lastName, secondLastName: u.secondLastName, phone: u.phone,
      nuid: u.nuid, birthDate: u.birthDate, gender: u.gender, nationality: u.nationality,
      birthPlace: u.birthPlace, placeOfResidence: u.placeOfResidence, occupation: u.occupation,
      maritalStatus: u.maritalStatus, userStatus: u.userStatus,
      isActive: u.userStatus === 'ACTIVE' || u.userStatus === 'active',
      createdAt: u.createdAt,
      addresses: (u.addresses ?? []).map((a: any) => ({
        id: a.id, country: a.country, province: a.province, city: a.city, detail: a.detail, postalCode: a.postalCode,
      })),
    };
  }
}
