import { DeviceFingerprint } from '../../../domain/value-objects/DeviceFingerprint';

/**
 * LoginInput
 * Data required for user authentication
 */
export interface LoginInput {
  email?: string;
  nuid?: string;
  password: string;
  appId: string;
  tenantId: string;
  deviceFingerprint?: DeviceFingerprint;
}
