import { NextFunction, Response } from 'express';
import { findTenantMember } from '../repositories/tenantRepo.prisma';
import { AuthenticatedRequest } from './auth';
import { AppError } from './errorHandler';

/**
 * Middleware to verify user is an admin of the specified tenant
 * Works with authenticateSSO middleware (uses req.ssoUser)
 * Expects tenantId in req.params
 *
 * Requires: authenticateSSO middleware to run first
 */
export async function requireTenantAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.ssoUser?.userId) {
      throw new AppError(401, 'SSO authentication required', 'UNAUTHORIZED');
    }

    const { tenantId } = req.params;

    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required', 'MISSING_TENANT_ID');
    }

    // System/Super admins have full access to all tenants
    const systemRole = req.ssoUser.systemRole;
    if (systemRole === 'super_admin' || systemRole === 'system_admin') {
      return next();
    }

    // Check if user is member of the tenant
    const membership = await findTenantMember(tenantId, req.ssoUser.userId);

    if (!membership) {
      throw new AppError(403, 'User is not a member of this tenant', 'NOT_TENANT_MEMBER');
    }

    // Check if user has admin role in the tenant
    if (membership.role !== 'admin') {
      throw new AppError(403, 'Tenant admin privileges required', 'INSUFFICIENT_TENANT_PRIVILEGES');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to verify user is a member of the specified tenant (any role)
 * Works with authenticateSSO middleware (uses req.ssoUser)
 * Expects tenantId in req.params
 *
 * Requires: authenticateSSO middleware to run first
 */
export async function requireTenantMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.ssoUser?.userId) {
      throw new AppError(401, 'SSO authentication required', 'UNAUTHORIZED');
    }

    const { tenantId } = req.params;

    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required', 'MISSING_TENANT_ID');
    }

    // System/Super admins have full access to all tenants
    const systemRole = req.ssoUser.systemRole;
    if (systemRole === 'super_admin' || systemRole === 'system_admin') {
      return next();
    }

    // Check if user is member of the tenant
    const membership = await findTenantMember(tenantId, req.ssoUser.userId);

    if (!membership) {
      throw new AppError(403, 'User is not a member of this tenant', 'NOT_TENANT_MEMBER');
    }

    // Store membership info in request for later use
    req.tenantMembership = {
      role: membership.role,
      tenantId: membership.tenantId,
      userId: membership.userId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
