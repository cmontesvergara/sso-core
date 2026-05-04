import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminAppResourceUseCases } from '../../../application/use-cases/admin/AdminAppResourceUseCases';

/**
 * ApplicationSyncController
 *
 * Pulls the resource manifest from an app's /api/sso/resources endpoint
 * and registers them via AdminAppResourceUseCases.
 * No src/ imports — AppError replaced with thrown Errors (global handler maps them).
 */
export class ApplicationSyncController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly appResources: AdminAppResourceUseCases,
  ) {}

  /** POST /api/v1/applications/sync/:appId */
  postRoute1 = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appId } = req.params;

      const application = await this.prisma.application.findUnique({ where: { appId } });
      if (!application) throw Object.assign(new Error('Application not found'), { statusCode: 404, code: 'APP_NOT_FOUND' });

      const backendUrl: string | undefined = (application as any).backendUrl;
      if (!backendUrl) throw Object.assign(new Error('Application backend URL not configured'), { statusCode: 400, code: 'BACKEND_URL_MISSING' });

      console.log(`🔄 Syncing resources for ${appId} from ${backendUrl}...`);

      let resources: any[];
      try {
        const response = await axios.get(`${backendUrl}/api/sso/resources`, {
          timeout: 10000,
          validateStatus: (s) => s < 500,
        });

        if (response.status !== 200) {
          throw Object.assign(
            new Error(`Application returned ${response.status}: ${JSON.stringify(response.data)}`),
            { statusCode: 502, code: 'APP_SYNC_FAILED' }
          );
        }

        resources = Array.isArray(response.data) ? response.data : response.data.resources;
        if (!Array.isArray(resources)) {
          throw Object.assign(
            new Error('Invalid response format from application (expected array of resources)'),
            { statusCode: 502, code: 'INVALID_APP_RESPONSE' }
          );
        }
      } catch (axiosErr: any) {
        if (axiosErr.statusCode) throw axiosErr;
        throw Object.assign(
          new Error(`Failed to connect to application: ${axiosErr.message}`),
          { statusCode: 502, code: 'APP_CONNECTION_FAILED' }
        );
      }

      const result = await this.appResources.registerAppResources({ appId, resources });

      res.json({
        success: true,
        message: 'Resources synchronized successfully',
        count: result.length,
        resources,
      });
    } catch (error) {
      next(error);
    }
  };
}
