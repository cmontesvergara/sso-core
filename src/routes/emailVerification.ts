import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { Config } from '../config';
import { Email } from '../services/email';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const verifyEmailSchema = Joi.object({
  token: Joi.string().uuid().required(),
});

const sendVerificationSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  email: Joi.string().email().required().lowercase().trim(),
});

/**
 * POST /api/v1/email-verification/send
 * Send email verification link
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = sendVerificationSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        errors: error.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { userId, email } = value;

    // Initialize email service if not done
    await Email.initialize();

    const appUrl = Config.get('appUrl') || 'http://localhost:4201';
    const callbackUrl = `${appUrl}/auth/verify-email`;

    await Email.sendEmailVerification(userId, email, callbackUrl);

    logger.info(`Email verification sent to ${email}`);

    res.status(200).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/email-verification/verify
 * Verify email token
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = verifyEmailSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        errors: error.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { token } = value;

    // Initialize email service if not done
    await Email.initialize();

    const result = await Email.verifyEmailToken(token);

    if (!result) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired verification token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Email verified for user ${result.userId}`);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      userId: result.userId,
      email: result.email,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
