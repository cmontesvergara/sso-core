import { DomainError } from './DomainError';

export class TenantAccessDeniedError extends DomainError {
  readonly code = 'TENANT_ACCESS_DENIED';
  readonly statusCode = 403;
  readonly userId: string;
  readonly tenantId: string;

  constructor(userId: string, tenantId: string) {
    super(`User ${userId} does not have access to tenant ${tenantId}`);
    this.userId = userId;
    this.tenantId = tenantId;
    Object.setPrototypeOf(this, TenantAccessDeniedError.prototype);
  }
}
