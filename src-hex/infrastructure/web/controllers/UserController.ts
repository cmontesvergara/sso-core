import { Request, Response, NextFunction } from 'express';
import { RegisterUserUseCase } from '../../../application/use-cases/user/RegisterUserUseCase';
import {
  UpdateUserProfileUseCase,
  ChangePasswordUseCase,
} from '../../../application/use-cases/user/UpdateUserUseCase';
import { VerifyEmailUseCase } from '../../../application/use-cases/user/VerifyEmailUseCase';

/**
 * UserController
 * HTTP adapter for user-related use cases.
 */
export class UserController {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private updateProfileUseCase: UpdateUserProfileUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
    private verifyEmailUseCase: VerifyEmailUseCase
  ) {}

  /**
   * POST /api/v3/users/register
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registerUserUseCase.execute({
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        tenantName: req.body.tenantName,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v3/users/profile
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.updateProfileUseCase.execute({
        userId: (req as any).userId,
        ...req.body,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/users/change-password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.changePasswordUseCase.execute({
        userId: (req as any).userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/users/verify-email
   * Public — no auth required
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.verifyEmailUseCase.verifyToken({ token: req.query.token as string });
      res.status(200).json({ success: true, message: 'Email verificado correctamente' });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/users/send-verification
   */
  sendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.verifyEmailUseCase.sendVerification({ userId: (req as any).userId });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
