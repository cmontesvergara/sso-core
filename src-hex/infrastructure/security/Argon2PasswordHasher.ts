import { IPasswordHasher } from '../../domain/services/AuthenticationService';
import argon2 from 'argon2';

/**
 * Argon2PasswordHasher
 * Implementation of IPasswordHasher using Argon2
 */
export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch {
      return false;
    }
  }
}
