/**
 * Nombres de cookies del sistema
 * Centralizado para evitar hardcoding en routes
 */
export const COOKIE_NAMES = {
  /** V2: Refresh token (httpOnly, path específico) */
  REFRESH_TOKEN: 'v2_refresh_token',
  /** V2: Session ID de aplicación */
  APP_SESSION: 'bigso_app_session',
  /** V2: Mapeo de nombres para SDK */
  COOKIE_MAP: 'bs_cookie_name_map',
  /** V1 Legacy: SSO session (a deprecar) */
  SSO_SESSION: 'sso_session',
  /** V1 Legacy: App session (a deprecar) */
  APP_SESSION_V1: 'app_session',
} as const;

/**
 * Paths específicos para cada cookie
 */
export const COOKIE_PATHS = {
  REFRESH_TOKEN: '/api/v2/auth/refresh',
  APP_SESSION: '/',
  SSO_SESSION: '/',
} as const;

/**
 * Valor del mapeo de nombres para el SDK
 */
export const COOKIE_MAP_VALUE = [
  'refreshToken:v2_refresh_token',
  'sessionId:bigso_app_session',
] as const;

/**
 * Opciones base para cookies httpOnly
 */
export function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  };
}

/**
 * Opciones para cookie de refresh token
 */
export function getRefreshTokenCookieOptions() {
  return {
    ...getBaseCookieOptions(),
    path: COOKIE_PATHS.REFRESH_TOKEN,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  };
}

/**
 * Opciones para cookie de sesión
 */
export function getSessionCookieOptions() {
  return {
    ...getBaseCookieOptions(),
    path: COOKIE_PATHS.APP_SESSION,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
  };
}
