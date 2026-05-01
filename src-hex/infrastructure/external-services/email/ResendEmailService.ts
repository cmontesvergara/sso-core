import { Resend } from 'resend';
import { IEmailService } from '../../../application/ports/output/IEmailService';
import { Email } from '../../../domain/value-objects/Email';

/**
 * ResendEmailService
 * Implementation of IEmailService using the Resend API.
 * All templates are minimal and production-ready — extend as needed.
 */
export class ResendEmailService implements IEmailService {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string = 'noreply@bigso.co') {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async sendVerificationEmail(to: Email, token: string): Promise<void> {
    const verifyUrl = `${process.env.APP_URL ?? 'https://sso.bigso.co'}/verify-email?token=${token}`;
    await this.send(to.value, 'Verifica tu correo electrónico', `
      <h2>Verificación de correo</h2>
      <p>Haz clic en el enlace para verificar tu correo:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>El enlace expira en 24 horas.</p>
    `);
  }

  async sendPasswordResetEmail(to: Email, token: string): Promise<void> {
    const resetUrl = `${process.env.APP_URL ?? 'https://sso.bigso.co'}/reset-password?token=${token}`;
    await this.send(to.value, 'Restablecer contraseña', `
      <h2>Restablecimiento de contraseña</h2>
      <p>Haz clic en el enlace para restablecer tu contraseña:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>El enlace expira en 1 hora.</p>
    `);
  }

  async send2FAEmail(to: Email, code: string): Promise<void> {
    await this.send(to.value, 'Tu código de verificación', `
      <h2>Código de verificación</h2>
      <p>Tu código de acceso temporal es:</p>
      <h1 style="letter-spacing: 6px">${code}</h1>
      <p>El código expira en 10 minutos.</p>
    `);
  }

  async sendWelcomeEmail(to: Email, firstName: string): Promise<void> {
    await this.send(to.value, `¡Bienvenido, ${firstName}!`, `
      <h2>Bienvenido a BigSo SSO</h2>
      <p>Hola ${firstName}, tu cuenta ha sido creada exitosamente.</p>
    `);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.client.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      console.error('[ResendEmailService] Failed to send email:', err);
      throw err;
    }
  }
}
