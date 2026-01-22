/**
 * Authentication Entities
 */

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  clientId: string | null;
  createdAt: Date;
  expiresAt: Date;
  revoked: boolean;
  previousTokenId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface EmailVerification {
  id: string;
  userId: string;
  token: string;
  email: string;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface OTPSecret {
  id: string;
  userId: string;
  secret: string;
  verified: boolean;
  backupCodes: string[];
  createdAt: Date;
}
