import { DeviceFingerprint } from '../../../domain/value-objects/DeviceFingerprint';

/**
 * CreateSessionInput
 * Data required for creating a session
 */
export interface CreateSessionInput {
  userId: string;
  tenantId?: string;
  appId: string;
  deviceFingerprint?: DeviceFingerprint;
  expiresInSeconds?: number;
}
