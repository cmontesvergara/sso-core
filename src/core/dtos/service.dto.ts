/**
 * Service DTOs - Internal service layer interfaces
 */

// Authentication Service DTOs
export interface SignupInput {
  firstName: string;
  lastName: string;
  nuid: string;
  phone: string;
  email: string;
  password: string;
  secondName?: string | null;
  secondLastName?: string | null;
  // Additional Information
  birthDate?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  birthPlace?: string | null;
  placeOfResidence?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  // Secure Information
  recoveryPhone?: string | null;
  recoveryEmail?: string | null;
}

export interface SignupResult {
  userId: string;
  email: string;
  firstName: string;
  secondName: string | null;
  lastName: string;
  secondLastName: string | null;
  phone: string;
  userStatus: string;
}

export interface SigninInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface SigninResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SignoutInput {
  refreshToken: string;
  all?: boolean;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Tenant Service DTOs
export interface CreateTenantInput {
  name: string;
  slug?: string;
}

export interface InviteTenantMemberInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

// OTP Service DTOs
export interface OTPSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface OTPVerifyRequest {
  userId: string;
  token: string;
}

// Email Service DTOs
export type EmailProvider = 'nodemailer' | 'resend' | 'ethereal';

export interface EmailConfig {
  provider: EmailProvider;
  // Nodemailer / SMTP config
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
  // Resend config
  apiKey?: string;
  // Common
  from?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
