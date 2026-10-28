import { Injectable } from '@nestjs/common';
import type { Tenant } from '@ecom/domain-types';

/** Phase 0: in-memory demo tenant resolution (Postgres RLS wired later) */
@Injectable()
export class TenancyService {
  private readonly demo: Tenant = {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'demo',
    status: 'active',
    planId: null,
    dataRegion: 'us',
  };

  private readonly hosts = new Map<string, string>([
    ['demo.localhost', this.demo.id],
    ['localhost', this.demo.id],
  ]);

  resolveTenantIdFromHost(host?: string): string | null {
    if (!host) return null;
    const normalized = host.split(':')[0]?.toLowerCase() ?? '';
    return this.hosts.get(normalized) ?? null;
  }

  getDemoTenant(): Tenant {
    return this.demo;
  }

  /** Placeholder for SET LOCAL app.tenant_id on each request */
  async setRlsTenantId(tenantId: string): Promise<void> {
    // Prisma/TypeORM: SET LOCAL app.tenant_id = $tenantId
    void tenantId;
  }
}
