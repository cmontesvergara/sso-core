/**
 * DeviceFingerprint Value Object
 * Represents device information for security tracking
 * Immutable
 */
export interface DeviceInfo {
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export class DeviceFingerprint {
  private constructor(
    private readonly _ip: string | null,
    private readonly _userAgent: string | null,
    private readonly _fingerprint: string | null
  ) {
    Object.freeze(this);
  }

  get ip(): string | null {
    return this._ip;
  }

  get userAgent(): string | null {
    return this._userAgent;
  }

  get fingerprint(): string | null {
    return this._fingerprint;
  }

  static create(info: DeviceInfo): DeviceFingerprint {
    return new DeviceFingerprint(info.ip ?? null, info.userAgent ?? null, info.fingerprint ?? null);
  }

  toString(): string {
    return `${this._ip || 'unknown'}-${this._fingerprint || 'unknown'}`;
  }
}
