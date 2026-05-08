/**
 * ExchangeCodeInput
 * Data required for PKCE code exchange
 */
export interface ExchangeCodeInput {
  code: string;
  appId: string;
  codeVerifier?: string;
}
