import { ITenantRepository } from '../../../domain/repositories/ITenantRepository';
import { TenantId } from '../../../domain/value-objects/TenantId';

export interface GetTenantPublicInfoDTO {
  tenantId: string;
}

export interface GetTenantPublicInfoResponse {
  name: string;
  slug: string;
}

export class GetTenantPublicInfoUseCase {
  constructor(private tenantRepository: ITenantRepository) {}

  async execute(dto: GetTenantPublicInfoDTO): Promise<GetTenantPublicInfoResponse | null> {
    const tenantId = TenantId.create(dto.tenantId);
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant || !tenant.isActive()) {
      return null;
    }

    return {
      name: tenant.name,
      slug: tenant.slug,
    };
  }
}
