import argon2 from 'argon2';

/**
 * Crypto Service for password and token hashing
 * Uses Argon2 for password hashing (resistant to GPU/ASIC attacks)
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
   * Hash a password using Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19 * 1024, // 19 MB
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Compare password with Argon2 hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
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
