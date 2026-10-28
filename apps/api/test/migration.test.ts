import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const PLATFORM_KEY = 'test-platform-key';
const DEMO_TENANT = '00000000-0000-4000-8000-000000000001';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('Shopify migration jobs', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.PLATFORM_API_KEY = PLATFORM_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ComputeClientService)
      .useValue({
        validateAddress: async () => ({
          valid: true,
          warnings: [],
          normalized: { line1: '1 Demo St', city: 'Demo City', country: 'US' },
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it.skipIf(!hasDb)('rejects missing platform key', async () => {
    await request(server).get('/v1/platform/migration/jobs').expect(401);
  });

  it.skipIf(!hasDb)(
    'imports products, customers, orders, redirects via fixture (idempotent)',
    async () => {
      const suffix = `${Date.now()}`;
      const productId = Number(`9${suffix.slice(-6)}`);
      const variantId = Number(`91${suffix.slice(-5)}`);
      const customerId = Number(`8${suffix.slice(-6)}`);
      const orderId = Number(`7${suffix.slice(-6)}`);
      const redirectId = Number(`6${suffix.slice(-6)}`);
      const handle = `migration-mug-${suffix}`;
      const email = `imported.${suffix}@example.com`;

      const create = await request(server)
        .post('/v1/platform/migration/jobs')
        .set('X-Platform-Key', PLATFORM_KEY)
        .send({
          tenantId: 'demo',
          source: 'fixture',
          entityTypes: ['products', 'customers', 'orders', 'redirects'],
          fixture: {
            products: [
              {
                id: productId,
                title: 'Migration Mug',
                handle,
                body_html: '<p>Imported mug</p>',
                status: 'active',
                variants: [
                  {
                    id: variantId,
                    sku: `MIG-MUG-${suffix.slice(-4)}`,
                    title: 'Default',
                    price: '19.99',
                    inventory_quantity: 7,
                  },
                ],
              },
            ],
            customers: [
              {
                id: customerId,
                email,
                first_name: 'Imported',
                last_name: 'Customer',
                tags: 'vip,wholesale',
                note: 'From Shopify',
              },
            ],
            orders: [
              {
                id: orderId,
                email,
                name: '#1001',
                currency: 'USD',
                total_price: '19.99',
                financial_status: 'paid',
                fulfillment_status: null,
                line_items: [
                  {
                    variant_id: variantId,
                    title: 'Migration Mug',
                    quantity: 1,
                    price: '19.99',
                  },
                ],
              },
            ],
            redirects: [
              {
                id: redirectId,
                path: `/old-mug-${suffix}`,
                target: `/products/${handle}`,
              },
            ],
          },
        })
        .expect(201);

      expect(create.body.tenantId).toBe(DEMO_TENANT);
      expect(create.body.status).toBe('pending');
      const jobId = create.body.id as string;

      const ran = await request(server)
        .post(`/v1/platform/migration/jobs/${jobId}/run`)
        .set('X-Platform-Key', PLATFORM_KEY)
        .expect(201);

      expect(ran.body.status).toBe('completed');
      expect(ran.body.stats.products.imported).toBe(1);
      expect(ran.body.stats.customers.imported).toBe(1);
      expect(ran.body.stats.orders.imported).toBe(1);
      expect(ran.body.stats.redirects.imported).toBe(1);

      const again = await request(server)
        .post(`/v1/platform/migration/jobs/${jobId}/run`)
        .set('X-Platform-Key', PLATFORM_KEY)
        .expect(201);

      expect(again.body.status).toBe('completed');
      expect(again.body.stats.products.skipped).toBe(1);
      expect(again.body.stats.customers.skipped).toBe(1);
      expect(again.body.stats.orders.skipped).toBe(1);
      expect(again.body.stats.redirects.skipped).toBe(1);

      const listed = await request(server)
        .get('/v1/platform/migration/jobs')
        .query({ tenantId: 'demo' })
        .set('X-Platform-Key', PLATFORM_KEY)
        .expect(200);

      expect(listed.body.some((j: { id: string }) => j.id === jobId)).toBe(
        true,
      );
    },
  );

  it.skipIf(!hasDb)('imports products from CSV fallback', async () => {
    const suffix = `${Date.now()}`;
    const csv = [
      'Handle,Title,Body (HTML),Variant SKU,Variant Price,Variant Inventory Qty,Status',
      `csv-tee-${suffix},CSV Tee,A tee,CSV-TEE-${suffix.slice(-4)},12.50,3,active`,
    ].join('\n');

    const create = await request(server)
      .post('/v1/platform/migration/jobs')
      .set('X-Platform-Key', PLATFORM_KEY)
      .send({
        tenantId: DEMO_TENANT,
        source: 'csv',
        entityTypes: ['products'],
        csv: { products: csv },
      })
      .expect(201);

    const ran = await request(server)
      .post(`/v1/platform/migration/jobs/${create.body.id}/run`)
      .set('X-Platform-Key', PLATFORM_KEY)
      .expect(201);

    expect(ran.body.status).toBe('completed');
    expect(ran.body.stats.products.imported).toBeGreaterThanOrEqual(1);
  });
});
