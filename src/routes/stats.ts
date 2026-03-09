import { NextFunction, Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { authenticateSSO } from '../middleware/ssoAuth';
import { requireSystemAdmin } from '../middleware/ssoSystemAdmin';
import { statsService } from '../services/stats';

const router = Router();

/**
 * GET /api/v1/stats
 * Get aggregated global statistics for the admin dashboard.
 *
 * Requires: SSO session cookie (sso_session)
 * Ext Access: System Admin / Super Admin
 */
router.get(
    '/',
    authenticateSSO,
    requireSystemAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const stats = await statsService.getGlobalStats();

            res.json({
                success: true,
                stats,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
