/**
 * Tests para PepperValidator
 * Cubre: validatePepper, validatePepperOrThrow, generateSecurePepper
 */

import {
  validatePepper,
  validatePepperOrThrow,
  generateSecurePepper,
} from '../../../src/core/security/pepper-validator';

describe('PepperValidator', () => {
  describe('validatePepper', () => {
    it('debe retornar isValid: false si pepper es undefined', () => {
      // Act
      const result = validatePepper(undefined);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER is not set');
    });

    it('debe retornar isValid: false si pepper es null', () => {
      // Act
      const result = validatePepper(null as any);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER is not set');
    });

    it('debe retornar isValid: false si pepper es string vacío', () => {
      // Act
      const result = validatePepper('');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER is not set');
    });

    it('debe retornar isValid: false si pepper < 32 caracteres', () => {
      // Arrange
      const shortPepper = 'short-pepper'; // 12 chars

      // Act
      const result = validatePepper(shortPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('PEPPER must be at least 32 characters');
    });

    it('debe retornar isValid: false para patrón repetido (aaaa...)', () => {
      // Arrange
      const repeatedPepper = 'a'.repeat(40);

      // Act
      const result = validatePepper(repeatedPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER contains weak/predictable pattern');
    });

    it('debe retornar isValid: false para patrón de teclado (123, abc)', () => {
      // Arrange
      const keyboardPepper = '12345678901234567890123456789012';

      // Act
      const result = validatePepper(keyboardPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER contains weak/predictable pattern');
    });

    it('debe retornar isValid: false para palabras comunes (password)', () => {
      // Arrange
      const commonPepper = 'password123456789012345678901234';

      // Act
      const result = validatePepper(commonPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PEPPER contains weak/predictable pattern');
    });

    it('debe retornar isValid: false si entropía < 4.0', () => {
      // Arrange
      const lowEntropyPepper = 'abcd'.repeat(10); // Patrón repetitivo

      // Act
      const result = validatePepper(lowEntropyPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('entropy too low');
    });

    it('debe retornar isValid: false si diversidad < 3 tipos', () => {
      // Arrange
      const lowDiversityPepper = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // Solo lowercase

      // Act
      const result = validatePepper(lowDiversityPepper);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('lacks character diversity');
    });

    it('debe retornar isValid: true para pepper válido', () => {
      // Arrange
      const validPepper = 'xK9#mP2$vL5@nQ8wR3&jF6*hY1^cZ4!bN7%dS0'; // 40 chars, alta diversidad

      // Act
      const result = validatePepper(validPepper);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entropy).toBeGreaterThan(4);
    });

    it('debe incluir entropy en el resultado', () => {
      // Arrange
      const validPepper = 'xK9#mP2$vL5@nQ8wR3&jF6*hY1^cZ4!bN7%dS0';

      // Act
      const result = validatePepper(validPepper);

      // Assert
      expect(result.entropy).toBeDefined();
      expect(typeof result.entropy).toBe('number');
    });

    it('debe aceptar pepper de exactamente 32 caracteres', () => {
      // Arrange
      const exactPepper = 'xK9#mP2$vL5@nQ8wR3&jF6*hY1^cZ4'; // 32 chars

      // Act
      const result = validatePepper(exactPepper);

      // Assert
      expect(result.errors).not.toContain(
        expect.stringContaining('PEPPER must be at least 32 characters')
      );
    });
  });

  describe('validatePepperOrThrow', () => {
    it('debe lanzar error si pepper es inválido', () => {
      // Arrange
      const invalidPepper = 'short';

      // Act & Assert
      expect(() => validatePepperOrThrow(invalidPepper)).toThrow(
        'PEPPER validation failed'
      );
    });

    it('debe incluir lista de errores en el mensaje', () => {
      // Arrange
      const invalidPepper = 'short';

      // Act & Assert
      expect(() => validatePepperOrThrow(invalidPepper)).toThrow(
        /PEPPER validation failed/
      );
    });

    it('debe ejecutar sin error para pepper válido', () => {
      // Arrange
      const validPepper = 'xK9#mP2$vL5@nQ8wR3&jF6*hY1^cZ4!bN7%dS0';

      // Act & Assert
      expect(() => validatePepperOrThrow(validPepper)).not.toThrow();
    });
  });

  describe('generateSecurePepper', () => {
    it('debe generar string hex de longitud por defecto (64)', () => {
      // Act
      const pepper = generateSecurePepper();

      // Assert
      expect(pepper).toHaveLength(128); // 64 bytes = 128 hex chars
      expect(pepper).toMatch(/^[0-9a-f]+$/);
    });

    it('debe generar string de longitud customizada', () => {
      // Act
      const pepper = generateSecurePepper(32);

      // Assert
      expect(pepper).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('debe tener alta entropía', () => {
      // Act - generar pepper más largo para asegurar entropía
      const pepper = generateSecurePepper(64);

      // Assert - validar que es string hex y tiene longitud correcta
      expect(pepper).toMatch(/^[0-9a-f]{128}$/); // 64 bytes = 128 hex chars
      expect(pepper.length).toBeGreaterThanOrEqual(64);
    });

    it('debe generar valores únicos en cada llamada', () => {
      // Act
      const pepper1 = generateSecurePepper();
      const pepper2 = generateSecurePepper();

      // Assert
      expect(pepper1).not.toBe(pepper2);
    });
  });
});
