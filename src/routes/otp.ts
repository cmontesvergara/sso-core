import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { OTP } from '../services/otp';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const generateOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  email: Joi.string().email().required().lowercase().trim(),
});

const verifyOTPSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  token: Joi.string().length(6).required(),
});

const useBackupCodeSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  code: Joi.string().length(8).required().uppercase(),
});

/**
 * POST /api/v1/otp/generate
 * Generate OTP secret and QR code for setup
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = generateOTPSchema.validate(req.body);

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

    // Check if user already has verified OTP
    const existing = await OTP.isOTPEnabled(userId);
    if (existing) {
      res.status(409).json({
        error: 'OTP_ALREADY_ENABLED',
        message: 'User already has OTP enabled',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const setup = await OTP.generateOTPSecret(userId, email);

    logger.info(`OTP setup initiated for user ${userId}`);

    res.status(200).json({
      secret: setup.secret,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
      message: 'OTP secret generated. Scan the QR code and verify with setup endpoint.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/otp/verify
 * Verify OTP token and activate 2FA
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = verifyOTPSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        errors: error.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { userId, token } = value;

    const verified = await OTP.verifyOTP(userId, token);

    if (!verified) {
      res.status(401).json({
        error: 'INVALID_OTP',
        message: 'Invalid OTP token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`OTP verified for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'OTP verified and enabled',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/otp/validate
 * Validate OTP token during login
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = verifyOTPSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        errors: error.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { userId, token } = value;

    const valid = await OTP.validateOTP(userId, token);

    if (!valid) {
      res.status(401).json({
        error: 'INVALID_OTP',
        message: 'Invalid OTP token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`OTP validated for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'OTP token is valid',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/otp/backup-code
 * Use backup code instead of OTP
 */
router.post('/backup-code', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = useBackupCodeSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        errors: error.details,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { userId, code } = value;

    const used = await OTP.useBackupCode(userId, code);

    if (!used) {
      res.status(401).json({
        error: 'INVALID_BACKUP_CODE',
        message: 'Invalid backup code',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Backup code used for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Backup code used successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/otp/disable
 * Disable OTP for user
 */
router.post('/disable', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.body.userId as string) || (req as any).user?.id;

    if (!userId) {
      res.status(400).json({
        error: 'INVALID_USER',
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await OTP.disableOTP(userId);

    logger.info(`OTP disabled for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'OTP disabled',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/otp/status
 * Check if user has OTP enabled
 */
router.get('/status/:userId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: 'INVALID_USER',
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const enabled = await OTP.isOTPEnabled(userId);

    res.status(200).json({
      enabled,
      message: enabled ? 'OTP is enabled' : 'OTP is not enabled',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
