/**
 * TenantResult
 * Tenant data returned by use cases
 */
export interface TenantResult {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: {
    maxUsers?: number;
    allowedDomains?: string[];
    mfaRequired?: boolean;
    sessionTimeout?: number;
  };
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}
