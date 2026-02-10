import { NextFunction, Request, Response, Router } from 'express';
import axios from 'axios';
import { requireSuperAdmin } from '../middleware/ssoSystemAdmin';
import { authenticateSSO } from '../middleware/ssoAuth';
import { findApplicationByAppId } from '../repositories/applicationRepo.prisma';
import { appResourceService } from '../services/appResource';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/v1/applications/:appId/sync-resources
 * Forces a synchronization of resources from the application's backend
 *
 * Requires: Super Admin privileges
 */
router.post(
    '/:appId/sync-resources',
    authenticateSSO,
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { appId } = req.params;

            // Find application
            const application = await findApplicationByAppId(appId);
            if (!application) {
                throw new AppError(404, 'Application not found', 'APP_NOT_FOUND');
            }

            if (!application.backendUrl) {
                throw new AppError(400, 'Application backend URL not configured', 'BACKEND_URL_MISSING');
            }

            console.log(`🔄 Syncing resources for ${appId} from ${application.backendUrl}...`);

            // Fetch resources from app backend
            // We expect the app to expose GET /api/sso/resources
            // We rely on DNS/IP validation on the app side for security, or we could sign this request
            try {
                const response = await axios.get(`${application.backendUrl}/api/sso/resources`, {
                    timeout: 10000,
                    validateStatus: (status) => status < 500, // Handle 4xx as application errors
                });

                if (response.status !== 200) {
                    throw new AppError(502, `Application returned ${response.status}: ${JSON.stringify(response.data)}`, 'APP_SYNC_FAILED');
                }

                const resources = response.data.resources || response.data; // Handle { resources: [] } or []

                if (!Array.isArray(resources)) {
                    throw new AppError(502, 'Invalid response format from application (expected array of resources)', 'INVALID_APP_RESPONSE');
                }

                // Register resources
                const result = await appResourceService.registerAppResources({
                    appId,
                    resources
                });

                res.json({
                    success: true,
                    message: 'Resources synchronized successfully',
                    count: result.resourcesRegistered,
                    resources: resources
                });
            } catch (axiosError: any) {
                if (axiosError instanceof AppError) throw axiosError;

                console.error('Sync error:', axiosError.message);
                throw new AppError(502, `Failed to connect to application: ${axiosError.message}`, 'APP_CONNECTION_FAILED');
            }

        } catch (error) {
            next(error);
        }
    }
);

export default router;
