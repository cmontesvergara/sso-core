/**
 * Utility functions
 */

export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  return password.length >= 8;
}

export function validateInput(value: any, type: string, required: boolean = true): boolean {
  if (required && !value) return false;

  switch (type) {
    case 'email':
      return !value || isValidEmail(value);
    case 'password':
      return !value || isValidPassword(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
}

export function calculateTokenExpiry(seconds: number): Date {
  const now = new Date();
  return new Date(now.getTime() + seconds * 1000);
}

export function isTokenExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function omit<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}
