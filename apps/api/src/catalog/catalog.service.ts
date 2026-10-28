import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

export type ProductDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    unitAmountMinor: number;
    currency: string;
  }>;
};

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async listProducts(tenantId: string): Promise<ProductDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const products = await client.query<{
        id: string;
        slug: string;
        title: string;
        description: string | null;
      }>(
        `SELECT id, slug, title, description
         FROM products WHERE status = 'active'
         ORDER BY created_at`,
      );
      const variants = await client.query<{
        id: string;
        product_id: string;
        sku: string;
        title: string;
        unit_amount_minor: string;
        currency: string;
      }>(
        `SELECT id, product_id, sku, title, unit_amount_minor::text, currency
         FROM product_variants
         ORDER BY created_at`,
      );
      return products.rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        variants: variants.rows
          .filter((v) => v.product_id === p.id)
          .map((v) => ({
            id: v.id,
            sku: v.sku,
            title: v.title,
            unitAmountMinor: Number(v.unit_amount_minor),
            currency: v.currency,
          })),
      }));
    });
  }
}
