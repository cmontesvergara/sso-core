/**
 * Legacy compatibility wrapper for AuthServiceV2
 *
 * DEPRECATED: This file exists for backward compatibility only.
 * New code should use the injected services from the container.
 *
 * @deprecated Use container.get('AuthServiceV2') instead
 */

import { getContainer } from '../core/container-config';
import { AuthServiceV2, LoginV2Options, LoginV2Result } from './authV2';

/**
 * Legacy AuthV2 wrapper
 * Uses container to resolve the actual service implementation
 */
class LegacyAuthV2Service {
  private get authService(): AuthServiceV2 {
    return getContainer().get<AuthServiceV2>('AuthServiceV2');
  }

  async login(options: LoginV2Options): Promise<LoginV2Result> {
    return this.authService.login(options);
  }
}

// Export singleton instance for backward compatibility
export const AuthV2 = new LegacyAuthV2Service();

// Re-export types for compatibility
export { AuthServiceV2, LoginV2Options, LoginV2Result };
