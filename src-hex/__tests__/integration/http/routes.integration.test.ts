/**
 * Integration tests for the Hexagonal HTTP layer.
 *
 * Strategy:
 *  - Build a lightweight Express app with all routes wired.
 *  - Mock the Container so no real DB / Redis / email connections are needed.
 *  - Use supertest to fire HTTP requests and assert responses.
 *
 * This validates: routing correctness, controller mapping, error handler middleware,
 * and the NUID login path — all at the HTTP boundary level.
 */

import express from 'express';
import request from 'supertest';
import { Router } from 'express';
import { errorHandlerMiddleware } from '@hex/infrastructure/web/middleware/ErrorHandlerMiddleware';
import { AuthController } from '@hex/infrastructure/web/controllers/AuthController';
import { UserController } from '@hex/infrastructure/web/controllers/UserController';
import { PasswordController } from '@hex/infrastructure/web/controllers/PasswordController';
import { createAuthMiddleware } from '@hex/infrastructure/web/middleware/AuthMiddleware';
import { DeviceFingerprint } from '@hex/domain/value-objects/DeviceFingerprint';
import { InvalidCredentialsError } from '@hex/domain/errors/InvalidCredentialsError';
import { UserAlreadyExistsError } from '@hex/domain/errors/UserAlreadyExistsError';

// ── Shared mock tokens ────────────────────────────────────────────────────────

const MOCK_ACCESS_TOKEN  = 'mock.access.token';
const MOCK_REFRESH_TOKEN = 'mock.refresh.token';

// ── Mock use cases ────────────────────────────────────────────────────────────

const loginResult = {
  success: true,
  accessToken: MOCK_ACCESS_TOKEN,
  refreshToken: MOCK_REFRESH_TOKEN,
  expiresIn: 900,
};

const mockLoginUseCase       = { execute: jest.fn().mockResolvedValue(loginResult) };
const mockLogoutUseCase      = { execute: jest.fn().mockResolvedValue(undefined) };
const mockRefreshUseCase     = { execute: jest.fn().mockResolvedValue(loginResult) };
const mockExchangeUseCase    = { execute: jest.fn().mockResolvedValue(loginResult) };
const mockRegisterUseCase    = { execute: jest.fn().mockResolvedValue({ id: 'user-1', email: 'new@bigso.co', userStatus: 'pending', firstName: 'Ana', lastName: 'García', fullName: 'Ana García', tenantMemberships: [], createdAt: new Date(), lastLoginAt: null }) };
const mockUpdateProfileUC    = { execute: jest.fn().mockResolvedValue({ success: true, userId: 'user-1' }) };
const mockChangePasswordUC   = { execute: jest.fn().mockResolvedValue(undefined) };
const mockVerifyEmailUC      = { execute: jest.fn().mockResolvedValue({ success: true }) };
const mockForgotPasswordUC   = { execute: jest.fn().mockResolvedValue(undefined) };
const mockResetPasswordUC    = { execute: jest.fn().mockResolvedValue(undefined) };
const mockVerifySessionUC    = {
  execute: jest.fn().mockResolvedValue({
    valid: true,
    userId: 'user-1',
    sessionId: 'session-1',
    role: 'user',
  }),
};

// ── Build minimal Express app ─────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());

  const router = Router();

  const authController = new AuthController(
    mockLoginUseCase as any,
    mockLogoutUseCase as any,
    mockRefreshUseCase as any,
    mockExchangeUseCase as any,
    { execute: jest.fn() } as any  // mockAuthorizeUseCase stub
  );

  const userController = new UserController(
    mockRegisterUseCase as any,
    mockUpdateProfileUC as any,
    mockChangePasswordUC as any,
    mockVerifyEmailUC as any
  );

  const passwordController = new PasswordController(
    mockForgotPasswordUC as any,
    mockResetPasswordUC as any
  );

  const requireAuth = createAuthMiddleware(mockVerifySessionUC as any);

  // Public
  router.post('/auth/login',           authController.login);
  router.post('/auth/refresh',         authController.refresh);
  router.post('/auth/forgot-password', passwordController.forgotPassword);
  router.post('/auth/reset-password',  passwordController.resetPassword);
  router.post('/users/register',       userController.register);
  router.get('/users/verify-email',    userController.verifyEmail);

  // Protected
  router.post('/auth/logout',               requireAuth, authController.logout);
  router.patch('/users/profile',            requireAuth, userController.updateProfile);
  router.post('/users/change-password',     requireAuth, userController.changePassword);

  app.use('/api/v3', router);
  app.use(errorHandlerMiddleware);

  return app;
}

const app = buildApp();

// ── Test suites ───────────────────────────────────────────────────────────────

