import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type VariantDto = {
  id: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity: number;
};

export type ProductDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  variants: VariantDto[];
};

export type VariantInput = {
  id?: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency?: string;
  inventoryQuantity?: number;
};

export type ProductCreateInput = {
  title: string;
  slug: string;
  description?: string | null;
  status?: string;
  variants: VariantInput[];
};

export type ProductUpdateInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: string;
  variants?: VariantInput[];
};

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async listProducts(tenantId: string): Promise<ProductDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadProducts(client, { activeOnly: true });
    });
  }

  async listAdminProducts(tenantId: string): Promise<ProductDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadProducts(client, { activeOnly: false });
    });
  }

  async getAdminProduct(tenantId: string, productId: string): Promise<ProductDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const products = await this.loadProducts(client, {
        activeOnly: false,
        productId,
      });
      const product = products[0];
      if (!product) throw new NotFoundException('Product not found');
      return product;
    });
  }

  async createProduct(
    tenantId: string,
    input: ProductCreateInput,
  ): Promise<ProductDto> {
    const title = input.title?.trim();
    const slug = (input.slug?.trim() || slugify(title ?? '')).toLowerCase();
    if (!title) throw new BadRequestException('title is required');
    if (!slug) throw new BadRequestException('slug is required');
    if (!input.variants?.length) {
      throw new BadRequestException('at least one variant is required');
    }

    const status = this.normalizeStatus(input.status ?? 'active');
    const variants = input.variants.map((v) => this.normalizeVariantInput(v));

    return this.db.withTenant(tenantId, async (client) => {
      let productId: string;
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO products (tenant_id, slug, title, description, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [tenantId, slug, title, input.description?.trim() || null, status],
        );
        productId = inserted.rows[0]!.id;
      } catch (err) {
        this.rethrowUnique(err, 'slug or sku already exists');
        throw err;
      }

      for (const variant of variants) {
        try {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO product_variants
               (tenant_id, product_id, sku, title, unit_amount_minor, currency, inventory_quantity)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              tenantId,
              productId,
              variant.sku,
              variant.title,
              variant.unitAmountMinor,
              variant.currency,
              variant.inventoryQuantity,
            ],
          );
          await this.syncDefaultLocationStock(
            client,
            tenantId,
            inserted.rows[0]!.id,
            variant.inventoryQuantity,
          );
        } catch (err) {
          this.rethrowUnique(err, 'slug or sku already exists');
          throw err;
        }
      }

      const products = await this.loadProducts(client, {
        activeOnly: false,
        productId,
      });
      return products[0]!;
    });
  }

  async updateProduct(
    tenantId: string,
    productId: string,
    input: ProductUpdateInput,
  ): Promise<ProductDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM products WHERE id = $1`,
        [productId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Product not found');

      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;

      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw new BadRequestException('title cannot be empty');
        sets.push(`title = $${i++}`);
        params.push(title);
      }
      if (input.slug !== undefined) {
        const slug = input.slug.trim().toLowerCase();
        if (!slug) throw new BadRequestException('slug cannot be empty');
        sets.push(`slug = $${i++}`);
        params.push(slug);
      }
      if (input.description !== undefined) {
        sets.push(`description = $${i++}`);
        params.push(
          input.description === null ? null : input.description.trim() || null,
        );
      }
      if (input.status !== undefined) {
        sets.push(`status = $${i++}`);
        params.push(this.normalizeStatus(input.status));
      }

      if (sets.length) {
        params.push(productId);
        try {
          await client.query(
            `UPDATE products SET ${sets.join(', ')} WHERE id = $${i}`,
            params,
          );
        } catch (err) {
          this.rethrowUnique(err, 'slug already exists');
          throw err;
        }
      }

      if (input.variants) {
        if (!input.variants.length) {
          throw new BadRequestException('at least one variant is required');
        }
        const normalized = input.variants.map((v) =>
          this.normalizeVariantInput(v),
        );
        const keptIds: string[] = [];

        for (const variant of normalized) {
          if (variant.id) {
            const updated = await client.query<{ id: string }>(
              `UPDATE product_variants
               SET sku = $1,
                   title = $2,
                   unit_amount_minor = $3,
                   currency = $4,
                   inventory_quantity = $5
               WHERE id = $6 AND product_id = $7
               RETURNING id`,
              [
                variant.sku,
                variant.title,
                variant.unitAmountMinor,
                variant.currency,
                variant.inventoryQuantity,
                variant.id,
                productId,
              ],
            );
            if (!updated.rows[0]) {
              throw new NotFoundException(
                `Variant ${variant.id} not found on product`,
              );
            }
            keptIds.push(updated.rows[0].id);
            await this.syncDefaultLocationStock(
              client,
              tenantId,
              updated.rows[0].id,
              variant.inventoryQuantity,
            );
          } else {
            try {
              const inserted = await client.query<{ id: string }>(
                `INSERT INTO product_variants
                   (tenant_id, product_id, sku, title, unit_amount_minor, currency, inventory_quantity)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                  tenantId,
                  productId,
                  variant.sku,
                  variant.title,
                  variant.unitAmountMinor,
                  variant.currency,
                  variant.inventoryQuantity,
                ],
              );
              keptIds.push(inserted.rows[0]!.id);
              await this.syncDefaultLocationStock(
                client,
                tenantId,
                inserted.rows[0]!.id,
                variant.inventoryQuantity,
              );
            } catch (err) {
              this.rethrowUnique(err, 'sku already exists');
              throw err;
            }
          }
        }

        if (keptIds.length) {
          await client.query(
            `DELETE FROM product_variants
             WHERE product_id = $1
               AND NOT (id = ANY($2::uuid[]))`,
            [productId, keptIds],
          );
        }
      }

      const products = await this.loadProducts(client, {
        activeOnly: false,
        productId,
      });
      return products[0]!;
    });
  }

  private async loadProducts(
    client: PoolClient,
    opts: { activeOnly: boolean; productId?: string },
  ): Promise<ProductDto[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (opts.activeOnly) clauses.push(`status = 'active'`);
    if (opts.productId) {
      params.push(opts.productId);
      clauses.push(`id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const products = await client.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
    }>(
      `SELECT id, slug, title, description, status
       FROM products
       ${where}
       ORDER BY created_at`,
      params,
    );

    if (!products.rows.length) return [];

    const productIds = products.rows.map((p) => p.id);
    const variants = await client.query<{
      id: string;
      product_id: string;
      sku: string;
      title: string;
      unit_amount_minor: string;
      currency: string;
      inventory_quantity: number;
    }>(
      `SELECT id, product_id, sku, title, unit_amount_minor::text, currency,
              COALESCE(inventory_quantity, 0)::int AS inventory_quantity
       FROM product_variants
       WHERE product_id = ANY($1::uuid[])
       ORDER BY created_at`,
      [productIds],
    );

    return products.rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      status: p.status,
      variants: variants.rows
        .filter((v) => v.product_id === p.id)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          unitAmountMinor: Number(v.unit_amount_minor),
          currency: v.currency,
          inventoryQuantity: Number(v.inventory_quantity),
        })),
    }));
  }

  private normalizeStatus(status: string): string {
    const allowed = new Set(['active', 'draft', 'archived']);
    const value = status.trim().toLowerCase();
    if (!allowed.has(value)) {
      throw new BadRequestException(
        'status must be active, draft, or archived',
      );
    }
    return value;
  }

  private normalizeVariantInput(input: VariantInput): {
    id?: string;
    sku: string;
    title: string;
    unitAmountMinor: number;
    currency: string;
    inventoryQuantity: number;
  } {
    const sku = input.sku?.trim();
    const title = input.title?.trim();
    if (!sku) throw new BadRequestException('variant sku is required');
    if (!title) throw new BadRequestException('variant title is required');
    const unitAmountMinor = Number(input.unitAmountMinor);
    if (!Number.isFinite(unitAmountMinor) || unitAmountMinor < 0) {
      throw new BadRequestException('unitAmountMinor must be >= 0');
    }
    const currency = (input.currency?.trim() || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    const inventoryQuantity = Number(input.inventoryQuantity ?? 0);
    if (
      !Number.isFinite(inventoryQuantity) ||
      inventoryQuantity < 0 ||
      !Number.isInteger(inventoryQuantity)
    ) {
      throw new BadRequestException(
        'inventoryQuantity must be an integer >= 0',
      );
    }
    return {
      id: input.id,
      sku,
      title,
      unitAmountMinor: Math.trunc(unitAmountMinor),
      currency,
      inventoryQuantity,
    };
  }

  /**
   * Keep default-location inventory_levels aligned with the aggregate qty
   * set on the product form. Non-default location stock is preserved; the
   * default absorbs the remainder so total ≈ form quantity.
   */
  private async syncDefaultLocationStock(
    client: PoolClient,
    tenantId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const location = await client.query<{ id: string }>(
      `SELECT id FROM locations WHERE is_default = true LIMIT 1`,
    );
    const locationId = location.rows[0]?.id;
    if (!locationId) return;

    const others = await client.query<{ qty: number }>(
      `SELECT COALESCE(SUM(il.quantity), 0)::int AS qty
       FROM inventory_levels il
       WHERE il.variant_id = $1 AND il.location_id <> $2`,
      [variantId, locationId],
    );
    const defaultQty = Math.max(0, quantity - Number(others.rows[0]?.qty ?? 0));

    await client.query(
      `INSERT INTO inventory_levels
         (tenant_id, location_id, variant_id, quantity, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (location_id, variant_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
      [tenantId, locationId, variantId, defaultQty],
    );

    await client.query(
      `UPDATE product_variants v
       SET inventory_quantity = COALESCE((
         SELECT SUM(il.quantity)::int
         FROM inventory_levels il
         WHERE il.variant_id = v.id
       ), $2)
       WHERE v.id = $1`,
      [variantId, quantity],
    );
  }

  private rethrowUnique(err: unknown, message: string): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(message);
    }
  }
}
