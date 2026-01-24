import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';
import { EmailConfig, EmailProvider, SendEmailOptions } from '../core/dtos';
import { logger } from '../utils/logger';
import { getPrismaClient } from './prisma';

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;
  private config: EmailConfig;
  private provider: EmailProvider;

  private constructor() {
    this.config = this.loadConfig();
    this.provider = this.config.provider;
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private loadConfig(): EmailConfig {
    const env = process.env.NODE_ENV || 'development';
    const provider = process.env.EMAIL_PROVIDER as EmailProvider;

    const baseConfig = {
      provider,
      from: process.env.EMAIL_FROM || 'noreply@bigso.co',
    };

    if (env === 'development') {
      return {
        ...baseConfig,
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
      };
    }

    // Production config
    if (provider === 'resend') {
      return {
        ...baseConfig,
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
      };
    }

    // Default SMTP
    return {
      ...baseConfig,
      provider: 'nodemailer',
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };
  }

  /**
   * Initialize email service based on provider
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing email service with provider: ${this.provider}`);

    if (this.provider === 'resend') {
      this.initializeResend();
    } else if (this.provider === 'ethereal') {
      await this.initializeEthereal();
    } else {
      this.initializeNodemailer();
    }
  }

  /**
   * Initialize Resend API client
   */
  private initializeResend(): void {
    if (!this.config.apiKey) {
      throw new Error('RESEND_API_KEY is required for Resend provider');
    }

    this.resend = new Resend(this.config.apiKey);
    logger.info('Email service initialized with Resend API');
  }

  /**
   * Initialize Ethereal test account (development)
   */
  private async initializeEthereal(): Promise<void> {
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
  }

  /**
   * Initialize Nodemailer SMTP
   */
  private initializeNodemailer(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });

    logger.info(`Email service initialized with SMTP: ${this.config.host}`);
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

      // Update user status to active if not already active
      const user = await prisma.user.findUnique({
        where: { id: verification.userId },
        select: { userStatus: true },
      });

      if (user && user.userStatus !== 'active') {
        await prisma.user.update({
          where: { id: verification.userId },
          data: { userStatus: 'active' },
        });
        logger.info(
          `Email verified for user ${verification.userId} - User status updated to active`
        );
      } else {
        logger.info(`Email verified for user ${verification.userId} - User already active`);
      }

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
   * Generic email sending (supports multiple providers)
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      if (this.provider === 'resend') {
        await this.sendViaResend(options);
        console.log('Email sent via Resend');
      } else {
        await this.sendViaNodemailer(options);
      }
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(options: SendEmailOptions): Promise<void> {
    if (!this.resend) {
      await this.initialize();
    }

    if (!this.resend) {
      throw new Error('Resend client not initialized');
    }

    const result = await this.resend.emails.send({
      from: this.config.from!,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    logger.info(`Email sent via Resend to ${options.to}:`, {
      id: result.data?.id,
      provider: 'resend',
    });
  }

  /**
   * Send email via Nodemailer (SMTP or Ethereal)
   */
  private async sendViaNodemailer(options: SendEmailOptions): Promise<void> {
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

    logger.info(`Email sent via Nodemailer to ${options.to}:`, {
      messageId: result.messageId,
      provider: this.provider,
    });
  }
}

export const Email = EmailService.getInstance();
