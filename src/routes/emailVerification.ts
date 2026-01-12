import { NextFunction, Request, Response, Router } from 'express';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// POST /api/v1/email-verification/send
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError(400, 'Email is required', 'INVALID_INPUT');
    }

    // TODO: Implement send verification email logic
    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/email-verification/verify
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError(400, 'Verification token is required', 'INVALID_INPUT');
    }

    // TODO: Implement verify email token logic
    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
