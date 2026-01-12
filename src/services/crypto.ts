import bcrypt from 'bcryptjs';

/**
 * Crypto Service for password and token hashing
 */
export class CryptoService {
  private static instance: CryptoService;

  private constructor() {}

  static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * Hash a password
   */
  async hashPassword(password: string, rounds: number = 10): Promise<string> {
    return bcrypt.hash(password, rounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random token
   */
  generateToken(length: number = 32): string {
    return Math.random().toString(36).substring(2, length + 2);
  }

  /**
   * Generate UUID
   */
  generateId(): string {
    return require('uuid').v4();
  }
}
