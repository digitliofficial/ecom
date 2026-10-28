import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export type ResolvedPrice = {
  unitAmountMinor: number;
  currency: string;
  source: 'retail' | 'price_list';
  priceListId?: string;
};

@Injectable()
export class B2bPricingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Resolve list price for a customer (price list override when entitled + grouped). */
  async resolveVariantPrice(
    tenantId: string,
    variantId: string,
    customerId?: string | null,
  ): Promise<ResolvedPrice> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.resolveVariantPriceWithClient(
        client,
        tenantId,
        variantId,
        customerId,
      );
    });
  }

  async resolveVariantPriceWithClient(
    client: PoolClient,
    tenantId: string,
    variantId: string,
    customerId?: string | null,
  ): Promise<ResolvedPrice> {
    const retail = await client.query<{
      unit_amount_minor: string;
      currency: string;
    }>(
      `SELECT unit_amount_minor::text, currency
       FROM product_variants WHERE id = $1 LIMIT 1`,
      [variantId],
    );
    const base = retail.rows[0];
    if (!base) {
      return { unitAmountMinor: 0, currency: 'USD', source: 'retail' };
    }
    const retailPrice: ResolvedPrice = {
      unitAmountMinor: Number(base.unit_amount_minor),
      currency: base.currency,
      source: 'retail',
    };

    if (!customerId) return retailPrice;

    const entitled = await this.entitlements.hasWithClient(
      client,
      tenantId,
      'feature_b2b',
    );
    if (!entitled) return retailPrice;

    const override = await client.query<{
      unit_amount_minor: string;
      currency: string;
      price_list_id: string;
    }>(
      `SELECT pli.unit_amount_minor::text, pli.currency, pl.id AS price_list_id
       FROM customer_group_members cgm
       JOIN customer_groups cg ON cg.id = cgm.group_id
       JOIN price_lists pl ON pl.id = cg.price_list_id
       JOIN price_list_items pli
         ON pli.price_list_id = pl.id AND pli.variant_id = $2
       WHERE cgm.customer_id = $1
       ORDER BY cgm.created_at
       LIMIT 1`,
      [customerId, variantId],
    );

    const row = override.rows[0];
    if (!row) return retailPrice;

    return {
      unitAmountMinor: Number(row.unit_amount_minor),
      currency: row.currency,
      source: 'price_list',
      priceListId: row.price_list_id,
    };
  }

  /** Map of variant_id → list price for a customer (only overrides). */
  async listOverridesForCustomer(
    client: PoolClient,
    tenantId: string,
    customerId: string,
    variantIds: string[],
  ): Promise<Map<string, ResolvedPrice>> {
    const map = new Map<string, ResolvedPrice>();
    if (!variantIds.length) return map;

    const entitled = await this.entitlements.hasWithClient(
      client,
      tenantId,
      'feature_b2b',
    );
    if (!entitled) return map;

    const result = await client.query<{
      variant_id: string;
      unit_amount_minor: string;
      currency: string;
      price_list_id: string;
    }>(
      `SELECT DISTINCT ON (pli.variant_id)
         pli.variant_id,
         pli.unit_amount_minor::text,
         pli.currency,
         pl.id AS price_list_id
       FROM customer_group_members cgm
       JOIN customer_groups cg ON cg.id = cgm.group_id
       JOIN price_lists pl ON pl.id = cg.price_list_id
       JOIN price_list_items pli ON pli.price_list_id = pl.id
       WHERE cgm.customer_id = $1
         AND pli.variant_id = ANY($2::uuid[])
       ORDER BY pli.variant_id, cgm.created_at`,
      [customerId, variantIds],
    );

    for (const row of result.rows) {
      map.set(row.variant_id, {
        unitAmountMinor: Number(row.unit_amount_minor),
        currency: row.currency,
        source: 'price_list',
        priceListId: row.price_list_id,
      });
    }
    return map;
  }
}
