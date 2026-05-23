import { Resend } from 'resend';
import { IEmailService } from '../../../application/ports/output/IEmailService';
import { Email } from '../../../domain/value-objects/Email';

/**
 * ResendEmailService
 * Implementation of IEmailService using the Resend API.
 * Employs premium design templates aligned with Bigso Design System.
 */
export class ResendEmailService implements IEmailService {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string = 'no-reply@bigso.co') {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async sendVerificationEmail(to: Email, token: string): Promise<void> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 0.5px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #5B50D6; padding: 24px 36px; display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.18); border-radius: 9px; display: inline-block; text-align: center; line-height: 36px; font-weight: bold; color: white; vertical-align: middle;">B</div>
          <div style="display: inline-block; vertical-align: middle; margin-left: 12px;">
            <div style="font-size: 18px; font-weight: 500; color: #fff; letter-spacing: -0.3px;">Bigso ID</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 2px;">Verificación de seguridad</div>
          </div>
        </div>

        <div style="padding: 36px 36px 28px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: #EEEDFE; margin: 0 auto 20px; text-align: center; line-height: 60px; color: #5B50D6; font-size: 28px;">✓</div>
          <h1 style="font-size: 20px; font-weight: 500; color: #111827; margin: 0 0 8px;">Código de verificación</h1>
          <p style="font-size: 14px; color: #4B5563; line-height: 1.7; margin: 0 auto; max-width: 360px;">Alguien (esperemos que tú) solicitó verificar tu cuenta de Bigso. Usa el siguiente código para completar el proceso.</p>
        </div>

        <div style="padding: 28px 36px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <div style="font-size: 11px; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Tu código de un solo uso</div>
          <div style="display: block; margin-bottom: 20px;">
            ${token.split('').map(d => `<div style="display: inline-block; width: 48px; height: 60px; line-height: 60px; border-radius: 10px; background: #EEEDFE; border: 1.5px solid #AFA9EC; font-size: 28px; font-weight: 500; color: #3C3489; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0 4px;">${d}</div>`).join('')}
          </div>
          <div style="font-size: 12px; color: #6B7280;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #639922; margin-right: 6px; vertical-align: middle;"></span>
            Válido por <strong>24 horas</strong>
          </div>
        </div>

        <div style="padding: 24px 36px; border-bottom: 0.5px solid #e5e7eb;">
          <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 12px;">Detalles de la solicitud</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; color: #111827; line-height: 1.5;">
            Iniciada desde la plataforma web. Si esta acción fue realizada por ti, puedes continuar con seguridad.
          </div>
        </div>

        <div style="padding: 16px 36px; background: #FAEEDA; border-bottom: 0.5px solid #EF9F27;">
          <p style="font-size: 12px; color: #633806; line-height: 1.5; margin: 0;">⚠ Si <strong>no reconoces</strong> esta solicitud, ignora este correo. Bigso nunca te pedirá este código por otro medio.</p>
        </div>

