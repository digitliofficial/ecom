import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('admin catalog CRUD', () => {
  let app: INestApplication;
  let server: Server;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ComputeClientService)
      .useValue({
        validateAddress: async () => ({
          valid: true,
          warnings: [],
          normalized: {},
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it.skipIf(!hasDb)('requires staff bearer for admin list', async () => {
    await request(server)
      .get('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .expect(401);
  });

  it.skipIf(!hasDb)(
    'create → storefront list → update inventory (demo tenant)',
    async () => {
      const created = await request(server)
        .post('/v1/admin/catalog/products')
        .set('Host', DEMO_HOST)
        .set('Authorization', 'Bearer stub-admin')
        .send({
          title: `Admin Tee ${suffix}`,
          slug: `admin-tee-${suffix}`,
          description: 'Created via admin catalog CRUD test',
          status: 'active',
          variants: [
            {
              title: 'Default',
              sku: `TEE-ADMIN-${suffix}`,
              unitAmountMinor: 1999,
              currency: 'USD',
              inventoryQuantity: 12,
            },
          ],
        })
        .expect(201);

      expect(created.body.title).toBe(`Admin Tee ${suffix}`);
      expect(created.body.variants).toHaveLength(1);
      expect(created.body.variants[0].inventoryQuantity).toBe(12);
      expect(created.body.variants[0].unitAmountMinor).toBe(1999);

      const storefront = await request(server)
        .get('/v1/catalog/products')
        .set('Host', DEMO_HOST)
        .expect(200);

      const found = storefront.body.find(
        (p: { id: string }) => p.id === created.body.id,
      );
      expect(found).toBeTruthy();
      expect(found.title).toBe(`Admin Tee ${suffix}`);

      const patched = await request(server)
        .patch(`/v1/admin/catalog/products/${created.body.id}`)
        .set('Host', DEMO_HOST)
        .set('Authorization', 'Bearer stub-admin')
        .send({
          title: `Admin Tee ${suffix} Updated`,
          variants: [
            {
              id: created.body.variants[0].id,
              title: 'Default',
              sku: `TEE-ADMIN-${suffix}`,
              unitAmountMinor: 2199,
              currency: 'USD',
              inventoryQuantity: 8,
            },
          ],
        })
        .expect(200);

      expect(patched.body.title).toBe(`Admin Tee ${suffix} Updated`);
      expect(patched.body.variants[0].unitAmountMinor).toBe(2199);
      expect(patched.body.variants[0].inventoryQuantity).toBe(8);

      const otherList = await request(server)
        .get('/v1/admin/catalog/products')
        .set('Host', OTHER_HOST)
        .set('Authorization', 'Bearer stub-admin')
        .expect(200);

      expect(
        otherList.body.find((p: { id: string }) => p.id === created.body.id),
      ).toBeUndefined();
    },
  );
});
