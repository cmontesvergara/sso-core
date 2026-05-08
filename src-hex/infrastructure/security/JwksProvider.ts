import * as jose from 'node-jose';

export class JwksProvider {
  private cachedJwksString: string | null = null;

  constructor(
    private readonly privateKey: string,
    private readonly kid: string = process.env.JWT_KID || 'sso-key-2025'
  ) {}

  async initialize(): Promise<void> {
    const keystore = jose.JWK.createKeyStore();
    // node-jose accepts PEM strings directly
    const key = await jose.JWK.asKey(this.privateKey, 'pem', { kid: this.kid });
    await keystore.add(key);
    
    // Generate public JWKS (without private material)
    const jwks = keystore.toJSON(false);
    this.cachedJwksString = JSON.stringify(jwks);
  }

  getJwksString(): string {
    if (!this.cachedJwksString) {
      throw new Error('JwksProvider has not been initialized. Call initialize() first.');
    }
    return this.cachedJwksString;
  }
}
