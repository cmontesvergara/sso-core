/**
 * Validation utilities
 */

export interface ValidationError {
  field: string;
  message: string;
}

export class Validator {
  private errors: ValidationError[] = [];

  static create(): Validator {
    return new Validator();
  }

  isRequired(value: any, field: string): this {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      this.errors.push({
        field,
        message: `${field} is required`,
      });
    }
    return this;
  }

  isEmail(value: any, field: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      this.errors.push({
        field,
        message: `${field} must be a valid email`,
      });
    }
    return this;
  }

  isString(value: any, field: string): this {
    if (value && typeof value !== 'string') {
      this.errors.push({
        field,
        message: `${field} must be a string`,
      });
    }
    return this;
  }

  minLength(value: any, min: number, field: string): this {
    if (value && typeof value === 'string' && value.length < min) {
      this.errors.push({
        field,
        message: `${field} must be at least ${min} characters`,
      });
    }
    return this;
  }

  maxLength(value: any, max: number, field: string): this {
    if (value && typeof value === 'string' && value.length > max) {
      this.errors.push({
        field,
        message: `${field} must not exceed ${max} characters`,
      });
    }
    return this;
  }

  isValid(): boolean {
    return this.errors.length === 0;
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }

  throwIfInvalid(): void {
    if (!this.isValid()) {
      throw {
        statusCode: 400,
        message: 'Validation failed',
        errors: this.errors,
      };
    }
  }
}
