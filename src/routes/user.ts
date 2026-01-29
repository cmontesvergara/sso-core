import { NextFunction, Response, Router } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { listUserTenants } from '../repositories/tenantRepo.prisma';
import { findUserByIdWithAddresses, updateUserProfile } from '../repositories/userRepo.prisma';

const router = Router();

/**
 * GET /api/v1/user/profile
 * Get authenticated user profile via SSO session cookie
 *
 * Requires: SSO session cookie (sso_session)
 *
 * Response: {
 *   success: true,
 *   user: { userId, email, fullName, phoneNumber, isActive, createdAt }
 * }
 */
router.get(
  '/profile',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).ssoUser.userId;

      const user = await findUserByIdWithAddresses(userId);

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        user: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          secondName: user.secondName,
          lastName: user.lastName,
          secondLastName: user.secondLastName,
          phone: user.phone,
          nuid: user.nuid,
          birthDate: user.birthDate,
          gender: user.gender,
          nationality: user.nationality,
          birthPlace: user.birthPlace,
          placeOfResidence: user.placeOfResidence,
          occupation: user.occupation,
          maritalStatus: user.maritalStatus,
          userStatus: user.userStatus,
          isActive: user.userStatus === 'active',
          createdAt: user.createdAt,
          addresses: user.addresses.map((addr: any) => ({
            id: addr.id,
            country: addr.country,
            province: addr.province,
            city: addr.city,
            detail: addr.detail,
            postalCode: addr.postalCode,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/user/tenants
 * Get all tenants and their apps for the authenticated user
 *
 * Requires: SSO session cookie (sso_session)
 *
 * Response: {
 *   success: true,
 *   tenants: [
 *     {
 *       tenantId: string,
 *       name: string,
 *       role: string,
 *       apps: [
 *         { appId: 'crm', name: 'CRM', url: 'https://crm.empire.com' },
 *         { appId: 'admin', name: 'Admin Panel', url: 'https://admin.empire.com' }
 *       ]
 *     }
 *   ]
 * }
 */
router.get(
  '/tenants',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).ssoUser.userId;

      // Get all tenants for the user (uses listUserTenants from tenantRepo)
      const userTenants = await listUserTenants(userId);

      // Build response with tenant details and apps
      const tenants = userTenants.map((tenant) => {
        // TODO: In the future, fetch actual apps from database
        // For now, return a static list of available apps
        // This should be replaced with a query to an 'apps' or 'tenant_apps' table
        const apps = [
          {
            appId: 'crm',
            name: 'CRM',
            url: `https://crm.${process.env.BASE_DOMAIN || 'empire.com'}`,
            description: 'Customer Relationship Management',
          },
          {
            appId: 'admin',
            name: 'Admin Panel',
            url: `https://apps-admin.${process.env.BASE_DOMAIN || 'empire.com'}`,
            description: 'Administrative Dashboard',
          },
          {
            appId: 'analytics',
            name: 'Analytics',
            url: `https://analytics.${process.env.BASE_DOMAIN || 'empire.com'}`,
            description: 'Business Intelligence & Reporting',
          },
        ];

        return {
          tenantId: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          apps,
        };
      });

      res.json({
        success: true,
        tenants,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/user/profile
 * Update authenticated user profile via SSO session cookie
 *
 * Requires: SSO session cookie (sso_session)
 */
router.put(
  '/profile',
  authenticateSSO,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).ssoUser.userId;
      const {
        firstName,
        secondName,
        lastName,
        secondLastName,
        phone,
        birthDate,
        gender,
        nationality,
        birthPlace,
        placeOfResidence,
        occupation,
        maritalStatus,
        addresses,
      } = req.body;

      // Prepare addresses data if provided
      const addressesData = addresses?.map((addr: any) => ({
        country: addr.country,
        province: addr.state || addr.province,
        city: addr.city,
        detail: addr.street || addr.detail,
        postalCode: addr.postalCode,
      }));

      // Update user profile using repository
      const user = await updateUserProfile(
        userId,
        {
          firstName,
          secondName,
          lastName,
          secondLastName,
          phone,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          gender,
          nationality,
          birthPlace,
          placeOfResidence,
          occupation,
          maritalStatus,
        },
        addressesData
      );

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          secondName: user.secondName,
          lastName: user.lastName,
          secondLastName: user.secondLastName,
          phone: user.phone,
          nuid: user.nuid,
          birthDate: user.birthDate,
          gender: user.gender,
          nationality: user.nationality,
          birthPlace: user.birthPlace,
          placeOfResidence: user.placeOfResidence,
          occupation: user.occupation,
          maritalStatus: user.maritalStatus,
          userStatus: user.userStatus,
          isActive: user.userStatus === 'active',
          createdAt: user.createdAt,
          addresses: user.addresses.map((addr: any) => ({
            id: addr.id,
            country: addr.country,
            province: addr.province,
            city: addr.city,
            detail: addr.detail,
            postalCode: addr.postalCode,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/user/:userId
router.get(
  '/:userId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      // TODO: Implement get user logic
      res.json({
        success: true,
        user: {
          userId,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/user/:userId
router.put(
  '/:userId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { firstName, lastName, email } = req.body;

      // TODO: Implement update user logic
      res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          userId,
          email,
          firstName,
          lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/user/:userId
router.delete(
  '/:userId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      //const { userId } = req.params;

      // TODO: Implement delete user logic
      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