        <div style="padding: 20px 36px;">
          <p style="font-size: 11px; color: #9CA3AF; margin: 0;">© 2026 Bigso Labs · Este es un correo automático, no lo respondas.</p>
        </div>
      </div>
    `;

    await this.send(to.value, 'Tu código de verificación Bigso es ' + token, html);
  }

  async sendWelcomeEmail(to: Email, firstName: string): Promise<void> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 0.5px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #5B50D6; padding: 24px 36px;">
          <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.18); border-radius: 9px; display: inline-block; text-align: center; line-height: 36px; font-weight: bold; color: white; vertical-align: middle;">B</div>
          <div style="display: inline-block; vertical-align: middle; margin-left: 12px;">
            <div style="font-size: 18px; font-weight: 500; color: #fff; letter-spacing: -0.3px;">Bigso ID</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 2px;">La plataforma para tu negocio</div>
          </div>
        </div>

        <div style="padding: 36px 36px 28px; border-bottom: 0.5px solid #e5e7eb;">
          <div style="display: inline-block; background: #FAEEDA; border: 0.5px solid #EF9F27; border-radius: 20px; padding: 5px 12px; font-size: 12px; color: #633806; font-weight: 500; margin-bottom: 20px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #BA7517; margin-right: 6px; vertical-align: middle;"></span>
            Cuenta pendiente de activación
          </div>
          <h1 style="font-size: 22px; font-weight: 500; color: #111827; margin: 0 0 10px; line-height: 1.3;">¡Tu cuenta fue creada, ${firstName}!</h1>
          <p style="font-size: 14px; color: #4B5563; line-height: 1.7; margin: 0;">Ya casi estás dentro. Tu cuenta está lista pero aún no está activa — solo falta verificar tu correo para desbloquear el acceso completo a Bigso.</p>
        </div>

        <div style="padding: 24px 36px; border-bottom: 0.5px solid #e5e7eb;">
          <div style="font-size: 11px; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Pasos para activar tu cuenta</div>
          
          <!-- Step 1 -->
          <div style="margin-bottom: 16px;">
            <div style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: #EEEDFE; color: #534AB7; font-size: 14px; font-weight: bold; text-align: center; line-height: 28px; vertical-align: top; margin-top: 2px;">✓</div>
            <div style="display: inline-block; margin-left: 14px; max-width: 80%;">
              <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 2px;">Crear tu cuenta</p>
              <p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">Completado exitosamente.</p>
            </div>
          </div>
          
          <div style="width: 1px; height: 16px; background: #e5e7eb; margin: 0 0 16px 13px;"></div>
          
          <!-- Step 2 -->
          <div style="margin-bottom: 16px;">
            <div style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: #5B50D6; color: #fff; font-size: 12px; font-weight: 500; text-align: center; line-height: 28px; vertical-align: top; margin-top: 2px;">2</div>
            <div style="display: inline-block; margin-left: 14px; max-width: 80%;">
              <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 2px;">Verificar tu correo electrónico</p>
              <p style="font-size: 12px; color: #4B5563; margin: 0; line-height: 1.5;">Usa el código que llegó junto a este correo para activar tu cuenta.</p>
            </div>
          </div>
          
          <div style="width: 1px; height: 16px; background: #e5e7eb; margin: 0 0 16px 13px;"></div>
          
          <!-- Step 3 -->
          <div>
            <div style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: #D3D1C7; color: #5F5E5A; font-size: 12px; font-weight: 500; text-align: center; line-height: 28px; vertical-align: top; margin-top: 2px;">3</div>
            <div style="display: inline-block; margin-left: 14px; max-width: 80%;">
              <p style="font-size: 13px; font-weight: 500; color: #6B7280; margin: 0 0 2px;">Acceder a tu panel</p>
              <p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">Disponible una vez que verifiques tu cuenta.</p>
            </div>
          </div>
        </div>

        <div style="margin: 20px 36px 0; background: #EEEDFE; border: 1px solid #AFA9EC; border-radius: 10px; padding: 14px 16px;">
          <p style="font-size: 13px; color: #3C3489; line-height: 1.5; margin: 0;">✉ Te enviamos un segundo correo con el <strong>código de verificación</strong>. Búscalo en tu bandeja de entrada con el asunto "Tu código de verificación Bigso es...".</p>
        </div>

        <div style="padding: 28px 36px; border-bottom: 0.5px solid #e5e7eb;">
          <div style="font-size: 11px; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Lo que te espera al activar</div>
          <div style="margin-bottom: 14px;">
            <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 2px;">✦ Gestiona tu equipo</p>
            <p style="font-size: 12px; color: #4B5563; margin: 0; line-height: 1.5;">Invita colaboradores, asigna roles y controla accesos desde un solo lugar.</p>
          </div>
          <div style="margin-bottom: 14px;">
            <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 2px;">✦ Métricas en tiempo real</p>
            <p style="font-size: 12px; color: #4B5563; margin: 0; line-height: 1.5;">Dashboards con el rendimiento de tu negocio actualizados al instante.</p>
          </div>
          <div>
            <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 2px;">✦ Conecta tus herramientas</p>
            <p style="font-size: 12px; color: #4B5563; margin: 0; line-height: 1.5;">Más de 40 integraciones listas para activar en segundos.</p>
          </div>
        </div>

        <div style="padding: 20px 36px;">
          <p style="font-size: 11px; color: #9CA3AF; margin: 0;">© 2026 Bigso Labs · Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    await this.send(to.value, `Bienvenido a Bigso — activa tu cuenta para comenzar`, html);
  }

  async sendPasswordResetEmail(to: Email, token: string): Promise<void> {
    const resetUrl = `${process.env.APP_URL ?? 'https://auth.bigso.org'}/auth/reset-password?token=${token}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 0.5px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #5B50D6; padding: 24px 36px;">
          <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.18); border-radius: 9px; display: inline-block; text-align: center; line-height: 36px; font-weight: bold; color: white; vertical-align: middle;">B</div>
          <div style="display: inline-block; vertical-align: middle; margin-left: 12px;">
            <div style="font-size: 18px; font-weight: 500; color: #fff; letter-spacing: -0.3px;">Bigso ID</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 2px;">Recuperación de cuenta</div>
          </div>
        </div>

        <div style="padding: 36px 36px 28px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: #EEEDFE; margin: 0 auto 20px; text-align: center; line-height: 60px; color: #5B50D6; font-size: 28px;">⟲</div>
          <h1 style="font-size: 20px; font-weight: 500; color: #111827; margin: 0 0 8px;">Restablecer contraseña</h1>
          <p style="font-size: 14px; color: #4B5563; line-height: 1.7; margin: 0 auto; max-width: 360px;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.</p>
        </div>

        <div style="padding: 28px 36px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background: #5B50D6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 14px; margin-bottom: 20px;">Restablecer contraseña</a>
          <div style="font-size: 12px; color: #6B7280;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #EF9F27; margin-right: 6px; vertical-align: middle;"></span>
            Este enlace expira en <strong>1 hora</strong>
          </div>
        </div>

        <div style="padding: 24px 36px; border-bottom: 0.5px solid #e5e7eb;">
          <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 12px;">Detalles de la solicitud</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; color: #111827; line-height: 1.5; text-align: left;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${resetUrl}" style="color: #5B50D6; word-break: break-all;">${resetUrl}</a>
          </div>
        </div>

        <div style="padding: 16px 36px; background: #FAEEDA; border-bottom: 0.5px solid #EF9F27; text-align: left;">
          <p style="font-size: 12px; color: #633806; line-height: 1.5; margin: 0;">⚠ Si <strong>no solicitaste</strong> un cambio de contraseña, ignora este correo. Tu cuenta sigue segura.</p>
        </div>

        <div style="padding: 20px 36px; text-align: center;">
          <p style="font-size: 11px; color: #9CA3AF; margin: 0;">© 2026 Bigso Labs · Este es un correo automático, no lo respondas.</p>
        </div>
      </div>
    `;
    await this.send(to.value, 'Restablecer contraseña de Bigso', html);
  }

  async send2FAEmail(to: Email, code: string): Promise<void> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 0.5px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #5B50D6; padding: 24px 36px;">
          <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.18); border-radius: 9px; display: inline-block; text-align: center; line-height: 36px; font-weight: bold; color: white; vertical-align: middle;">B</div>
          <div style="display: inline-block; vertical-align: middle; margin-left: 12px;">
            <div style="font-size: 18px; font-weight: 500; color: #fff; letter-spacing: -0.3px;">Bigso ID</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 2px;">Verificación en dos pasos</div>
          </div>
        </div>

        <div style="padding: 36px 36px 28px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: #EEEDFE; margin: 0 auto 20px; text-align: center; line-height: 60px; color: #5B50D6; font-size: 28px;">🔐</div>
          <h1 style="font-size: 20px; font-weight: 500; color: #111827; margin: 0 0 8px;">Código de acceso temporal</h1>
          <p style="font-size: 14px; color: #4B5563; line-height: 1.7; margin: 0 auto; max-width: 360px;">Usa el siguiente código para completar tu inicio de sesión.</p>
        </div>

        <div style="padding: 28px 36px; border-bottom: 0.5px solid #e5e7eb; text-align: center;">
          <div style="font-size: 11px; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Tu código de seguridad</div>
          <div style="display: block; margin-bottom: 20px;">
            ${code.split('').map(d => `<div style="display: inline-block; width: 48px; height: 60px; line-height: 60px; border-radius: 10px; background: #EEEDFE; border: 1.5px solid #AFA9EC; font-size: 28px; font-weight: 500; color: #3C3489; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0 4px;">${d}</div>`).join('')}
          </div>
          <div style="font-size: 12px; color: #6B7280;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #EF9F27; margin-right: 6px; vertical-align: middle;"></span>
            Válido por <strong>10 minutos</strong>
          </div>
        </div>

        <div style="padding: 24px 36px; border-bottom: 0.5px solid #e5e7eb;">
          <p style="font-size: 13px; font-weight: 500; color: #111827; margin: 0 0 12px;">Detalles de la solicitud</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; color: #111827; line-height: 1.5; text-align: left;">
            Iniciada desde la plataforma web. Si esta acción fue realizada por ti, puedes continuar con seguridad.
          </div>
        </div>

        <div style="padding: 16px 36px; background: #FAEEDA; border-bottom: 0.5px solid #EF9F27; text-align: left;">
          <p style="font-size: 12px; color: #633806; line-height: 1.5; margin: 0;">⚠ Si <strong>no intentaste iniciar sesión</strong>, ignora este correo y considera cambiar tu contraseña.</p>
        </div>

        <div style="padding: 20px 36px; text-align: center;">
          <p style="font-size: 11px; color: #9CA3AF; margin: 0;">© 2026 Bigso Labs · Este es un correo automático, no lo respondas.</p>
        </div>
      </div>
    `;
    await this.send(to.value, 'Tu código de acceso temporal es ' + code, html);
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
