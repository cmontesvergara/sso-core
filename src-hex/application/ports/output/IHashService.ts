/**
 * IHashService
 * Output port for HMAC hashing of sensitive tokens.
 * Implemented by HmacSha256HashService in the infrastructure layer.
 */
export interface IHashService {
  /** Returns HMAC-SHA256 hex digest of value */
  hash(value: string): string;
  /** Constant-time comparison */
  verify(value: string, storedHash: string): boolean;
}
