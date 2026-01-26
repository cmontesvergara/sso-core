import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { Config } from '../config';
import { refreshSchema, signinSchema, signoutSchema, signupSchema } from '../core/schemas';
import { AppError } from '../middleware/errorHandler';
import { authenticateSSO } from '../middleware/ssoAuth';
import { findTenantMember } from '../repositories/tenantRepo.prisma';
import { findUserById } from '../repositories/userRepo.prisma';
import { AuthenticationService } from '../services/auth';
import { AuthCode } from '../services/authCode';
import { JWT } from '../services/jwt';
import { SessionError } from '../services/session';
import { SSOSession } from '../services/ssoSession';

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
    const result = await authService.signin({
      ...value,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Check if 2FA is required
    if ((result as any).requiresTwoFactor) {
      res.json({
        success: true,
        message: 'Two-factor authentication required',
        requiresTwoFactor: true,
        tempToken: (result as any).tempToken,
      });
      return;
    }

    // Normal signin response with BOTH cookie and tokens
    // Tokens for backward compatibility / API access
    // Cookie for SSO portal / web apps
    
    // Create SSO session
    // Extract userId from JWT (uses 'sub' claim per JWT standard)
    const decoded = JWT.verifyToken(result.accessToken) as any;
    
    const userId = decoded.sub || decoded.userId || decoded.id;
    if (!userId) {
      throw new AppError(500, 'JWT does not contain user identifier', 'INVALID_JWT_PAYLOAD');
    }
    
    const ssoSession = await SSOSession.createSession(
      userId,
      { ip: req.ip, userAgent: req.get('user-agent') }
    );
    
    // Set SSO cookie (shared across all subdomains)
    // In development, don't set domain to allow localhost cookies
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };
    
    // Only set domain in production (for subdomain sharing)
    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    
    res.cookie('sso_session', ssoSession.sessionToken, cookieOptions);

    // For SSO with cookies, don't expose tokens in response
    // Cookie contains session token which is sufficient
    res.json({
      success: true,
      message: 'Sign in successful',
      user: {
        userId: result.userId,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
      }
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

/**
 * POST /api/v1/auth/authorize
 * Generate authorization code for app-initiated SSO
 * 
 * Flow: App detects no session → redirects to SSO → SSO validates session → generates code → redirects back
 * 
 * Request body:
 *   - tenantId: string (which tenant context)
 *   - appId: string (which app is requesting, e.g., 'crm', 'admin')
 *   - redirectUri: string (where to send user back with code)
 * 
 * Response: { success: true, authCode: string, redirectUri: string }
 */
const authorizeSchema = Joi.object({
  tenantId: Joi.string().required(),
  appId: Joi.string().required(),
  redirectUri: Joi.string().uri().required(),
});

router.post('/authorize', authenticateSSO, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { error, value } = authorizeSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    const { tenantId, appId, redirectUri } = value;
    const userId = (req as any).ssoUser.userId; // Set by authenticateSSO middleware

    // Verify user has access to the tenant
    const tenantMember = await findTenantMember(tenantId, userId);
    if (!tenantMember) {
      throw new AppError(403, 'Access denied to tenant', 'TENANT_ACCESS_DENIED');
    }

    // Generate authorization code
    const authCode = await AuthCode.generateAuthCode(
      userId,
      tenantId,
      appId,
      redirectUri
    );

    res.json({
      success: true,
      authCode,
      redirectUri: `${redirectUri}?code=${authCode}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/validate-code
 * Validate authorization code and exchange for user context
 * 
 * This endpoint is called by APP backends (not frontend) after receiving auth code
 * 
 * Request body:
 *   - authCode: string (authorization code from query param)
 *   - appId: string (which app is validating)
 * 
 * Response: {
 *   success: true,
 *   user: { userId, email, fullName },
 *   tenant: { tenantId, name, role }
 * }
 */
const validateCodeSchema = Joi.object({
  authCode: Joi.string().required(),
  appId: Joi.string().required(),
});

router.post('/validate-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { error, value } = validateCodeSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }

    const { authCode, appId } = value;

    // Validate code and get user/tenant context
    // This marks the code as used (one-time use enforcement)
    const codeData = await AuthCode.validateAuthCode(authCode, appId);

    // Fetch full user data
    const user = await findUserById(codeData.userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Get tenant member for role
    const tenantMember = await findTenantMember(codeData.tenantId, codeData.userId);
    if (!tenantMember) {
      throw new AppError(403, 'Access denied to tenant', 'TENANT_ACCESS_DENIED');
    }

    res.json({
      success: true,
      user: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.userStatus === 'active',
      },
      tenant: {
        tenantId: tenantMember.tenantId,
        role: tenantMember.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
