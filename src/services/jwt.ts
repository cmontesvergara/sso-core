import fs from 'fs';
import jwt from 'jsonwebtoken';
import jose from 'node-jose';
import path from 'path';
import { validateKeysOrThrow } from '../core/security/jwt-keys-validator';

const KID = process.env.JWT_KID || 'sso-key-2025';

class JWTService {
  private static instance: JWTService;
  private keystore?: jose.JWK.KeyStore;
  private privateKey: Buffer;
  private publicKey: Buffer;
  private cachedJWKS?: any;
  private cachedJWKSString?: string;

  private constructor() {
    const privateKeyPath = process.env.PRIVATE_KEY_PATH || path.resolve(__dirname, '../../keys/private.pem');
    const publicKeyPath = process.env.PUBLIC_KEY_PATH || path.resolve(__dirname, '../../keys/public.pem');

    // Validate keys before reading
    validateKeysOrThrow(privateKeyPath, publicKeyPath);

    this.privateKey = fs.readFileSync(privateKeyPath);
    this.publicKey = fs.readFileSync(publicKeyPath);
  }

  static getInstance(): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService();
    }
    return JWTService.instance;
  }

  async initKeys(): Promise<void> {
    this.keystore = jose.JWK.createKeyStore();
    const key = await jose.JWK.asKey(this.privateKey, 'pem', { kid: KID });
    await this.keystore.add(key);
    this.cachedJWKS = this.keystore.toJSON();
    this.cachedJWKSString = JSON.stringify(this.cachedJWKS);
  }

  getJWKS() {
    if (!this.cachedJWKS) throw new Error('Keystore not initialized');
    return this.cachedJWKS;
  }

  getJWKSString() {
    if (!this.cachedJWKSString) throw new Error('Keystore not initialized');
    return this.cachedJWKSString;
  }

  generateToken(payload: Record<string, any>, expiresInSeconds: number = 60 * 15, audience?: string) {
    const opts: jwt.SignOptions = {
      algorithm: 'RS256',
      expiresIn: expiresInSeconds,
      issuer: process.env.JWT_ISS || 'https://sso.bigso.co',
      audience: audience || process.env.JWT_AUD || 'https://sso.bigso.co',
      keyid: KID
    };
    return jwt.sign(payload, this.privateKey, opts);
  }

  verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: process.env.JWT_ISS || 'https://sso.bigso.co',
        audience: process.env.JWT_AUD || 'https://sso.bigso.co'
      });
      return decoded;
    } catch (err) {
      console.error('JWT verification failed:', err);
      throw err;
    }
  }

  decodeToken(token: string) {
    return jwt.decode(token) as Record<string, any> | null;
  }

  /**
   * Generate temporary token for 2FA verification
   * Short-lived (5 minutes) token used during 2FA flow
   */
  generateTwoFactorToken(userId: string): string {
    const payload = {
      userId,
      purpose: '2fa-pending',
    };
    // 5 minutes expiration
    return this.generateToken(payload, 5 * 60);
  }

  /**
   * Verify and decode 2FA temporary token
   */
  verifyTwoFactorToken(token: string): { userId: string } | null {
    try {
      const decoded = this.verifyToken(token) as any;

      // Validate it's a 2FA token
      if (decoded.purpose !== '2fa-pending') {
        return null;
      }

      return { userId: decoded.userId };
    } catch (err) {
      return null;
    }
  }
}

export const JWT = JWTService.getInstance();

