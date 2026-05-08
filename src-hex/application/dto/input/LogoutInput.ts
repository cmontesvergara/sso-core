import { SessionId } from '../../../domain/value-objects/SessionId';

/**
 * LogoutInput
 * Data required for logout
 */
export interface LogoutInput {
  sessionId: SessionId;
  userId: string;
  isGlobal?: boolean;
}
