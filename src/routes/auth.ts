import { NextFunction, Request, Response, Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { generateRefreshToken, rotateRefreshToken, SessionError } from '../services/session';

const router = Router();

// POST /api/v1/auth/signup
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Email and password are required', 'INVALID_INPUT');
    }

    // TODO: Implement signup logic
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        userId: 'generated-id',
        email,
        firstName,
        lastName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signin
router.post('/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Email and password are required', 'INVALID_INPUT');
    }

    // TODO: Implement signin logic -> for now return rotated tokens for demo
    const userId = 'demo-user-id';
    const { token: refreshToken } = await generateRefreshToken(userId, null, { ip: req.ip, ua: req.get('user-agent') || '' });
    // access token will be issued on refresh flow; for now generate short-lived access
    const result = await rotateRefreshToken(refreshToken);
    res.json({ success: true, message: 'Sign in successful', tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/signout
router.post('/signout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement signout logic (invalidate session)
    res.json({
      success: true,
      message: 'Sign out successful',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'Refresh token is required', 'INVALID_INPUT');
    }

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
