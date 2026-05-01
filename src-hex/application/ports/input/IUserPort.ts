import { RegisterUserInput } from '../../dto/input/RegisterUserInput';
import { UpdateProfileInput } from '../../dto/input/UpdateProfileInput';
import { ChangePasswordInput } from '../../dto/input/ChangePasswordInput';
import { UserResult } from '../../dto/output/UserResult';
import { UserId } from '../../../domain/value-objects/UserId';

/**
 * IUserPort
 * Interface exposing user management capabilities
 */
export interface IUserPort {
  /**
   * Register a new user
   */
  register(input: RegisterUserInput): Promise<UserResult>;

  /**
   * Update user profile
   */
  updateProfile(userId: UserId, input: UpdateProfileInput): Promise<UserResult>;

  /**
   * Change user password
   */
  changePassword(userId: UserId, input: ChangePasswordInput): Promise<void>;

  /**
   * Deactivate user account
   */
  deactivateUser(userId: UserId, reason?: string): Promise<void>;

  /**
   * Get user by ID
   */
  getUser(userId: UserId): Promise<UserResult | null>;
}
