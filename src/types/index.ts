export interface User {
  userId: string;
  email: string;
  tenantId?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  sessionId: string;
  userId: string;
  tenantId?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  tenantId: string;
  name: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  roleId: string;
  tenantId?: string;
  name: string;
  description?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMetadata {
  userId: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailVerificationToken {
  tokenId: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
