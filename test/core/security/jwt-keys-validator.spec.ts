/**
 * Tests para JwtKeysValidator
 * Cubre: validatePrivateKey, validatePublicKey, verifyKeyPair, validateKeyPair, generateKeyPair
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  validatePrivateKey,
  validatePublicKey,
  verifyKeyPair,
  validateKeyPair,
  validateKeysOrThrow,
  generateKeyPair,
} from '../../../src/core/security/jwt-keys-validator';

describe('JwtKeysValidator', () => {
  // Generar keys de test una vez
  let testPrivateKey: string;
  let testPublicKey: string;
  let weakPrivateKey: string;

  beforeAll(() => {
    // Generar par de keys RSA 2048 para tests
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;

    // Generar key débil (1024 bits) para tests de validación
    const weakKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    weakPrivateKey = weakKeyPair.privateKey;
  });

  describe('validatePrivateKey', () => {
    it('debe retornar isValid: false si no es formato PEM', () => {
      // Arrange
      const invalidKey = 'not-a-valid-key';

      // Act
      const result = validatePrivateKey(invalidKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Key does not appear to be in PEM format');
    });

    it('debe retornar isValid: false si key está corrupta', () => {
      // Arrange
      const corruptKey = `-----BEGIN PRIVATE KEY-----
INVALID_BASE64_DATA
-----END PRIVATE KEY-----`;

      // Act
      const result = validatePrivateKey(corruptKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('Failed to parse private key');
    });

    it('debe retornar isValid: true para RSA 2048 válida', () => {
      // Act
      const result = validatePrivateKey(testPrivateKey);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.keySize).toBe(2048);
      expect(result.keyType).toBe('rsa');
    });

    it('debe retornar isValid: false si key size < 2048', () => {
      // Act
      const result = validatePrivateKey(weakPrivateKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('RSA key size must be at least 2048 bits (found: 1024)');
    });

    it('debe incluir keySize en el resultado', () => {
      // Act
      const result = validatePrivateKey(testPrivateKey);

      // Assert
      expect(result.keySize).toBe(2048);
    });

    it('debe incluir keyType en el resultado', () => {
      // Act
      const result = validatePrivateKey(testPrivateKey);

      // Assert
      expect(result.keyType).toBe('rsa');
    });
  });

  describe('validatePublicKey', () => {
    it('debe retornar isValid: false si no es formato PEM', () => {
      // Arrange
      const invalidKey = 'not-a-valid-key';

      // Act
      const result = validatePublicKey(invalidKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Key does not appear to be in PEM format');
    });

    it('debe retornar isValid: false si key está corrupta', () => {
      // Arrange
      const corruptKey = `-----BEGIN PUBLIC KEY-----
INVALID_BASE64_DATA
-----END PUBLIC KEY-----`;

      // Act
      const result = validatePublicKey(corruptKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('Failed to parse public key');
    });

    it('debe retornar isValid: true para RSA 2048 válida', () => {
      // Act
      const result = validatePublicKey(testPublicKey);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.keySize).toBe(2048);
      expect(result.keyType).toBe('rsa');
    });

    it('debe retornar isValid: false si key size < 2048', () => {
      // Arrange - generar key pública débil
      const weakKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 1024,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Act
      const result = validatePublicKey(weakKeyPair.publicKey);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('RSA key size must be at least 2048 bits');
    });

    it('debe incluir keySize en el resultado', () => {
      // Act
      const result = validatePublicKey(testPublicKey);

      // Assert
      expect(result.keySize).toBe(2048);
    });

    it('debe incluir keyType en el resultado', () => {
      // Act
      const result = validatePublicKey(testPublicKey);

      // Assert
      expect(result.keyType).toBe('rsa');
    });
  });

  describe('verifyKeyPair', () => {
    it('debe retornar true si keys matchean', () => {
      // Act
      const result = verifyKeyPair(testPrivateKey, testPublicKey);

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false si keys no matchean', () => {
      // Arrange - generar otro par de keys
      const otherKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Act - mezclar private de un par con public de otro
      const result = verifyKeyPair(testPrivateKey, otherKeyPair.publicKey);

      // Assert
      expect(result).toBe(false);
    });

    it('debe retornar false si una key es inválida', () => {
      // Arrange
      const invalidKey = 'not-a-valid-key';

      // Act
      const result = verifyKeyPair(invalidKey, testPublicKey);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('validateKeyPair', () => {
    const tempDir = '/tmp/jwt-keys-test-' + Date.now();

    beforeEach(() => {
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('debe retornar isValid: false si private key no existe', () => {
      // Arrange
      const publicKeyPath = tempDir + '/public.pem';
      fs.writeFileSync(publicKeyPath, testPublicKey);

      // Act
      const result = validateKeyPair(tempDir + '/private.pem', publicKeyPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('Private key file not found');
    });

    it('debe retornar isValid: false si public key no existe', () => {
      // Arrange
      const privateKeyPath = tempDir + '/private.pem';
      fs.writeFileSync(privateKeyPath, testPrivateKey);

      // Act
      const result = validateKeyPair(privateKeyPath, tempDir + '/public.pem');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('Public key file not found');
    });

    it('debe retornar isValid: false si keys no matchean', () => {
      // Arrange - generar otro par
      const otherKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      const privateKeyPath = tempDir + '/private.pem';
      const publicKeyPath = tempDir + '/public.pem';

      fs.writeFileSync(privateKeyPath, testPrivateKey);
      fs.writeFileSync(publicKeyPath, otherKeyPair.publicKey);

      // Act
      const result = validateKeyPair(privateKeyPath, publicKeyPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private and public keys do not match');
    });

    it('debe retornar isValid: true para par válido', () => {
      // Arrange
      const privateKeyPath = tempDir + '/private.pem';
      const publicKeyPath = tempDir + '/public.pem';

      fs.writeFileSync(privateKeyPath, testPrivateKey);
      fs.writeFileSync(publicKeyPath, testPublicKey);

      // Act
      const result = validateKeyPair(privateKeyPath, publicKeyPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.privateKey?.isValid).toBe(true);
      expect(result.publicKey?.isValid).toBe(true);
    });

    it('debe incluir privateKey y publicKey en el resultado', () => {
      // Arrange
      const privateKeyPath = tempDir + '/private.pem';
      const publicKeyPath = tempDir + '/public.pem';

      fs.writeFileSync(privateKeyPath, testPrivateKey);
      fs.writeFileSync(publicKeyPath, testPublicKey);

      // Act
      const result = validateKeyPair(privateKeyPath, publicKeyPath);

      // Assert
      expect(result.privateKey).toBeDefined();
      expect(result.publicKey).toBeDefined();
    });
  });

  describe('validateKeysOrThrow', () => {
    const tempDir = '/tmp/jwt-keys-validate-test-' + Date.now();

    beforeEach(() => {
      fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('debe lanzar error si keys son inválidas', () => {
      // Arrange
      const privateKeyPath = tempDir + '/private.pem';
      const publicKeyPath = tempDir + '/public.pem';

      fs.writeFileSync(privateKeyPath, 'invalid-key');
      fs.writeFileSync(publicKeyPath, testPublicKey);

      // Act & Assert
      expect(() => validateKeysOrThrow(privateKeyPath, publicKeyPath)).toThrow(
        'JWT Keys validation failed'
      );
    });

    it('debe incluir lista de errores en el mensaje', () => {
      // Arrange
      const privateKeyPath = tempDir + '/private.pem';

      // Act & Assert
      expect(() => validateKeysOrThrow(privateKeyPath, tempDir + '/public.pem')).toThrow(
        /JWT Keys validation failed/
      );
    });

    it('debe ejecutar sin error para keys válidas', () => {
      // Arrange - generate fresh keys for this test
      const validKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      const privateKeyPath = tempDir + '/private.pem';
      const publicKeyPath = tempDir + '/public.pem';

      fs.writeFileSync(privateKeyPath, validKeyPair.privateKey);
      fs.writeFileSync(publicKeyPath, validKeyPair.publicKey);

      // Act & Assert
      expect(() => validateKeysOrThrow(privateKeyPath, publicKeyPath)).not.toThrow();
    });
  });

  describe('generateKeyPair', () => {
    it('debe generar par de keys RSA', () => {
      // Act
      const { privateKey, publicKey } = generateKeyPair();

      // Assert
      expect(privateKey).toContain('-----BEGIN');
      expect(publicKey).toContain('-----BEGIN');
    });

    it('debe usar key size por defecto 3072', () => {
      // Act
      const { privateKey, publicKey } = generateKeyPair();

      // Assert
      const privateKeyResult = validatePrivateKey(privateKey);
      const publicKeyResult = validatePublicKey(publicKey);

      expect(privateKeyResult.keySize).toBe(3072);
      expect(publicKeyResult.keySize).toBe(3072);
    });

    it('debe permitir key size customizado', () => {
      // Act
      const { privateKey, publicKey } = generateKeyPair(4096);

      // Assert
      const privateKeyResult = validatePrivateKey(privateKey);
      const publicKeyResult = validatePublicKey(publicKey);

      expect(privateKeyResult.keySize).toBe(4096);
      expect(publicKeyResult.keySize).toBe(4096);
    });

    it('debe retornar privateKey y publicKey en formato PEM', () => {
      // Act
      const { privateKey, publicKey } = generateKeyPair();

      // Assert
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    it('debe generar keys que matchean', () => {
      // Act
      const { privateKey, publicKey } = generateKeyPair();

      // Assert
      expect(verifyKeyPair(privateKey, publicKey)).toBe(true);
    });
  });
});
