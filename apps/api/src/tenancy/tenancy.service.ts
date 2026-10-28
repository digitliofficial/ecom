import { Injectable } from '@nestjs/common';
import type { Tenant } from '@ecom/domain-types';
import { DatabaseService } from '../db/database.service';

const DEMO_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class TenancyService {
  constructor(private readonly db: DatabaseService) {}

  async resolveTenantIdFromHost(host?: string): Promise<string | null> {
    if (!host) return null;
    return this.db.resolveTenantIdByHost(host);
  }

  getDemoTenant(): Tenant {
    return {
      id: DEMO_ID,
      slug: 'demo',
      status: 'active',
      planId: '10000000-0000-4000-8000-000000000001',
      dataRegion: 'us',
    };
  }

  /** Prefer DatabaseService.withTenant — kept for guard compatibility. */
  async setRlsTenantId(tenantId: string): Promise<void> {
    void tenantId;
  }
}
