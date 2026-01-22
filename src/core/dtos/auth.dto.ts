/**
 * Authentication Data Transfer Objects
 */

import { UserResponseDTO } from './user.dto';

export interface SignupRequestDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface SigninRequestDTO {
  email: string;
  password: string;
}

export interface RefreshTokenRequestDTO {
  refreshToken: string;
}

export interface SignoutRequestDTO {
  refreshToken: string;
  all?: boolean;
}

export interface TokenResponseDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDTO {
  success: boolean;
  message: string;
  tokens?: TokenResponseDTO;
  user?: UserResponseDTO;
}

// OTP DTOs
export interface GenerateOTPDTO {
  userId: string;
}

export interface VerifyOTPDTO {
  userId: string;
  token: string;
}

export interface OTPResponseDTO {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// Email Verification DTOs
export interface CreateEmailVerificationDTO {
  userId: string;
  email: string;
}

export interface VerifyEmailDTO {
  token: string;
}

export interface EmailVerificationResponseDTO {
  id: string;
  userId: string;
  email: string;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
}
