import {
  enableAppForTenant,
  listTenantApps,
  removeAppFromTenant,
} from '../repositories/tenantAppRepo.prisma';
import { findTenantById } from '../repositories/tenantRepo.prisma';

export class TenantAppService {
  static async getTenantApps(tenantId: string) {
    // Verifica que el tenant exista
    const tenant = await findTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    return listTenantApps(tenantId);
  }

  static async addAppToTenant(tenantId: string, applicationId: string) {
    // Verifica que el tenant exista
    const tenant = await findTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    // enableAppForTenant will validate that the application exists via FK constraint
    return enableAppForTenant({ tenantId, applicationId });
  }

  static async removeAppFromTenant(tenantId: string, applicationId: string) {
    // Verifica que el tenant exista
    const tenant = await findTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    return removeAppFromTenant(tenantId, applicationId);
  }
}
