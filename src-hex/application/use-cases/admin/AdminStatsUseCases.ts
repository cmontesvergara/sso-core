import { IStatsQueryService } from '../../ports/output/IStatsQueryService';

/**
 * AdminStatsUseCases — global platform statistics.
 * Uses IStatsQueryService to keep the application layer independent of the ORM.
 */
export class AdminStatsUseCases {
  constructor(private readonly statsQueryService: IStatsQueryService) { }

  async getGlobalStats() {
    return this.statsQueryService.getGlobalStats();
  }
}
