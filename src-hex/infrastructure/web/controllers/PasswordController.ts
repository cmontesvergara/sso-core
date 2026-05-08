import { Request, Response, NextFunction } from 'express';
import { ForgotPasswordUseCase, ResetPasswordUseCase } from '../../../application/use-cases/user/PasswordResetUseCase';

/**
 * PasswordController
 * HTTP adapter for password reset flow.
 */
export class PasswordController {
  constructor(
    private forgotPasswordUseCase: ForgotPasswordUseCase,
    private resetPasswordUseCase: ResetPasswordUseCase
  ) {}

  /**
   * POST /api/v3/auth/forgot-password
   * Public — always returns 204 to prevent email enumeration
   */
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.forgotPasswordUseCase.execute({ email: req.body.email });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v3/auth/reset-password
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.resetPasswordUseCase.execute({
        token: req.body.token,
        newPassword: req.body.newPassword,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
