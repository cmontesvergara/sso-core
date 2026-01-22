import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Config } from '../config';
import { refreshSchema, signinSchema, signoutSchema, signupSchema } from '../core/schemas';
import { AppError } from '../middleware/errorHandler';
import { AuthenticationService } from '../services/auth';
import { SessionError } from '../services/session';

const router = Router();
const authService = AuthenticationService.getInstance();

// Per-endpoint rate limiters
const signupLimiter = rateLimit({
  windowMs: Config.get('rateLimit.signup.windowMs', 60 * 60 * 1000),
  max: Config.get('rateLimit.signup.max', 5),
  standardHeaders: true,
  legacyHeaders: false,
}); // 5 signups per hour
const signinLimiter = rateLimit({
  windowMs: Config.get('rateLimit.signin.windowMs', 15 * 60 * 1000),
  max: Config.get('rateLimit.signin.max', 10),
  standardHeaders: true,
  legacyHeaders: false,
}); // 10 signins per 15 minutes
const refreshLimiter = rateLimit({
  windowMs: Config.get('rateLimit.refresh.windowMs', 60 * 1000),
  max: Config.get('rateLimit.refresh.max', 30),
  standardHeaders: true,
  legacyHeaders: false,
}); // 30 refreshes per minute
const signoutLimiter = rateLimit({
  windowMs: Config.get('rateLimit.signout.windowMs', 60 * 1000),
  max: Config.get('rateLimit.signout.max', 60),
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/v1/auth/signup
router.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = signupSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    // Delegate to service
    const user = await authService.signup(value);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signin
router.post('/signin', signinLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = signinSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    // Delegate to service
    const tokens = await authService.signin({
      ...value,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Sign in successful',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signout
router.post('/signout', signoutLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = signoutSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    // Delegate to service
    await authService.signout(value);

    res.json({ success: true, message: 'Sign out successful' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = refreshSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    // Delegate to service
    try {
      const result = await authService.refresh(value.refreshToken);
      res.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      });
    } catch (err: unknown) {
      if (err instanceof SessionError) {
        throw new AppError(401, err.message, 'INVALID_REFRESH');
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
