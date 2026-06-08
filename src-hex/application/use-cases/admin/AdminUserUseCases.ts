import { IUserQueryService } from '../../ports/output/IUserQueryService';

/**
 * AdminUserUseCases
 *
 * Aggregates all user-admin operations into a single injectable service.
 * Uses IUserQueryService to keep the application layer independent of the ORM.
 */
export class AdminUserUseCases {
  constructor(private readonly userQueryService: IUserQueryService) { }

  // ── LIST ──────────────────────────────────────────────────────────────────

  async listUsers(query: any) {
    return this.userQueryService.listUsers(query);
  }

  // ── GET BY ID (with addresses) ────────────────────────────────────────────

  async getUserById(userId: string) {
    return this.userQueryService.getUserById(userId);
  }

  // ── GET USER TENANTS + APPS ───────────────────────────────────────────────

  async getUserTenantsWithApps(userId: string) {
    return this.userQueryService.getUserTenantsWithApps(userId);
  }

  // ── UPDATE PROFILE ────────────────────────────────────────────────────────

  async updateProfile(userId: string, data: {
    firstName?: string; secondName?: string; lastName?: string; secondLastName?: string;
    phone?: string; birthDate?: Date; gender?: string; nationality?: string;
    birthPlace?: string; placeOfResidence?: string; occupation?: string; maritalStatus?: string;
  }, addresses?: Array<{ country: string; province: string; city: string; detail: string; postalCode?: string }>) {
    return this.userQueryService.updateProfile(userId, data, addresses);
  }

  // ── UPDATE STATUS ─────────────────────────────────────────────────────────

  async updateStatus(userId: string, status: string) {
    return this.userQueryService.updateUserStatus(userId, status);
  }
}
