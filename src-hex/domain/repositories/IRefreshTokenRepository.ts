import { RefreshToken } from '../entities/RefreshToken';
import { RefreshTokenId } from '../value-objects/Ids';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';

/**
 * IRefreshTokenRepository
 * Interface for RefreshToken persistence operations
 * Domain layer - no implementation details
 */
export interface IRefreshTokenRepository {
  /**
   * Find refresh token by ID
   */
  findById(id: RefreshTokenId): Promise<RefreshToken | null>;

  /**
   * Find refresh token by hash
   */
  findByHash(hash: string): Promise<RefreshToken | null>;

  /**
   * Find tokens by session
   */
  findBySession(sessionId: SessionId): Promise<RefreshToken[]>;

  /**
   * Find tokens by user
   */
  findByUser(userId: UserId): Promise<RefreshToken[]>;

  /**
   * Save a new refresh token
   */
  save(token: RefreshToken): Promise<void>;

  /**
   * Update an existing refresh token
   */
  update(token: RefreshToken): Promise<void>;

  /**
   * Delete a refresh token
   */
  delete(id: RefreshTokenId): Promise<void>;

  /**
   * Delete all tokens for a session
   */
  deleteAllForSession(sessionId: SessionId): Promise<number>;

  /**
   * Delete all tokens for a user
   */
  deleteAllForUser(userId: UserId): Promise<number>;

  /**
   * Delete expired tokens
   */
  deleteExpired(): Promise<number>;

  /**
   * Count active tokens for user
   */
  countActiveForUser(userId: UserId): Promise<number>;
}
