/**
 * CreateTenantInput
 * Data required for creating a tenant
 */
export interface CreateTenantInput {
  name: string;
  slug?: string;
  createdByUserId: string;
  settings?: {
    maxUsers?: number;
    allowedDomains?: string[];
    mfaRequired?: boolean;
    sessionTimeout?: number;
  };
}