describe('POST /api/v3/auth/login', () => {
  beforeEach(() => jest.resetAllMocks());

  it('200 — returns tokens on valid email + password', async () => {
    mockLoginUseCase.execute.mockResolvedValue(loginResult);

    const res = await request(app)
      .post('/api/v3/auth/login')
      .send({ email: 'user@bigso.co', password: 'StrongPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe(MOCK_ACCESS_TOKEN);
    expect(res.body.refreshToken).toBe(MOCK_REFRESH_TOKEN);
  });

  it('200 — accepts NUID instead of email', async () => {
    mockLoginUseCase.execute.mockResolvedValue(loginResult);

    const res = await request(app)
      .post('/api/v3/auth/login')
      .send({ nuid: 'N123456', password: 'StrongPass123!' });

    expect(res.status).toBe(200);
    // Verify use case received nuid field
    const callArgs = mockLoginUseCase.execute.mock.calls[0][0];
    expect(callArgs.nuid).toBe('N123456');
    expect(callArgs.email).toBeUndefined();
  });

  it('401 — returns error when use case throws InvalidCredentialsError', async () => {
    mockLoginUseCase.execute.mockRejectedValueOnce(new InvalidCredentialsError());

    const res = await request(app)
      .post('/api/v3/auth/login')
      .send({ email: 'bad@bigso.co', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('400 — does not crash on empty body', async () => {
    mockLoginUseCase.execute.mockRejectedValueOnce(new InvalidCredentialsError());

    const res = await request(app)
      .post('/api/v3/auth/login')
      .send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /api/v3/auth/refresh', () => {
  beforeEach(() => jest.resetAllMocks());

  it('200 — returns new tokens on valid refresh token', async () => {
    mockRefreshUseCase.execute.mockResolvedValue(loginResult);

    const res = await request(app)
      .post('/api/v3/auth/refresh')
      .send({ refreshToken: 'valid.refresh.token', tenantId: 't-1', appId: 'crm' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe(MOCK_ACCESS_TOKEN);
  });
});

describe('POST /api/v3/users/register', () => {
  const registerResult = {
    id: 'user-1',
    email: 'new@bigso.co',
    userStatus: 'pending',
    firstName: 'Ana',
    lastName: 'García',
    fullName: 'Ana García',
    tenantMemberships: [],
    createdAt: new Date(),
    lastLoginAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockRegisterUseCase.execute.mockResolvedValue(registerResult);
  });

  it('201 — creates user and returns profile', async () => {
    const res = await request(app)
      .post('/api/v3/users/register')
      .send({ email: 'new@bigso.co', password: 'StrongPass123!', firstName: 'Ana', lastName: 'García' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@bigso.co');
    expect(res.body.userStatus).toBe('pending');
  });

  it('409 — returns conflict when use case throws UserAlreadyExistsError', async () => {
    mockRegisterUseCase.execute.mockRejectedValueOnce(new UserAlreadyExistsError('new@bigso.co'));

    const res = await request(app)
      .post('/api/v3/users/register')
      .send({ email: 'new@bigso.co', password: 'StrongPass123!', firstName: 'Ana', lastName: 'García' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/v3/auth/forgot-password', () => {
  beforeEach(() => jest.resetAllMocks());

  it('204 — always returns 204 (anti-enumeration)', async () => {
    const res = await request(app)
      .post('/api/v3/auth/forgot-password')
      .send({ email: 'any@email.com' });

    expect(res.status).toBe(204);
  });
});

describe('POST /api/v3/auth/reset-password', () => {
  beforeEach(() => jest.resetAllMocks());

  it('204 — returns 204 on valid reset', async () => {
    const res = await request(app)
      .post('/api/v3/auth/reset-password')
      .send({ token: 'RESET_valid-token', newPassword: 'NewPass123!' });

    expect(res.status).toBe(204);
  });
});

describe('GET /api/v3/health (404 — not in this router)', () => {
  it('404 — unknown route returns not found JSON', async () => {
    const res = await request(app).get('/api/v3/unknown-route');
    // Express default 404
    expect(res.status).toBe(404);
  });
});

describe('Protected routes — require auth header', () => {
  beforeEach(() => jest.resetAllMocks());

  it('401 — PATCH /users/profile without token', async () => {
    // verifySession returns invalid when no Authorization header
    mockVerifySessionUC.execute.mockRejectedValueOnce(new InvalidCredentialsError());

    const res = await request(app)
      .patch('/api/v3/users/profile')
      .send({ firstName: 'Carlos' });

    expect(res.status).toBe(401);
  });

  it('200 — PATCH /users/profile with valid token', async () => {
    mockVerifySessionUC.execute.mockResolvedValue({ valid: true, userId: 'user-1', sessionId: 's-1', role: 'user' });
    mockUpdateProfileUC.execute.mockResolvedValue({ success: true, userId: 'user-1' });

    const res = await request(app)
      .patch('/api/v3/users/profile')
      .set('Authorization', `Bearer ${MOCK_ACCESS_TOKEN}`)
      .send({ firstName: 'Carlos' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
