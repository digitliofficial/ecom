import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import type { ProductDto } from '../catalog/catalog.service';

export type CollectionDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  productIds: string[];
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionWithProductsDto = CollectionDto & {
  products: ProductDto[];
};

export type CollectionCreateInput = {
  title: string;
  slug?: string;
  description?: string | null;
  status?: string;
  productIds?: string[];
};

export type CollectionUpdateInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: string;
  productIds?: string[];
};

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class CollectionsService {
  constructor(private readonly db: DatabaseService) {}

  async listStorefront(tenantId: string): Promise<CollectionDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadCollections(client, { activeOnly: true });
    });
  }

  async getStorefrontBySlug(
    tenantId: string,
    slug: string,
  ): Promise<CollectionWithProductsDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const collections = await this.loadCollections(client, {
        activeOnly: true,
        slug: slug.trim().toLowerCase(),
      });
      const collection = collections[0];
      if (!collection) throw new NotFoundException('Collection not found');
      const products = await this.loadActiveProducts(
        client,
        collection.productIds,
      );
      return { ...collection, products };
    });
  }

  async listProductsByCollectionSlug(
    tenantId: string,
    slug: string,
  ): Promise<ProductDto[]> {
    const collection = await this.getStorefrontBySlug(tenantId, slug);
    return collection.products;
  }

  async listAdmin(tenantId: string): Promise<CollectionDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadCollections(client, { activeOnly: false });
    });
  }

  async getAdmin(tenantId: string, id: string): Promise<CollectionDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const collections = await this.loadCollections(client, {
        activeOnly: false,
        id,
      });
      const collection = collections[0];
      if (!collection) throw new NotFoundException('Collection not found');
      return collection;
    });
  }

  async create(
    tenantId: string,
    input: CollectionCreateInput,
  ): Promise<CollectionDto> {
    const title = input.title?.trim();
    const slug = (input.slug?.trim() || slugify(title ?? '')).toLowerCase();
    if (!title) throw new BadRequestException('title is required');
    if (!slug) throw new BadRequestException('slug is required');
    const status = this.normalizeStatus(input.status ?? 'active');
    const productIds = this.normalizeProductIds(input.productIds ?? []);

    return this.db.withTenant(tenantId, async (client) => {
      await this.assertProductsExist(client, productIds);
      let collectionId: string;
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO collections
             (tenant_id, slug, title, description, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            tenantId,
            slug,
            title,
            input.description?.trim() || null,
            status,
          ],
        );
        collectionId = inserted.rows[0]!.id;
      } catch (err) {
        this.rethrowUnique(err, 'slug already exists');
        throw err;
      }
      await this.replaceProducts(client, tenantId, collectionId, productIds);
      const collections = await this.loadCollections(client, {
        activeOnly: false,
        id: collectionId,
      });
      return collections[0]!;
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: CollectionUpdateInput,
  ): Promise<CollectionDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM collections WHERE id = $1`,
        [id],
      );
      if (!existing.rows[0]) throw new NotFoundException('Collection not found');

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
        sets.push(`updated_at = now()`);
        params.push(id);
        try {
          await client.query(
            `UPDATE collections SET ${sets.join(', ')} WHERE id = $${i}`,
            params,
          );
        } catch (err) {
          this.rethrowUnique(err, 'slug already exists');
          throw err;
        }
      }

      if (input.productIds !== undefined) {
        const productIds = this.normalizeProductIds(input.productIds);
        await this.assertProductsExist(client, productIds);
        await this.replaceProducts(client, tenantId, id, productIds);
      }

      const collections = await this.loadCollections(client, {
        activeOnly: false,
        id,
      });
      return collections[0]!;
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.db.withTenant(tenantId, async (client) => {
      const deleted = await client.query<{ id: string }>(
        `DELETE FROM collections WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!deleted.rows[0]) throw new NotFoundException('Collection not found');
    });
  }

  private async loadCollections(
    client: PoolClient,
    opts: { activeOnly: boolean; id?: string; slug?: string },
  ): Promise<CollectionDto[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (opts.activeOnly) clauses.push(`status = 'active'`);
    if (opts.id) {
      params.push(opts.id);
      clauses.push(`id = $${params.length}`);
    }
    if (opts.slug) {
      params.push(opts.slug);
      clauses.push(`slug = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await client.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, slug, title, description, status, created_at, updated_at
       FROM collections
       ${where}
       ORDER BY created_at`,
      params,
    );

    if (!rows.rows.length) return [];

    const ids = rows.rows.map((r) => r.id);
    const members = await client.query<{
      collection_id: string;
      product_id: string;
      position: number;
    }>(
      `SELECT collection_id, product_id, position
       FROM collection_products
       WHERE collection_id = ANY($1::uuid[])
       ORDER BY position ASC, created_at ASC`,
      [ids],
    );

    return rows.rows.map((row) => {
      const productIds = members.rows
        .filter((m) => m.collection_id === row.id)
        .map((m) => m.product_id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        status: row.status,
        productIds,
        productCount: productIds.length,
        createdAt: asIso(row.created_at),
        updatedAt: asIso(row.updated_at),
      };
    });
  }

  private async loadActiveProducts(
    client: PoolClient,
    productIds: string[],
  ): Promise<ProductDto[]> {
    if (!productIds.length) return [];

    const products = await client.query<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
    }>(
      `SELECT id, slug, title, description, status
       FROM products
       WHERE id = ANY($1::uuid[]) AND status = 'active'`,
      [productIds],
    );

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

    const byId = new Map(
      products.rows.map((p) => [
        p.id,
        {
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
        } satisfies ProductDto,
      ]),
    );

    // Preserve collection order
    return productIds
      .map((id) => byId.get(id))
      .filter((p): p is ProductDto => Boolean(p));
  }

  private async assertProductsExist(
    client: PoolClient,
    productIds: string[],
  ): Promise<void> {
    if (!productIds.length) return;
    const found = await client.query<{ id: string }>(
      `SELECT id FROM products WHERE id = ANY($1::uuid[])`,
      [productIds],
    );
    if (found.rows.length !== productIds.length) {
      throw new BadRequestException('one or more productIds are invalid');
    }
  }

  private async replaceProducts(
    client: PoolClient,
    tenantId: string,
    collectionId: string,
    productIds: string[],
  ): Promise<void> {
    await client.query(
      `DELETE FROM collection_products WHERE collection_id = $1`,
      [collectionId],
    );
    for (let index = 0; index < productIds.length; index++) {
      await client.query(
        `INSERT INTO collection_products
           (tenant_id, collection_id, product_id, position)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, collectionId, productIds[index], index],
      );
    }
  }

  private normalizeProductIds(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ids) {
      const id = String(raw ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
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
