import argon2 from 'argon2';
import { OTP } from './otp';
import { JWT } from './jwt';
import { AuditLog } from './auditLog';
import { AppError } from '../middleware/errorHandler';
import { Logger } from '../utils/logger';
import { UserMapperStatic, UserPublicDTO } from '../core/mappers/user.mapper';
import { UserRepository } from '../core/repositories/user.repository';
import { SsoSessionService } from './session/sso-session.service';
import { AppSessionService } from './session/app-session.service';
import { RefreshTokenService } from './session/refresh-token.service';
import { TokenValidatorService } from './session/token-validator.service';
import { SessionRevokerService } from './session/session-revoker.service';

/**
 * Resultado del login v2
 */
export interface LoginV2Result {
  requiresTwoFactor?: boolean;
  tempToken?: string;
  ssoToken?: string;
  expiresIn?: number;
  user?: UserPublicDTO;
}

/**
 * Opciones para login v2
 */
export interface LoginV2Options {
  email?: string;
  nuid?: string;
  password: string;
  appId: string;
  tenantId: string;
  ip: string;
  userAgent: string;
}

/**
 * AuthServiceV2 - Servicio de autenticación para API v2
 *
 * Centraliza toda la lógica de negocio de autenticación:
 * - Validación de credenciales
 * - Verificación de estado de cuenta
 * - 2FA handling
 * - Creación de sesión
 * - Audit logging
 *
 * Uso en routes:
 *   const result = await AuthV2.login({ email, password, appId, tenantId, ip, userAgent });
 */
export class AuthServiceV2 {
  constructor(
    private userRepo: UserRepository,
    private ssoSessionService: SsoSessionService,
    // These services are available but not directly used in this class
    // They're kept for future extensibility and container consistency
    _appSessionService?: AppSessionService,
    _refreshTokenService?: RefreshTokenService,
    _tokenValidatorService?: TokenValidatorService,
    _sessionRevokerService?: SessionRevokerService
  ) {
    // Store primary services, ignore unused ones (prefixed with _)
    this.userRepo = userRepo;
    this.ssoSessionService = ssoSessionService;
  }

  /**
   * Login con email o NUID + password
   * Maneja: validación de credenciales, 2FA, creación de sesión, audit log
   */
  async login(options: LoginV2Options): Promise<LoginV2Result> {
    const { email, nuid, password, appId, tenantId, ip, userAgent } = options;

    // 1. Buscar usuario
    const user = await this.findUserByIdentifier(email, nuid);

    // 2. Validar password
    await this.validatePassword(user, password);

    // 3. Verificar estado de cuenta
    this.checkUserStatus(user);

    // 4. Check 2FA
    if (await OTP.isOTPEnabled(user.id)) {
      Logger.info('2FA required for user', { userId: user.id, email: user.email });
      return {
        requiresTwoFactor: true,
        tempToken: JWT.generateTwoFactorToken(user.id),
      };
    }

    // 5. Crear sesión SSO
    const session = await this.ssoSessionService.createSession(
      user.id,
      user,
      { ip, userAgent },
      { appId, tenantId }
    );

    // 6. Audit log
    await AuditLog.logLogin(user.id, ip, userAgent);

    Logger.info('Login successful', {
      userId: user.id,
      email: user.email,
      appId,
      tenantId,
    });

    return {
      ssoToken: session.accessToken,
      expiresIn: 15 * 60,
      user: UserMapperStatic.toPublicDTO(user),
    };
  }

  /**
   * Busca usuario por email o NUID
   * @throws AppError 401 si no existe
   */
  private async findUserByIdentifier(
    email?: string,
    nuid?: string
  ): Promise<any> {
    if (email) {
      const user = await this.userRepo.findUserByEmail(email);
      if (!user) {
        Logger.warn('Login failed - user not found', { email });
        throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }
      return user;
    }
    if (nuid) {
      const user = await this.userRepo.findUserByNuid(nuid);
      if (!user) {
        Logger.warn('Login failed - user not found', { nuid });
        throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }
      return user;
    }
    Logger.warn('Login failed - no identifier provided');
    throw new AppError(400, 'Email or NUID required', 'INVALID_INPUT');
  }

  /**
   * Valida password con Argon2
   * @throws AppError 401 si es inválido
   */
  private async validatePassword(user: any, password: string): Promise<void> {
    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      Logger.warn('Login failed - invalid password', { userId: user.id, email: user.email });
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
  }

  /**
   * Verifica que la cuenta esté activa
   * @throws AppError 403 si no está activa
   */
  private checkUserStatus(user: any): void {
    if (user.userStatus !== 'active') {
      const encodedUserId = Buffer.from(user.id).toString('base64');
      Logger.warn('Login failed - account not active', {
        userId: user.id,
        email: user.email,
        userStatus: user.userStatus,
      });
      throw new AppError(403, 'Account is not active', 'ACCOUNT_NOT_ACTIVE', [
        { userId: encodedUserId },
      ]);
    }
  }
}
