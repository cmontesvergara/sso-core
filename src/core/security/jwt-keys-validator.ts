/**
 * JWT Keys Validation Service
 *
 * Validates RSA key pairs used for JWT signing
 * to ensure they meet security requirements.
 *
 * Security Requirements:
 * - RSA keys with minimum 2048-bit length
 * - Valid PEM format
 * - Matching public/private key pair
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface KeyValidationResult {
  isValid: boolean;
  errors: string[];
  keySize?: number;
  keyType?: string;
}

interface KeyPairValidationResult {
  isValid: boolean;
  errors: string[];
  privateKey?: KeyValidationResult;
  publicKey?: KeyValidationResult;
}

/**
 * Validate a PEM-encoded RSA private key
 */
export function validatePrivateKey(pemContent: string): KeyValidationResult {
  const errors: string[] = [];

  // Check PEM format
  if (!pemContent.includes('-----BEGIN')) {
    return {
      isValid: false,
      errors: ['Key does not appear to be in PEM format'],
    };
  }

  try {
    // Try to parse the key
    const key = crypto.createPrivateKey({
      key: pemContent,
      format: 'pem',
    });

    // Extract key details - note: asymmetricKeyDetails may not have 'type' in all Node versions
    const keyDetails = key.asymmetricKeyDetails;

    if (!keyDetails) {
      errors.push('Could not extract key details');
    } else {
      // Check key size for RSA keys
      const modulusLength = (keyDetails as any).modulusLength as number | undefined;

      // Detect RSA by checking if modulusLength exists (RSA-specific property)
      const isRsa = modulusLength !== undefined;

      if (!isRsa) {
        errors.push('Key type must be RSA (could not detect RSA key)');
      }

      // Check key size (only for RSA)
      if (isRsa && modulusLength) {
        const keySize = modulusLength;

        if (keySize < 2048) {
          errors.push(`RSA key size must be at least 2048 bits (found: ${keySize})`);
        }

        if (keySize < 3072) {
          console.warn('⚠️  Warning: RSA key size below recommended 3072 bits');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      keySize: (keyDetails as any)?.modulusLength as number | undefined,
      keyType: 'rsa', // We only support RSA, so if parsing succeeded, it's RSA
    };
  } catch (error: any) {
    return {
      isValid: false,
      errors: [`Failed to parse private key: ${error.message}`],
    };
  }
}

/**
 * Validate a PEM-encoded RSA public key
 */
export function validatePublicKey(pemContent: string): KeyValidationResult {
  const errors: string[] = [];

  // Check PEM format
  if (!pemContent.includes('-----BEGIN')) {
    return {
      isValid: false,
      errors: ['Key does not appear to be in PEM format'],
    };
  }

  try {
    // Try to parse the key
    const key = crypto.createPublicKey({
      key: pemContent,
      format: 'pem',
    });

    // Extract key details - note: asymmetricKeyDetails may not have 'type' in all Node versions
    const keyDetails = key.asymmetricKeyDetails;

    if (!keyDetails) {
      errors.push('Could not extract key details');
    } else {
      // Check key size for RSA keys
      const modulusLength = (keyDetails as any).modulusLength as number | undefined;

      // Detect RSA by checking if modulusLength exists (RSA-specific property)
      const isRsa = modulusLength !== undefined;

      if (!isRsa) {
        errors.push('Key type must be RSA (could not detect RSA key)');
      }

      // Check key size (only for RSA)
      if (isRsa && modulusLength) {
        const keySize = modulusLength;

        if (keySize < 2048) {
          errors.push(`RSA key size must be at least 2048 bits (found: ${keySize})`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      keySize: (keyDetails as any)?.modulusLength as number | undefined,
      keyType: 'rsa', // We only support RSA, so if parsing succeeded, it's RSA
    };
  } catch (error: any) {
    return {
      isValid: false,
      errors: [`Failed to parse public key: ${error.message}`],
    };
  }
}

/**
 * Verify that a public key matches a private key
 */
export function verifyKeyPair(privateKeyPem: string, publicKeyPem: string): boolean {
  try {
    // Create a test message
    const testData = Buffer.from('key-pair-verification-test');

    // Sign with private key
    const sign = crypto.createSign('SHA256');
    sign.update(testData);
    sign.end();
    const signature = sign.sign(privateKeyPem);

    // Verify with public key
    const verify = crypto.createVerify('SHA256');
    verify.update(testData);
    verify.end();

    return verify.verify(publicKeyPem, signature);
  } catch (error) {
    console.error('Key pair verification failed:', error);
    return false;
  }
}

/**
 * Validate JWT key pair from files
 */
export function validateKeyPair(
  privateKeyPath: string,
  publicKeyPath: string
): KeyPairValidationResult {
  const result: KeyPairValidationResult = {
    isValid: true,
    errors: [],
  };

  // Check files exist
  if (!fs.existsSync(privateKeyPath)) {
    result.errors.push(`Private key file not found: ${privateKeyPath}`);
    result.isValid = false;
  }

  if (!fs.existsSync(publicKeyPath)) {
    result.errors.push(`Public key file not found: ${publicKeyPath}`);
    result.isValid = false;
  }

  if (!result.isValid) {
    return result;
  }

  // Read key files
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
  const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf-8');

  // Validate private key
  result.privateKey = validatePrivateKey(privateKeyPem);
  if (!result.privateKey.isValid) {
    result.errors.push(...result.privateKey.errors.map(e => `Private key: ${e}`));
    result.isValid = false;
  }

  // Validate public key
  result.publicKey = validatePublicKey(publicKeyPem);
  if (!result.publicKey.isValid) {
    result.errors.push(...result.publicKey.errors.map(e => `Public key: ${e}`));
    result.isValid = false;
  }

  // Verify key pair match
  if (result.privateKey.isValid && result.publicKey.isValid) {
    const keysMatch = verifyKeyPair(privateKeyPem, publicKeyPem);
    if (!keysMatch) {
      result.errors.push('Private and public keys do not match');
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Validate JWT keys and throw if invalid (for startup validation)
 */
export function validateKeysOrThrow(
  privateKeyPath?: string,
  publicKeyPath?: string
): void {
  const defaultPrivateKeyPath = privateKeyPath || path.resolve(__dirname, '../../keys/private.pem');
  const defaultPublicKeyPath = publicKeyPath || path.resolve(__dirname, '../../keys/public.pem');

  const result = validateKeyPair(defaultPrivateKeyPath, defaultPublicKeyPath);

  if (!result.isValid) {
    throw new Error(
      `JWT Keys validation failed:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  console.log('✅ JWT Keys validated successfully', {
    privateKeySize: result.privateKey?.keySize,
    publicKeySize: result.publicKey?.keySize,
    keysMatch: true,
  });
}

/**
 * Generate a new RSA key pair for JWT signing
 * For use in development or initial setup
 */
export function generateKeyPair(keySize: number = 3072): {
  privateKey: string;
  publicKey: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { privateKey, publicKey };
}
