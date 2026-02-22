import { NextFunction, Request, Response, Router } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { countActiveAppSessionsBySsoToken, deleteAppSession, findAppSessionByToken } from '../repositories/appSessionRepo.prisma';
import { deleteSSOSessionById } from '../repositories/ssoSessionRepo.prisma';

const router = Router();

// GET /api/v1/session/verify
router.get('/verify', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement session verification
    res.json({
      success: true,
      session: {
        userId: req.user?.userId,
        isValid: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/session/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'Refresh token is required', 'INVALID_INPUT');
    }

    // TODO: Implement session refresh logic
    res.json({
      success: true,
      accessToken: 'new-jwt-token',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/session/revoke
router.post('/revoke', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.session?.sessionToken;

    if (sessionToken) {
      // Find the app session first to get the linked ssoSessionId
      const appSession = await findAppSessionByToken(sessionToken);

      if (appSession) {
        // Find and delete the app session
        await deleteAppSession(sessionToken);

        // If a linked SSO session exists, check if it's safe to revoke
        if (appSession.ssoSessionId) {
          try {
            // Check if there are other active apps using this same SSO session
            const activeLinkedApps = await countActiveAppSessionsBySsoToken(appSession.ssoSessionId);

            if (activeLinkedApps === 0) {
              await deleteSSOSessionById(appSession.ssoSessionId);
              console.log(`Global Logout: Revoked SSO Session ${appSession.ssoSessionId} as it was the last active app origin.`);
            } else {
              console.log(`Global Logout Skipped: SSO Session ${appSession.ssoSessionId} still has ${activeLinkedApps} active app(s) linked.`);
            }
          } catch (err) {
            console.warn(`Could not revoke linked SSO Session ${appSession.ssoSessionId}`);
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Session revoked',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
