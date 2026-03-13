import { Request, Response } from 'express';

export const APP_SESSION_PREFIX = 'bigapp-session-';

/**
 * Searches the request cookies for any cookie that starts with the standard app session prefix.
 * 
 * @param req Express Request object
 * @returns The session token if found, undefined otherwise
 */
export function getAppSessionTokenFromCookies(req: Request): string | undefined {
  if (!req.cookies) {
    return undefined;
  }

  for (const [cookieName, cookieValue] of Object.entries(req.cookies)) {
    if (cookieName.startsWith(APP_SESSION_PREFIX)) {
      return cookieValue as string;
    }
  }

  return undefined;
}

/**
 * Clears any cookie that starts with the standard app session prefix.
 * This is useful when the exact application ID is unknown but the session is invalid.
 * 
 * @param req Express Request object
 * @param res Express Response object
 * @param options Cookie options (domain, path, etc.)
 */
export function clearAppSessionCookies(
  req: Request, 
  res: Response, 
  options: any = {}
): void {
  if (!req.cookies) {
    return;
  }

  const defaultOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    ...options
  };

  for (const cookieName of Object.keys(req.cookies)) {
    if (cookieName.startsWith(APP_SESSION_PREFIX)) {
      res.clearCookie(cookieName, defaultOptions);
    }
  }
}
