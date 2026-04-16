/**
 * Security Initialization
 *
 * Validates all security-critical configuration at application startup.
 * This should be called early in the server bootstrap process.
 *
 * Validates:
 * - PEPPER (length, entropy, diversity)
 * - JWT Keys (RSA size, format, key pair match)
 * - Rate limits (security thresholds)
 */

import { Logger } from '../../utils/logger';
import { validatePepperOrThrow } from './pepper-validator';
import { validateKeysOrThrow } from './jwt-keys-validator';

interface SecurityValidationResult {
  allValid: boolean;
  checks: {
    pepper: { valid: boolean; message: string };
    jwtKeys: { valid: boolean; message: string };
    rateLimit: { valid: boolean; message: string };
  };
}

/**
 * Validate rate limit configuration
 */
function validateRateLimit(): { valid: boolean; message: string } {
  const loginRateLimit = parseInt(process.env.LOGIN_RATE_LIMIT || '10', 10);
  const loginRateWindow = parseInt(process.env.LOGIN_RATE_WINDOW || '15', 10);

  // Calculate max attempts per day
  const attemptsPerMinute = loginRateLimit / loginRateWindow;
  const attemptsPerDay = attemptsPerMinute * 60 * 24;

  // Warn if more than 100 attempts per day allowed
  if (attemptsPerDay > 100) {
    return {
      valid: false,
      message: `Login rate limit too permissive: ${attemptsPerDay.toFixed(0)} attempts/day allowed (recommended: ≤100)`,
    };
  }

  return {
    valid: true,
    message: `Login rate limit: ${loginRateLimit} attempts per ${loginRateWindow} minutes`,
  };
}

/**
 * Run all security validations
 */
export function initializeSecurity(): SecurityValidationResult {
  const result: SecurityValidationResult = {
    allValid: true,
    checks: {
      pepper: { valid: false, message: '' },
      jwtKeys: { valid: false, message: '' },
      rateLimit: { valid: false, message: '' },
    },
  };

  Logger.info('🔒 Running security validations...');

  // Validate PEPPER
  try {
    validatePepperOrThrow(process.env.REFRESH_TOKEN_PEPPER);
    result.checks.pepper = {
      valid: true,
      message: 'PEPPER validation passed',
    };
  } catch (error: any) {
    result.checks.pepper = {
      valid: false,
      message: error.message,
    };
    result.allValid = false;
  }

  // Validate JWT Keys
  try {
    validateKeysOrThrow();
    result.checks.jwtKeys = {
      valid: true,
      message: 'JWT keys validation passed',
    };
  } catch (error: any) {
    result.checks.jwtKeys = {
      valid: false,
      message: error.message,
    };
    result.allValid = false;
  }

  // Validate Rate Limits
  const rateLimitResult = validateRateLimit();
  result.checks.rateLimit = rateLimitResult;
  if (!rateLimitResult.valid) {
    result.allValid = false;
  }

  // Log results
  if (result.allValid) {
    Logger.info('✅ All security validations passed');
  } else {
    Logger.error('❌ Security validation failed:');
    for (const [check, { valid, message }] of Object.entries(result.checks)) {
      if (!valid) {
        Logger.error(`  - ${check}: ${message}`);
      }
    }
    throw new Error('Security validation failed. Check logs for details.');
  }

  return result;
}
