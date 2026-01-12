import nodemailer, { Transporter } from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { getPrismaClient } from './prisma';

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
  from?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private config: EmailConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private loadConfig(): EmailConfig {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'development') {
      return {
        from: 'noreply@sso.local',
      };
    }

    return {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      from: process.env.EMAIL_FROM || 'noreply@sso.local',
    };
  }

  /**
   * Initialize email transporter
   */
  async initialize(): Promise<void> {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'development') {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info('Email service initialized with Ethereal test account');
      } catch (error) {
        logger.warn('Failed to initialize Ethereal account, using console transport:', error);
        this.transporter = nodemailer.createTransport({ streamTransport: true });
      }
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });

      logger.info(`Email service initialized with SMTP: ${this.config.host}`);
    }
  }

  /**
   * Send email verification link
   */
  async sendEmailVerification(userId: string, email: string, callbackUrl: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.emailVerification.create({
        data: {
          userId,
          token,
          email,
          expiresAt,
        },
      });

      const verificationUrl = `${callbackUrl}?token=${token}`;
      const html = `
        <h2>Verify your email address</h2>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
        <p>Or copy and paste this link:</p>
        <p>${verificationUrl}</p>
        <p>This link expires in 24 hours.</p>
      `;

      await this.sendEmail({
        to: email,
        subject: 'Verify your email address',
        html,
        text: `Verify your email by visiting: ${verificationUrl}`,
      });

      logger.info(`Email verification sent to ${email}`);
    } catch (error) {
      logger.error(`Failed to send email verification to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Verify email token
   */
  async verifyEmailToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const prisma = getPrismaClient();
      const verification = await prisma.emailVerification.findUnique({
        where: { token },
      });

      if (!verification) {
        return null;
      }

      if (new Date() > verification.expiresAt) {
        await prisma.emailVerification.delete({ where: { token } });
        return null;
      }

      await prisma.emailVerification.update({
        where: { token },
        data: { verified: true },
      });

      logger.info(`Email verified for user ${verification.userId}`);

      return {
        userId: verification.userId,
        email: verification.email,
      };
    } catch (error) {
      logger.error(`Failed to verify email token ${token}:`, error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(userId: string, email: string, callbackUrl: string): Promise<void> {
    try {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const prisma = getPrismaClient();
      await prisma.emailVerification.create({
        data: {
          userId,
          token,
          email,
          expiresAt,
        },
      });

      const resetUrl = `${callbackUrl}?token=${token}`;
      const html = `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
        <p>Or copy and paste this link:</p>
        <p>${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
      `;

      await this.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html,
        text: `Reset your password by visiting: ${resetUrl}`,
      });

      logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
      logger.error(`Failed to send password reset to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Generic email sending
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const result = await this.transporter.sendMail({
        from: this.config.from,
        ...options,
      });

      logger.info(`Email sent to ${options.to}:`, result);
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }
}

export const Email = EmailService.getInstance();
