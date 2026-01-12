/**
 * Email Service for sending emails
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;

  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    // TODO: Implement email sending using nodemailer
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${process.env.APP_URL}/email-verification?token=${verificationToken}`;

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email',
      html: `
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
      `,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.APP_URL}/password-reset?token=${resetToken}`;

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
      `,
    });
  }
}
