/**
 * PEPPER Validation Service
 *
 * Validates the REFRESH_TOKEN_PEPPER environment variable
 * to ensure it meets security requirements.
 *
 * Security Requirements:
 * - Minimum 32 characters
 * - High entropy (random characters)
 * - Not a common/weak pattern
 */

interface PepperValidationResult {
  isValid: boolean;
  errors: string[];
  entropy?: number;
}

/**
 * Common weak patterns to reject
 */
const WEAK_PATTERNS = [
  /^([a-z])\1+$/i, // Repeated character (aaaa, bbbb)
  /^(123|abc|qwe|asd|zxc)+/i, // Keyboard patterns
  /^(password|secret|key|pepper|token)/i, // Common words
  /^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID without variation
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy = more random = more secure
 */
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};

  // Count character frequency
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  // Calculate entropy
  let entropy = 0;
  const len = str.length;

  for (const count of Object.values(freq)) {
    const probability = count / len;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Check if string contains weak patterns
 */
function hasWeakPattern(str: string): string | null {
  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(str)) {
      return pattern.source;
    }
  }
  return null;
}

/**
 * Check character diversity in pepper
 */
function checkCharacterDiversity(str: string): {
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasDigits: boolean;
  hasSpecial: boolean;
  diversityScore: number;
} {
  const hasLowercase = /[a-z]/.test(str);
  const hasUppercase = /[A-Z]/.test(str);
  const hasDigits = /[0-9]/.test(str);
  const hasSpecial = /[^a-zA-Z0-9]/.test(str);

  const diversityScore = [hasLowercase, hasUppercase, hasDigits, hasSpecial]
    .filter(Boolean).length;

  return {
    hasLowercase,
    hasUppercase,
    hasDigits,
    hasSpecial,
    diversityScore,
  };
}

/**
 * Validate PEPPER value
 */
export function validatePepper(pepper: string | undefined): PepperValidationResult {
  const errors: string[] = [];

  // Check if exists
  if (!pepper) {
    return {
      isValid: false,
      errors: ['PEPPER is not set'],
    };
  }

  // Check minimum length
  if (pepper.length < 32) {
    errors.push(`PEPPER must be at least 32 characters (current: ${pepper.length})`);
  }

  // Check for weak patterns
  const weakPattern = hasWeakPattern(pepper);
  if (weakPattern) {
    errors.push('PEPPER contains weak/predictable pattern');
  }

  // Calculate entropy
  const entropy = calculateEntropy(pepper);
  const minEntropy = 4.0; // Minimum acceptable entropy

  if (entropy < minEntropy) {
    errors.push(`PEPPER entropy too low (${entropy.toFixed(2)}, minimum: ${minEntropy})`);
  }

  // Check character diversity
  const diversity = checkCharacterDiversity(pepper);

  if (diversity.diversityScore < 3) {
    errors.push(`PEPPER lacks character diversity (uses ${diversity.diversityScore}/4 character types)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    entropy,
  };
}

/**
 * Validate PEPPER and throw if invalid (for startup validation)
 */
export function validatePepperOrThrow(pepper: string | undefined): void {
  const result = validatePepper(pepper);

  if (!result.isValid) {
    throw new Error(
      `PEPPER validation failed:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  console.log('✅ PEPPER validated successfully', {
    length: pepper?.length,
    entropy: result.entropy?.toFixed(2),
  });
}

/**
 * Generate a secure PEPPER value
 * For use in development or initial setup
 */
export function generateSecurePepper(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}
