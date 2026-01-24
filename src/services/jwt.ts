import fs from 'fs';
import jwt from 'jsonwebtoken';
import jose from 'node-jose';
import path from 'path';
const KID = process.env.JWT_KID || 'sso-key-2025';

class JWTService {
  private static instance: JWTService;
  private keystore?: jose.JWK.KeyStore;
  private privateKey: Buffer;
  private publicKey: Buffer;

  private constructor() {
    const privateKeyPath = process.env.PRIVATE_KEY_PATH || path.resolve(__dirname, '../../keys/private.pem');
    const publicKeyPath = process.env.PUBLIC_KEY_PATH || path.resolve(__dirname, '../../keys/public.pem');
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
  }

  getJWKS() {
    if (!this.keystore) throw new Error('Keystore not initialized');
    return this.keystore.toJSON();
  }

  generateToken(payload: Record<string, any>, expiresInSeconds = 60 * 15) {
    const opts: jwt.SignOptions = {
      algorithm: 'RS256',
      expiresIn: expiresInSeconds,
      issuer: process.env.JWT_ISS || 'http://localhost:3567',
      audience: process.env.JWT_AUD || 'u-sso-api',
      keyid: KID
    };
    return jwt.sign(payload, this.privateKey, opts);
  }

  verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: process.env.JWT_ISS || 'http://localhost:3567',
        audience: process.env.JWT_AUD || 'u-sso-api'
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

