import { v4 as uuidv4 } from 'uuid';
import { Repository } from '../database/types';
import { User } from '../types';

/**
 * User Service for user management
 */
export class UserService {
  private static instance: UserService;

  private userRepository: Repository<User>;

  private constructor(userRepository: Repository<User>) {
    this.userRepository = userRepository;
  }

  static getInstance(userRepository: Repository<User>): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService(userRepository);
    }
    return UserService.instance;
  }

  /**
   * Create a new user
   */
  async createUser(data: Partial<User>): Promise<User> {
    const user: User = {
      userId: uuidv4(),
      email: data.email!,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };

    return this.userRepository.create(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ email } as Partial<User>);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    return this.userRepository.update(userId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    return this.userRepository.delete(userId);
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.updateUser(userId, {
      isEmailVerified: true,
    } as Partial<User>);
  }
}
