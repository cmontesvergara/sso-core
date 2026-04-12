export interface TokenPayload {
  sub: string;
  jti: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  tenants: Array<{
    id: string;
    role: string;
    apps: string[];
  }>;
  systemRole: string;
  deviceFingerprint?: string;
}

export interface LoginV2Request {
  email?: string;
  nuid?: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface AuthorizeV2Request {
  tenantId: string;
  appId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
  state?: string;
  nonce?: string;
}

export interface ExchangeV2Request {
  code: string;
  appId: string;
  codeVerifier: string;
}

export interface RefreshV2Request {
  refreshToken?: string;
}

export interface LogoutV2Request {
  revokeAll?: boolean;
}

export interface SessionV2Result {
  accessToken: string;
  refreshToken: string;
  jti: string;
}

export interface RedisSessionData {
  userId: string;
  tenantId?: string;
  deviceFingerprint?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
  role?: string;
  permissions?: Array<{ resource: string; action: string }>;
}

export interface RedisRefreshTokenData {
  userId: string;
  jti: string;
  familyId: string;
  createdAt: number;
}

export interface RedisAuthCodeData {
  userId: string;
  tenantId: string;
  appId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  used: boolean;
  createdAt: number;
}