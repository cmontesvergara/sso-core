/**
 * UserResult
 * User data returned by use cases (DTO - no domain logic)
 */
export interface UserResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  userStatus: string;
  systemRole: string;
  tenantMemberships: Array<{
    tenantId: string;
    tenantName: string;
    role: string;
  }>;
  createdAt: Date;
  lastLoginAt?: Date;
}
