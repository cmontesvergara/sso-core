import argon2 from 'argon2';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { Config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createUser, findUserByEmail } from '../repositories/userRepo.prisma';
import { generateRefreshToken, revokeRefreshTokenPlain, rotateRefreshToken, SessionError } from '../services/session';
// Joi schemas for request validation
const signupSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().trim().max(100).allow(null, ''),
  lastName: Joi.string().trim().max(100).allow(null, ''),
});

const signinSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const signoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
  all: Joi.boolean().optional(),
});

const router = Router();

// Per-endpoint rate limiters
const signupLimiter = rateLimit({ windowMs: Config.get('rateLimit.signup.windowMs', 60 * 60 * 1000), max: Config.get('rateLimit.signup.max', 5), standardHeaders: true, legacyHeaders: false }); // 5 signups per hour
const signinLimiter = rateLimit({ windowMs: Config.get('rateLimit.signin.windowMs', 15 * 60 * 1000), max: Config.get('rateLimit.signin.max', 10), standardHeaders: true, legacyHeaders: false }); // 10 signins per 15 minutes
const refreshLimiter = rateLimit({ windowMs: Config.get('rateLimit.refresh.windowMs', 60 * 1000), max: Config.get('rateLimit.refresh.max', 30), standardHeaders: true, legacyHeaders: false }); // 30 refreshes per minute
const signoutLimiter = rateLimit({ windowMs: Config.get('rateLimit.signout.windowMs', 60 * 1000), max: Config.get('rateLimit.signout.max', 60), standardHeaders: true, legacyHeaders: false });

// POST /api/v1/auth/signup
router.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    // Validate & sanitize input
    const { error, value } = signupSchema.validate({ email, password, firstName, lastName }, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }
    const sanitizedEmail = value.email as string;

    // Check if user already exists
    const existing = await findUserByEmail(sanitizedEmail);
    if (existing) {
      throw new AppError(409, 'User already exists', 'USER_EXISTS');
    }
    const created = await createUser({ email: sanitizedEmail, password, firstName, lastName });
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        userId: created.id,
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signin
router.post('/signin', signinLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    // Validate & sanitize input
    const { error, value } = signinSchema.validate({ email, password }, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }
    const sanitizedEmail = value.email as string;

    // Implement signin: lookup user and verify password
    const user = await findUserByEmail(sanitizedEmail);
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
    const userId = user.id;
    const { token: refreshToken } = await generateRefreshToken(userId, null, { ip: req.ip, ua: req.get('user-agent') || '' });
    // access token will be issued on refresh flow; for now generate short-lived access
    const result = await rotateRefreshToken(refreshToken);
    res.json({ success: true, message: 'Sign in successful', tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signout
router.post('/signout', signoutLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error: signoutErr, value: signoutVal } = signoutSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (signoutErr) {
      const details = signoutErr.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }
    const { refreshToken, all } = signoutVal;
    const revoked = await revokeRefreshTokenPlain(refreshToken, !!all);
    if (!revoked) {
      // token not found — respond success to avoid token probing
      res.json({ success: true, message: 'Sign out successful' });
    } else {
      res.json({ success: true, message: 'Sign out successful' });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error: refreshErr, value: refreshVal } = refreshSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (refreshErr) {
      const details = refreshErr.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      throw new AppError(400, 'Validation failed', 'INVALID_INPUT', details);
    }
    const { refreshToken } = refreshVal;

    try {
      const result = await rotateRefreshToken(refreshToken);
      res.json({ success: true, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresIn: result.expiresIn });
    } catch (err: any) {
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
