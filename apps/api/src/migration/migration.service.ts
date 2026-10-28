import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { parseCsv, pick } from './csv-parse';
import { ShopifyAdminClient } from './shopify-admin.client';
import type {
  CreateMigrationJobInput,
  EntityStats,
  MigrationEntityType,
  MigrationJobDto,
  MigrationJobStatus,
  MigrationRecordEntity,
  MigrationSource,
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyRedirect,
} from './types';

const ENTITY_TYPES: MigrationEntityType[] = [
  'products',
  'customers',
  'orders',
  'redirects',
];

const EMPTY_STATS: EntityStats = { imported: 0, skipped: 0, failed: 0 };

@Injectable()
export class MigrationService {
  private readonly unusablePasswordHash: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    private readonly shopify: ShopifyAdminClient,
  ) {
    this.unusablePasswordHash = bcrypt.hash(
      `!shopify-import-no-password!${randomBytes(16).toString('hex')}`,
      10,
    );
  }

  async createJob(input: CreateMigrationJobInput): Promise<MigrationJobDto> {
    const tenantId = input.tenantId?.trim();
    if (!tenantId) throw new BadRequestException('tenantId is required');

    const source = input.source;
    if (!['shopify_api', 'csv', 'fixture'].includes(source)) {
      throw new BadRequestException(
        'source must be shopify_api, csv, or fixture',
      );
    }

    const entityTypes = this.normalizeEntityTypes(input.entityTypes);
    if (!entityTypes.length) {
      throw new BadRequestException('entityTypes must be non-empty');
    }

    if (source === 'shopify_api') {
      if (!input.shopDomain?.trim()) {
        throw new BadRequestException('shopDomain is required for shopify_api');
      }
      if (!input.accessToken?.trim()) {
        throw new BadRequestException(
          'accessToken is required for shopify_api',
        );
      }
    }

    const resolvedTenantId = await this.resolveTenantId(tenantId);

    const config: Record<string, unknown> = {};
    if (input.accessToken?.trim()) {
      config.accessToken = input.accessToken.trim();
    }
    if (input.csv) config.csv = input.csv;
    if (input.fixture) config.fixture = input.fixture;

    const row = await this.db.withTenant(resolvedTenantId, async (client) => {
      const inserted = await client.query<{
        id: string;
        tenant_id: string;
        source: MigrationSource;
        entity_types: string[];
        status: MigrationJobStatus;
        shop_domain: string | null;
        stats: Record<string, unknown>;
        error: string | null;
        created_at: Date;
        started_at: Date | null;
        finished_at: Date | null;
      }>(
        `INSERT INTO migration_jobs
           (tenant_id, source, entity_types, status, shop_domain, config)
         VALUES ($1, $2, $3::text[], 'pending', $4, $5::jsonb)
         RETURNING id::text, tenant_id::text, source, entity_types, status,
                   shop_domain, stats, error, created_at, started_at, finished_at`,
        [
          resolvedTenantId,
          source,
          entityTypes,
          input.shopDomain?.trim() || null,
          JSON.stringify(config),
        ],
      );
      return inserted.rows[0]!;
    });

    return this.toJobDto(row);
  }

  async listJobs(tenantId?: string): Promise<MigrationJobDto[]> {
    if (tenantId?.trim()) {
      const resolved = await this.resolveTenantId(tenantId.trim());
      return this.db.withTenant(resolved, async (client) => {
        const res = await client.query(this.jobSelectSql('ORDER BY created_at DESC LIMIT 50'));
        return res.rows.map((r) => this.toJobDto(r));
      });
    }

    // Platform list across tenants — bypass RLS with admin-style query via pool
    // (ecom_app still subject to RLS; use SECURITY DEFINER-less raw with unset GUC
    // by reading through owner connection is not available — query with each known
    // pattern: unset tenant GUC means RLS denies all. So resolve via tenants table
    // which also has RLS... tenants RLS requires matching id.
    // Workaround: use DATABASE connection as ecom_app without GUC — policies deny.
    // For platform list, query each active tenant after fetching ids with a
    // temporary bypass: set_config to empty won't help.
    // Solution used: query via pool with a privileged path — we store a helper
    // that uses set_config to each tenant in sequence after listing tenant ids
    // from a SECURITY DEFINER function OR from seed-known approach.
    // Simplest MVP: require tenantId for list, OR use admin URL for cross-tenant.
    // We'll use a dedicated query that sets a session role bypass via
    // `SET LOCAL row_security = off` — only works for table owner/superuser.
    // ecom_app is NOT superuser. So platform list without tenantId returns via
    // iterating tenants from resolve: use a SECURITY DEFINER list function.

    const tenants = await this.listTenantIds();
    const jobs: MigrationJobDto[] = [];
    for (const id of tenants) {
      const batch = await this.db.withTenant(id, async (client) => {
        const res = await client.query(
          this.jobSelectSql('ORDER BY created_at DESC LIMIT 20'),
        );
        return res.rows.map((r) => this.toJobDto(r));
      });
      jobs.push(...batch);
    }
    return jobs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  async getJob(jobId: string): Promise<MigrationJobDto> {
    const meta = await this.findJobTenant(jobId);
    return this.db.withTenant(meta.tenantId, async (client) => {
      const res = await client.query(this.jobSelectSql('WHERE id = $1'), [
        jobId,
      ]);
      const row = res.rows[0];
      if (!row) throw new NotFoundException('Migration job not found');
      return this.toJobDto(row);
    });
  }

  async runJob(jobId: string): Promise<MigrationJobDto> {
    const meta = await this.findJobTenant(jobId);

    return this.db.withTenant(meta.tenantId, async (client) => {
      const locked = await client.query<{
        id: string;
        tenant_id: string;
        source: MigrationSource;
        entity_types: string[];
        status: MigrationJobStatus;
        shop_domain: string | null;
        config: Record<string, unknown>;
        stats: Record<string, unknown>;
        error: string | null;
        created_at: Date;
        started_at: Date | null;
        finished_at: Date | null;
      }>(
        `SELECT id::text, tenant_id::text, source, entity_types, status,
                shop_domain, config, stats, error, created_at, started_at, finished_at
         FROM migration_jobs WHERE id = $1 FOR UPDATE`,
        [jobId],
      );
      const job = locked.rows[0];
      if (!job) throw new NotFoundException('Migration job not found');
      if (job.status === 'running') {
        throw new BadRequestException('Job already running');
      }

      await client.query(
        `UPDATE migration_jobs
         SET status = 'running', started_at = now(), finished_at = NULL, error = NULL
         WHERE id = $1`,
        [jobId],
      );

      const stats: Record<string, EntityStats> = {};
      try {
        const entityTypes = job.entity_types as MigrationEntityType[];
        const payload = await this.loadPayload(job, entityTypes);

        for (const entity of entityTypes) {
          if (entity === 'products') {
            stats.products = await this.importProducts(
              client,
              meta.tenantId,
              jobId,
              payload.products,
            );
          } else if (entity === 'customers') {
            stats.customers = await this.importCustomers(
              client,
              meta.tenantId,
              jobId,
              payload.customers,
            );
          } else if (entity === 'orders') {
            stats.orders = await this.importOrders(
              client,
              meta.tenantId,
              jobId,
              payload.orders,
            );
          } else if (entity === 'redirects') {
            stats.redirects = await this.importRedirects(
              client,
              meta.tenantId,
              jobId,
              payload.redirects,
            );
          }
        }

        const updated = await client.query(
          `UPDATE migration_jobs
           SET status = 'completed',
               stats = $2::jsonb,
               finished_at = now(),
               config = config - 'accessToken'
           WHERE id = $1
           RETURNING id::text, tenant_id::text, source, entity_types, status,
                     shop_domain, stats, error, created_at, started_at, finished_at`,
          [jobId, JSON.stringify(stats)],
        );
        return this.toJobDto(updated.rows[0]!);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const updated = await client.query(
          `UPDATE migration_jobs
           SET status = 'failed',
               error = $2,
               stats = $3::jsonb,
               finished_at = now(),
               config = config - 'accessToken'
           WHERE id = $1
           RETURNING id::text, tenant_id::text, source, entity_types, status,
                     shop_domain, stats, error, created_at, started_at, finished_at`,
          [jobId, message.slice(0, 2000), JSON.stringify(stats)],
        );
        return this.toJobDto(updated.rows[0]!);
      }
    });
  }

  private async loadPayload(
    job: {
      source: MigrationSource;
      shop_domain: string | null;
      config: Record<string, unknown>;
    },
    entityTypes: MigrationEntityType[],
  ): Promise<{
    products: ShopifyProduct[];
    customers: ShopifyCustomer[];
    orders: ShopifyOrder[];
    redirects: ShopifyRedirect[];
  }> {
    const want = new Set(entityTypes);

    if (job.source === 'fixture') {
      const fixture = (job.config.fixture ?? {}) as {
        products?: ShopifyProduct[];
        customers?: ShopifyCustomer[];
        orders?: ShopifyOrder[];
        redirects?: ShopifyRedirect[];
      };
      return {
        products: want.has('products') ? (fixture.products ?? []) : [],
        customers: want.has('customers') ? (fixture.customers ?? []) : [],
        orders: want.has('orders') ? (fixture.orders ?? []) : [],
        redirects: want.has('redirects') ? (fixture.redirects ?? []) : [],
      };
    }

    if (job.source === 'csv') {
      const csv = (job.config.csv ?? {}) as Partial<
        Record<'products' | 'customers', string>
      >;
      return {
        products: want.has('products')
          ? this.productsFromCsv(csv.products ?? '')
          : [],
        customers: want.has('customers')
          ? this.customersFromCsv(csv.customers ?? '')
          : [],
        orders: [],
        redirects: [],
      };
    }

    // shopify_api — fetch only requested entity types
    const token = String(job.config.accessToken ?? '');
    const shop = job.shop_domain ?? '';
    if (!token || !shop) {
      throw new BadRequestException(
        'shopify_api job missing shopDomain/accessToken',
      );
    }
    const creds = { shopDomain: shop, accessToken: token };
    const [products, customers, orders, redirects] = await Promise.all([
      want.has('products')
        ? this.shopify.listProducts(creds)
        : Promise.resolve([]),
      want.has('customers')
        ? this.shopify.listCustomers(creds)
        : Promise.resolve([]),
      want.has('orders') ? this.shopify.listOrders(creds) : Promise.resolve([]),
      want.has('redirects')
        ? this.shopify.listRedirects(creds)
        : Promise.resolve([]),
    ]);
    return { products, customers, orders, redirects };
  }

  private productsFromCsv(text: string): ShopifyProduct[] {
    if (!text.trim()) return [];
    const rows = parseCsv(text);
    const byHandle = new Map<string, ShopifyProduct>();

    for (const row of rows) {
      const handle =
        pick(row, 'Handle', 'handle') ||
        slugify(pick(row, 'Title', 'title')) ||
        `product-${byHandle.size + 1}`;
      const title = pick(row, 'Title', 'title') || handle;
      const variantSku =
        pick(row, 'Variant SKU', 'SKU', 'sku') || `${handle}-default`;
      const price = pick(row, 'Variant Price', 'Price', 'price') || '0';
      const inventory = Number(
        pick(row, 'Variant Inventory Qty', 'Inventory', 'inventory') || '0',
      );
      const statusRaw = pick(row, 'Status', 'status') || 'active';
      const externalId =
        pick(row, 'ID', 'Id', 'id') || `csv:${handle}:${variantSku}`;

      let product = byHandle.get(handle);
      if (!product) {
        product = {
          id: pick(row, 'ID', 'Id', 'id') || `csv:${handle}`,
          title,
          handle,
          body_html: pick(row, 'Body (HTML)', 'Body', 'description') || null,
          status: statusRaw.toLowerCase() === 'draft' ? 'draft' : 'active',
          variants: [],
        };
        byHandle.set(handle, product);
      }
      product.variants = product.variants ?? [];
      product.variants.push({
        id: externalId,
        sku: variantSku,
        title: pick(row, 'Option1 Value', 'Variant Title') || 'Default',
        price,
        inventory_quantity: Number.isFinite(inventory) ? inventory : 0,
      });
    }

    return [...byHandle.values()];
  }

  private customersFromCsv(text: string): ShopifyCustomer[] {
    if (!text.trim()) return [];
    return parseCsv(text).map((row, i) => ({
      id: pick(row, 'ID', 'Id', 'id') || `csv-customer-${i + 1}`,
      email: pick(row, 'Email', 'email'),
      first_name: pick(row, 'First Name', 'first_name'),
      last_name: pick(row, 'Last Name', 'last_name'),
      tags: pick(row, 'Tags', 'tags'),
      note: pick(row, 'Note', 'Notes', 'note'),
    }));
  }

  private async importProducts(
    client: PoolClient,
    tenantId: string,
    jobId: string,
    products: ShopifyProduct[],
  ): Promise<EntityStats> {
    const stats = { ...EMPTY_STATS };
    for (const product of products) {
      const externalId = String(product.id);
      try {
        const checksum = checksumOf(product);
        const existing = await this.findRecord(
          client,
          'product',
          externalId,
        );
        if (existing?.checksum === checksum && existing.internal_id) {
          stats.skipped++;
          continue;
        }

        const slug =
          (product.handle?.trim() || slugify(product.title) || externalId)
            .toLowerCase()
            .slice(0, 80);
        const status = normalizeProductStatus(product.status);
        const title = product.title?.trim() || slug;
        const description = stripHtml(product.body_html);

        let productId = existing?.internal_id ?? null;
        if (productId) {
          await client.query(
            `UPDATE products
             SET slug = $1, title = $2, description = $3, status = $4,
                 external_ids = COALESCE(external_ids, '{}'::jsonb) || $5::jsonb
             WHERE id = $6`,
            [
              slug,
              title,
              description,
              status,
              JSON.stringify({ shopify: externalId }),
              productId,
            ],
          );
        } else {
          const bySlug = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM products WHERE slug = $1`,
            [slug],
          );
          if (bySlug.rows[0]) {
            productId = bySlug.rows[0].id;
            await client.query(
              `UPDATE products
               SET title = $1, description = $2, status = $3,
                   external_ids = COALESCE(external_ids, '{}'::jsonb) || $4::jsonb
               WHERE id = $5`,
              [
                title,
                description,
                status,
                JSON.stringify({ shopify: externalId }),
                productId,
              ],
            );
          } else {
            const inserted = await client.query<{ id: string }>(
              `INSERT INTO products
                 (tenant_id, slug, title, description, status, external_ids)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb)
               RETURNING id::text AS id`,
              [
                tenantId,
                slug,
                title,
                description,
                status,
                JSON.stringify({ shopify: externalId }),
              ],
            );
            productId = inserted.rows[0]!.id;
          }
        }

        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'product',
          externalId,
          internalId: productId,
          checksum,
          status: 'imported',
        });

        const variants = product.variants?.length
          ? product.variants
          : [
              {
                id: `${externalId}:default`,
                sku: `${slug}-default`,
                title: 'Default',
                price: '0',
                inventory_quantity: 0,
              },
            ];

        for (const variant of variants) {
          const vExternal = String(variant.id);
          const vChecksum = checksumOf(variant);
          const sku =
            (variant.sku?.trim() || `${slug}-${vExternal}`).slice(0, 120);
          const vTitle = variant.title?.trim() || 'Default';
          const unitAmountMinor = moneyToMinor(variant.price);
          const inventory = Math.max(
            0,
            Math.trunc(Number(variant.inventory_quantity ?? 0) || 0),
          );

          const vExisting = await this.findRecord(client, 'variant', vExternal);
          let variantId = vExisting?.internal_id ?? null;

          if (variantId) {
            await client.query(
              `UPDATE product_variants
               SET sku = $1, title = $2, unit_amount_minor = $3,
                   inventory_quantity = $4,
                   external_ids = COALESCE(external_ids, '{}'::jsonb) || $5::jsonb
               WHERE id = $6`,
              [
                sku,
                vTitle,
                unitAmountMinor,
                inventory,
                JSON.stringify({ shopify: vExternal }),
                variantId,
              ],
            );
          } else {
            const bySku = await client.query<{ id: string }>(
              `SELECT id::text AS id FROM product_variants WHERE sku = $1`,
              [sku],
            );
            if (bySku.rows[0]) {
              variantId = bySku.rows[0].id;
              await client.query(
                `UPDATE product_variants
                 SET title = $1, unit_amount_minor = $2, inventory_quantity = $3,
                     product_id = $4,
                     external_ids = COALESCE(external_ids, '{}'::jsonb) || $5::jsonb
                 WHERE id = $6`,
                [
                  vTitle,
                  unitAmountMinor,
                  inventory,
                  productId,
                  JSON.stringify({ shopify: vExternal }),
                  variantId,
                ],
              );
            } else {
              const inserted = await client.query<{ id: string }>(
                `INSERT INTO product_variants
                   (tenant_id, product_id, sku, title, unit_amount_minor, currency,
                    inventory_quantity, external_ids)
                 VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7::jsonb)
                 RETURNING id::text AS id`,
                [
                  tenantId,
                  productId,
                  sku,
                  vTitle,
                  unitAmountMinor,
                  inventory,
                  JSON.stringify({ shopify: vExternal }),
                ],
              );
              variantId = inserted.rows[0]!.id;
            }
          }

          await this.upsertRecord(client, {
            tenantId,
            jobId,
            entityType: 'variant',
            externalId: vExternal,
            internalId: variantId,
            checksum: vChecksum,
            status: 'imported',
          });
        }

        stats.imported++;
      } catch (err) {
        stats.failed++;
        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'product',
          externalId,
          internalId: null,
          checksum: null,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return stats;
  }

  private async importCustomers(
    client: PoolClient,
    tenantId: string,
    jobId: string,
    customers: ShopifyCustomer[],
  ): Promise<EntityStats> {
    const stats = { ...EMPTY_STATS };
    const passwordHash = await this.unusablePasswordHash;

    for (const customer of customers) {
      const externalId = String(customer.id);
      const email = customer.email?.trim().toLowerCase();
      if (!email) {
        stats.skipped++;
        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'customer',
          externalId,
          internalId: null,
          checksum: null,
          status: 'skipped',
          error: 'missing email',
        });
        continue;
      }

      try {
        const checksum = checksumOf(customer);
        const existing = await this.findRecord(client, 'customer', externalId);
        if (existing?.checksum === checksum && existing.internal_id) {
          stats.skipped++;
          continue;
        }

        const displayName =
          [customer.first_name, customer.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || null;
        const tags = (customer.tags ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const notes = customer.note?.trim() || null;

        let customerId = existing?.internal_id ?? null;
        if (customerId) {
          await client.query(
            `UPDATE customers
             SET email = $1, display_name = $2, tags = $3::text[], notes = $4,
                 must_reset_password = true,
                 external_ids = COALESCE(external_ids, '{}'::jsonb) || $5::jsonb
             WHERE id = $6`,
            [
              email,
              displayName,
              tags,
              notes,
              JSON.stringify({ shopify: externalId }),
              customerId,
            ],
          );
        } else {
          const byEmail = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM customers WHERE email = $1`,
            [email],
          );
          if (byEmail.rows[0]) {
            customerId = byEmail.rows[0].id;
            await client.query(
              `UPDATE customers
               SET display_name = COALESCE($1, display_name),
                   tags = $2::text[], notes = $3,
                   must_reset_password = true,
                   external_ids = COALESCE(external_ids, '{}'::jsonb) || $4::jsonb
               WHERE id = $5`,
              [
                displayName,
                tags,
                notes,
                JSON.stringify({ shopify: externalId }),
                customerId,
              ],
            );
          } else {
            const inserted = await client.query<{ id: string }>(
              `INSERT INTO customers
                 (tenant_id, email, password_hash, display_name, tags, notes,
                  must_reset_password, external_ids)
               VALUES ($1, $2, $3, $4, $5::text[], $6, true, $7::jsonb)
               RETURNING id::text AS id`,
              [
                tenantId,
                email,
                passwordHash,
                displayName,
                tags,
                notes,
                JSON.stringify({ shopify: externalId }),
              ],
            );
            customerId = inserted.rows[0]!.id;
          }
        }

        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'customer',
          externalId,
          internalId: customerId,
          checksum,
          status: 'imported',
        });
        stats.imported++;
      } catch (err) {
        stats.failed++;
        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'customer',
          externalId,
          internalId: null,
          checksum: null,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return stats;
  }

  private async importOrders(
    client: PoolClient,
    tenantId: string,
    jobId: string,
    orders: ShopifyOrder[],
  ): Promise<EntityStats> {
    const stats = { ...EMPTY_STATS };
    const fallbackVariantId = await this.ensureLegacyVariant(client, tenantId);

    for (const order of orders) {
      const externalId = String(order.id);
      try {
        const checksum = checksumOf(order);
        const existing = await this.findRecord(client, 'order', externalId);
        if (existing?.checksum === checksum && existing.internal_id) {
          stats.skipped++;
          continue;
        }

        const currency = (order.currency?.trim() || 'USD').toUpperCase();
        const total = moneyToMinor(order.total_price);
        const email = order.email?.trim().toLowerCase() || null;
        const shipping = order.shipping_address ?? null;
        const paymentStatus = mapShopifyPaymentStatus(order.financial_status);
        const status = mapShopifyOrderStatus(order.fulfillment_status);

        let orderId = existing?.internal_id ?? null;
        if (orderId) {
          await client.query(
            `UPDATE orders
             SET status = $1, payment_status = $2, guest_email = $3,
                 shipping_address = $4::jsonb, charge_currency = $5,
                 total_amount_minor = $6, source = 'shopify_import',
                 external_ids = COALESCE(external_ids, '{}'::jsonb) || $7::jsonb,
                 updated_at = now()
             WHERE id = $8`,
            [
              status,
              paymentStatus,
              email,
              shipping ? JSON.stringify(shipping) : null,
              currency,
              total,
              JSON.stringify({
                shopify: externalId,
                name: order.name ?? null,
              }),
              orderId,
            ],
          );
          await client.query(`DELETE FROM order_lines WHERE order_id = $1`, [
            orderId,
          ]);
        } else {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO orders
               (tenant_id, status, payment_status, guest_email, shipping_address,
                charge_currency, total_amount_minor, source, external_ids)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'shopify_import', $8::jsonb)
             RETURNING id::text AS id`,
            [
              tenantId,
              status,
              paymentStatus,
              email,
              shipping ? JSON.stringify(shipping) : null,
              currency,
              total,
              JSON.stringify({
                shopify: externalId,
                name: order.name ?? null,
              }),
            ],
          );
          orderId = inserted.rows[0]!.id;
        }

        for (const line of order.line_items ?? []) {
          let variantId = fallbackVariantId;
          if (line.variant_id != null) {
            const mapped = await this.findRecord(
              client,
              'variant',
              String(line.variant_id),
            );
            if (mapped?.internal_id) variantId = mapped.internal_id;
          }
          const qty = Math.max(1, Math.trunc(Number(line.quantity ?? 1) || 1));
          const unit = moneyToMinor(line.price);
          const title = line.title?.trim() || line.sku?.trim() || 'Line item';
          await client.query(
            `INSERT INTO order_lines
               (tenant_id, order_id, variant_id, title, quantity,
                unit_amount_minor, currency, qty_ordered, qty_fulfilled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $5, 0)`,
            [tenantId, orderId, variantId, title, qty, unit, currency],
          );
        }

        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'order',
          externalId,
          internalId: orderId,
          checksum,
          status: 'imported',
        });
        stats.imported++;
      } catch (err) {
        stats.failed++;
        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'order',
          externalId,
          internalId: null,
          checksum: null,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return stats;
  }

  private async importRedirects(
    client: PoolClient,
    tenantId: string,
    jobId: string,
    redirects: ShopifyRedirect[],
  ): Promise<EntityStats> {
    const stats = { ...EMPTY_STATS };

    for (const redirect of redirects) {
      const fromPath = normalizePath(redirect.path);
      const toPath = normalizePath(redirect.target);
      const externalId = String(redirect.id ?? `path:${fromPath}`);

      if (!fromPath || !toPath) {
        stats.skipped++;
        continue;
      }

      try {
        const checksum = checksumOf(redirect);
        const existing = await this.findRecord(client, 'redirect', externalId);
        if (existing?.checksum === checksum && existing.internal_id) {
          stats.skipped++;
          continue;
        }

        const upserted = await client.query<{ id: string }>(
          `INSERT INTO url_redirects
             (tenant_id, from_path, to_path, status_code, external_ids)
           VALUES ($1, $2, $3, 301, $4::jsonb)
           ON CONFLICT (tenant_id, from_path) DO UPDATE
             SET to_path = EXCLUDED.to_path,
                 status_code = EXCLUDED.status_code,
                 external_ids = url_redirects.external_ids || EXCLUDED.external_ids,
                 updated_at = now()
           RETURNING id::text AS id`,
          [
            tenantId,
            fromPath,
            toPath,
            JSON.stringify({ shopify: externalId }),
          ],
        );

        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'redirect',
          externalId,
          internalId: upserted.rows[0]!.id,
          checksum,
          status: 'imported',
        });
        stats.imported++;
      } catch (err) {
        stats.failed++;
        await this.upsertRecord(client, {
          tenantId,
          jobId,
          entityType: 'redirect',
          externalId,
          internalId: null,
          checksum: null,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return stats;
  }

  private async ensureLegacyVariant(
    client: PoolClient,
    tenantId: string,
  ): Promise<string> {
    const existing = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM product_variants WHERE sku = 'SHOPIFY-LEGACY-LINE'`,
    );
    if (existing.rows[0]) return existing.rows[0].id;

    let productId: string;
    const product = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM products WHERE slug = 'shopify-legacy-archive'`,
    );
    if (product.rows[0]) {
      productId = product.rows[0].id;
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO products
           (tenant_id, slug, title, description, status, external_ids)
         VALUES ($1, 'shopify-legacy-archive', 'Shopify legacy archive',
                 'Placeholder product for unmapped imported order lines',
                 'archived', '{"shopify":"legacy"}'::jsonb)
         RETURNING id::text AS id`,
        [tenantId],
      );
      productId = inserted.rows[0]!.id;
    }

    const variant = await client.query<{ id: string }>(
      `INSERT INTO product_variants
         (tenant_id, product_id, sku, title, unit_amount_minor, currency,
          inventory_quantity, external_ids)
       VALUES ($1, $2, 'SHOPIFY-LEGACY-LINE', 'Legacy line', 0, 'USD', 0,
               '{"shopify":"legacy-line"}'::jsonb)
       RETURNING id::text AS id`,
      [tenantId, productId],
    );
    return variant.rows[0]!.id;
  }

  private async findRecord(
    client: PoolClient,
    entityType: MigrationRecordEntity,
    externalId: string,
  ): Promise<{ internal_id: string | null; checksum: string | null } | null> {
    const res = await client.query<{
      internal_id: string | null;
      checksum: string | null;
    }>(
      `SELECT internal_id::text AS internal_id, checksum
       FROM migration_records
       WHERE entity_type = $1 AND external_id = $2`,
      [entityType, externalId],
    );
    return res.rows[0] ?? null;
  }

  private async upsertRecord(
    client: PoolClient,
    args: {
      tenantId: string;
      jobId: string;
      entityType: MigrationRecordEntity;
      externalId: string;
      internalId: string | null;
      checksum: string | null;
      status: 'imported' | 'skipped' | 'failed';
      error?: string;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO migration_records
         (tenant_id, job_id, entity_type, external_id, internal_id, checksum, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, entity_type, external_id) DO UPDATE
         SET job_id = EXCLUDED.job_id,
             internal_id = COALESCE(EXCLUDED.internal_id, migration_records.internal_id),
             checksum = COALESCE(EXCLUDED.checksum, migration_records.checksum),
             status = EXCLUDED.status,
             error = EXCLUDED.error,
             updated_at = now()`,
      [
        args.tenantId,
        args.jobId,
        args.entityType,
        args.externalId,
        args.internalId,
        args.checksum,
        args.status,
        args.error?.slice(0, 2000) ?? null,
      ],
    );
  }

  private async findJobTenant(
    jobId: string,
  ): Promise<{ tenantId: string }> {
    // Scan tenants — RLS-safe platform lookup
    const tenants = await this.listTenantIds();
    for (const tenantId of tenants) {
      const found = await this.db.withTenant(tenantId, async (client) => {
        const res = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM migration_jobs WHERE id = $1`,
          [jobId],
        );
        return res.rows[0]?.id ? tenantId : null;
      });
      if (found) return { tenantId: found };
    }
    throw new NotFoundException('Migration job not found');
  }

  private async listTenantIds(): Promise<string[]> {
    // tenants table is RLS-scoped; use SECURITY DEFINER host resolve style helper
    // Fallback: known demo seeds + any resolvable via admin query on domains.
    // We add a small SQL function in 09-migration for platform listing.
    try {
      const res = await this.db.query<{ id: string }>(
        `SELECT id::text AS id FROM list_tenant_ids_for_platform()`,
      );
      return res.rows.map((r) => r.id);
    } catch {
      return [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ];
    }
  }

  private async resolveTenantId(tenantIdOrSlug: string): Promise<string> {
    const res = await this.db.query<{ id: string }>(
      `SELECT resolve_tenant_id_by_ref($1)::text AS id`,
      [tenantIdOrSlug],
    );
    const id = res.rows[0]?.id;
    if (!id) throw new NotFoundException(`Tenant not found: ${tenantIdOrSlug}`);
    return id;
  }

  private normalizeEntityTypes(
    input: MigrationEntityType[] | undefined,
  ): MigrationEntityType[] {
    if (!input?.length) return [];
    const set = new Set<MigrationEntityType>();
    for (const raw of input) {
      const value = String(raw).trim().toLowerCase() as MigrationEntityType;
      if (!ENTITY_TYPES.includes(value)) {
        throw new BadRequestException(
          `Unknown entity type: ${raw}. Expected: ${ENTITY_TYPES.join(', ')}`,
        );
      }
      set.add(value);
    }
    return ENTITY_TYPES.filter((e) => set.has(e));
  }

  private jobSelectSql(suffix: string): string {
    return `SELECT id::text, tenant_id::text, source, entity_types, status,
                   shop_domain, stats, error, created_at, started_at, finished_at
            FROM migration_jobs ${suffix}`;
  }

  private toJobDto(row: {
    id: string;
    tenant_id: string;
    source: MigrationSource;
    entity_types: string[];
    status: MigrationJobStatus;
    shop_domain: string | null;
    stats: Record<string, unknown>;
    error: string | null;
    created_at: Date | string;
    started_at: Date | string | null;
    finished_at: Date | string | null;
  }): MigrationJobDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      source: row.source,
      entityTypes: row.entity_types as MigrationEntityType[],
      status: row.status,
      shopDomain: row.shop_domain,
      stats: row.stats ?? {},
      error: row.error,
      createdAt: toIso(row.created_at),
      startedAt: row.started_at ? toIso(row.started_at) : null,
      finishedAt: row.finished_at ? toIso(row.finished_at) : null,
    };
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function checksumOf(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 32);
}

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

function moneyToMinor(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function normalizeProductStatus(status: string | null | undefined): string {
  const v = (status ?? 'active').trim().toLowerCase();
  if (v === 'draft') return 'draft';
  if (v === 'archived') return 'archived';
  return 'active';
}

function normalizePath(path: string | null | undefined): string {
  if (!path) return '';
  let p = path.trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) {
    try {
      const url = new URL(p);
      p = url.pathname + url.search;
    } catch {
      /* keep */
    }
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

function mapShopifyPaymentStatus(raw: string | null | undefined): string {
  const v = (raw ?? '').toLowerCase();
  if (v === 'paid') return 'paid';
  if (v === 'refunded' || v === 'partially_refunded') return 'refunded';
  if (v === 'pending' || v === 'authorized') return 'not_charged';
  return 'not_charged';
}

function mapShopifyOrderStatus(raw: string | null | undefined): string {
  const v = (raw ?? '').toLowerCase();
  if (v === 'fulfilled') return 'fulfilled';
  if (v === 'partial') return 'partially_fulfilled';
  return 'placed';
}
