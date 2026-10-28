import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { B2bPricingService } from '../b2b/b2b-pricing.service';

export type WishlistItemDto = {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity: number;
  priceSource: 'retail' | 'price_list';
  createdAt: string;
};

export type WishlistDto = {
  id: string;
  customerId: string;
  items: WishlistItemDto[];
};

@Injectable()
export class WishlistService {
  constructor(
    private readonly db: DatabaseService,
    private readonly pricing: B2bPricingService,
  ) {}

  async getOrCreate(
    tenantId: string,
    customerId: string,
  ): Promise<WishlistDto> {
    return this.db.withTenant(tenantId, async (client) => {
      let wishlist = await client.query<{ id: string; customer_id: string }>(
        `SELECT id, customer_id FROM wishlists WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      if (!wishlist.rows[0]) {
        wishlist = await client.query<{ id: string; customer_id: string }>(
          `INSERT INTO wishlists (tenant_id, customer_id)
           VALUES ($1, $2)
           RETURNING id, customer_id`,
          [tenantId, customerId],
        );
      }
      return this.mapWishlist(client, tenantId, wishlist.rows[0]!);
    });
  }

  async addItem(
    tenantId: string,
    customerId: string,
    variantId: string,
  ): Promise<WishlistDto> {
    if (!variantId?.trim()) {
      throw new BadRequestException('variantId is required');
    }
    return this.db.withTenant(tenantId, async (client) => {
      const variant = await client.query<{ id: string }>(
        `SELECT id FROM product_variants WHERE id = $1 LIMIT 1`,
        [variantId],
      );
      if (!variant.rows[0]) throw new NotFoundException('Variant not found');

      let wishlist = await client.query<{ id: string; customer_id: string }>(
        `SELECT id, customer_id FROM wishlists WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      if (!wishlist.rows[0]) {
        wishlist = await client.query<{ id: string; customer_id: string }>(
          `INSERT INTO wishlists (tenant_id, customer_id)
           VALUES ($1, $2)
           RETURNING id, customer_id`,
          [tenantId, customerId],
        );
      }
      const wishlistId = wishlist.rows[0]!.id;

      await client.query(
        `INSERT INTO wishlist_items (tenant_id, wishlist_id, variant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (wishlist_id, variant_id) DO NOTHING`,
        [tenantId, wishlistId, variantId],
      );

      return this.mapWishlist(client, tenantId, wishlist.rows[0]!);
    });
  }

  async removeItem(
    tenantId: string,
    customerId: string,
    variantId: string,
  ): Promise<WishlistDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const wishlist = await client.query<{ id: string; customer_id: string }>(
        `SELECT id, customer_id FROM wishlists WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      if (!wishlist.rows[0]) throw new NotFoundException('Wishlist not found');

      await client.query(
        `DELETE FROM wishlist_items
         WHERE wishlist_id = $1 AND variant_id = $2`,
        [wishlist.rows[0].id, variantId],
      );

      return this.mapWishlist(client, tenantId, wishlist.rows[0]);
    });
  }

  private async mapWishlist(
    client: import('pg').PoolClient,
    tenantId: string,
    wishlist: { id: string; customer_id: string },
  ): Promise<WishlistDto> {
    const items = await client.query<{
      id: string;
      variant_id: string;
      product_id: string;
      product_title: string;
      product_slug: string;
      variant_title: string;
      sku: string;
      unit_amount_minor: string;
      currency: string;
      inventory_quantity: number;
      created_at: Date;
    }>(
      `SELECT wi.id, wi.variant_id, p.id AS product_id, p.title AS product_title,
              p.slug AS product_slug, pv.title AS variant_title, pv.sku,
              pv.unit_amount_minor::text, pv.currency,
              COALESCE(pv.inventory_quantity, 0)::int AS inventory_quantity,
              wi.created_at
       FROM wishlist_items wi
       JOIN product_variants pv ON pv.id = wi.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE wi.wishlist_id = $1
       ORDER BY wi.created_at DESC`,
      [wishlist.id],
    );

    const variantIds = items.rows.map((r) => r.variant_id);
    const overrides = await this.pricing.listOverridesForCustomer(
      client,
      tenantId,
      wishlist.customer_id,
      variantIds,
    );

    return {
      id: wishlist.id,
      customerId: wishlist.customer_id,
      items: items.rows.map((row) => {
        const override = overrides.get(row.variant_id);
        return {
          id: row.id,
          variantId: row.variant_id,
          productId: row.product_id,
          productTitle: row.product_title,
          productSlug: row.product_slug,
          variantTitle: row.variant_title,
          sku: row.sku,
          unitAmountMinor:
            override?.unitAmountMinor ?? Number(row.unit_amount_minor),
          currency: override?.currency ?? row.currency,
          inventoryQuantity: Number(row.inventory_quantity),
          priceSource: override?.source ?? 'retail',
          createdAt: row.created_at.toISOString(),
        };
      }),
    };
  }
}
