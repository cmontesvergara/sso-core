import argon2 from 'argon2';
import {
  RefreshResult,
  SigninInput,
  SigninResult,
  SignoutInput,
  SignupInput,
  SignupResult,
} from '../core/dtos';
import { AppError } from '../middleware/errorHandler';
import { createUser, findUserByEmail } from '../repositories/userRepo.prisma';
import { generateRefreshToken, revokeRefreshTokenPlain, rotateRefreshToken } from './session';

/**
 * Authentication Service - Handles all authentication business logic
 */
export class AuthenticationService {
  private static instance: AuthenticationService;

  private constructor() {}

  static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  /**
   * Register a new user
   */
  async signup(input: SignupInput): Promise<SignupResult> {
    // Check if user already exists
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
      throw new AppError(409, 'User already exists', 'USER_EXISTS');
    }

    // Create new user
    const user = await createUser({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      secondName: input.secondName,
      lastName: input.lastName,
      secondLastName: input.secondLastName,
      phone: input.phone,
      nuid: input.nuid,
      birthDate: input.birthDate,
      gender: input.gender,
      nationality: input.nationality,
      birthPlace: input.birthPlace,
      placeOfResidence: input.placeOfResidence,
      occupation: input.occupation,
      maritalStatus: input.maritalStatus,
      recoveryPhone: input.recoveryPhone,
      recoveryEmail: input.recoveryEmail,
    });

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      secondName: user.secondName,
      lastName: user.lastName,
      secondLastName: user.secondLastName,
      phone: user.phone,
      userStatus: user.userStatus,
    };
  }

  /**
   * Authenticate user and generate tokens
   */
  async signin(input: SigninInput): Promise<SigninResult> {
    const { email, password, ip, userAgent } = input;

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Check user status
    if (user.userStatus !== 'active') {
      throw new AppError(403, 'Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    // Generate refresh token
    const { token: refreshToken } = await generateRefreshToken(user.id, null, {
      ip: ip || '',
      ua: userAgent || '',
    });

    // Rotate to get access token
    const result = await rotateRefreshToken(refreshToken);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * Sign out user by revoking refresh token
   */
  async signout(input: SignoutInput): Promise<void> {
    const { refreshToken, all = false } = input;
    await revokeRefreshTokenPlain(refreshToken, all);
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const result = await rotateRefreshToken(refreshToken);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }
}
