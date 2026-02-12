
import { AppResourceService } from './appResource';
import { findApplicationByAppId, findApplicationById } from '../repositories/applicationRepo.prisma';
import { findTenantApp } from '../repositories/appResourceRepo.prisma';

// Mock dependencies
jest.mock('../repositories/applicationRepo.prisma');
jest.mock('../repositories/appResourceRepo.prisma');

describe('AppResourceService', () => {
    const mockFindApplicationByAppId = findApplicationByAppId as jest.Mock;
    const mockFindApplicationById = findApplicationById as jest.Mock;
    const mockFindTenantApp = findTenantApp as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateTenantAccess', () => {
        const tenantId = 'tenant-123';
        const appIdUuid = 'b1804dc9-4cc6-4604-9477-8997337098b9';
        const appIdSlug = 'sso-portal';

        it('should validate access when looking up by UUID (ID)', async () => {
            // Setup mocks
            mockFindApplicationById.mockResolvedValue({
                id: appIdUuid,
                appId: appIdSlug,
                name: 'Test App'
            });
            mockFindTenantApp.mockResolvedValue({ id: 'link-1', tenantId, applicationId: appIdUuid });

            const result = await AppResourceService.getInstance().validateTenantAccess(tenantId, appIdUuid);

            expect(mockFindApplicationById).toHaveBeenCalledWith(appIdUuid);
            expect(result.valid).toBe(true);
        });

        it('should validate access when looking up by Slug (AppId)', async () => {
            // Setup mocks: ID lookup fails, Slug lookup succeeds
            mockFindApplicationById.mockResolvedValue(null);
            mockFindApplicationByAppId.mockResolvedValue({
                id: appIdUuid,
                appId: appIdSlug,
                name: 'Test App'
            });
            mockFindTenantApp.mockResolvedValue({ id: 'link-1', tenantId, applicationId: appIdUuid });

            const result = await AppResourceService.getInstance().validateTenantAccess(tenantId, appIdSlug);

            expect(mockFindApplicationById).toHaveBeenCalledWith(appIdSlug); // Tried ID first
            expect(mockFindApplicationByAppId).toHaveBeenCalledWith(appIdSlug); // Then Slug
            expect(result.valid).toBe(true);
        });

        it('should return invalid if application not found by ID or Slug', async () => {
            mockFindApplicationById.mockResolvedValue(null);
            mockFindApplicationByAppId.mockResolvedValue(null);

            const result = await AppResourceService.getInstance().validateTenantAccess(tenantId, 'non-existent');

            expect(result.valid).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should return invalid if tenant does not have access to app', async () => {
            mockFindApplicationById.mockResolvedValue({
                id: appIdUuid,
                appId: appIdSlug,
                name: 'Test App'
            });
            mockFindTenantApp.mockResolvedValue(null);

            const result = await AppResourceService.getInstance().validateTenantAccess(tenantId, appIdUuid);

            expect(result.valid).toBe(false);
            expect(result.message).toContain('Tenant does not have access');
        });
    });
});
