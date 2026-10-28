import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class EntitlementsService {
  constructor(private readonly db: DatabaseService) {}

  async hasWithClient(
    client: PoolClient,
    tenantId: string,
    key: string,
  ): Promise<boolean> {
    const result = await client.query<{ value: string }>(
      `SELECT pe.value
       FROM tenants t
       JOIN plan_entitlements pe ON pe.plan_id = t.plan_id
       WHERE t.id = $1 AND pe.key = $2
       LIMIT 1`,
      [tenantId, key],
    );
    const row = result.rows[0];
    if (!row) return false;
    const v = row.value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  async has(tenantId: string, key: string): Promise<boolean> {
    return this.db.withTenant(tenantId, (client) =>
      this.hasWithClient(client, tenantId, key),
    );
  }

  async require(tenantId: string, key: string, message?: string): Promise<void> {
    const ok = await this.has(tenantId, key);
    if (!ok) {
      throw new ForbiddenException(
        message ?? `Plan entitlement required: ${key}`,
      );
    }
  }
}
