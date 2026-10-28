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

describe('collections, discounts, multi-location inventory', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    process.env.JWT_SECRET ??= 'test-jwt-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ComputeClientService)
      .useValue({
        validateAddress: async (addr: Record<string, string>) => ({
          valid: true,
          warnings: [],
          normalized: addr,
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;

    if (hasDb) {
      const login = await request(server)
        .post('/v1/auth/staff/login')
        .set('Host', DEMO_HOST)
        .send({ email: 'owner@demo.localhost', password: 'DemoOwner123!' });
      staffToken = login.body.token as string;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.skipIf(!hasDb)('collections admin CRUD + storefront filter', async () => {
    expect(staffToken).toBeTruthy();

    const product = await request(server)
      .post('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: `Coll Product ${suffix}`,
        slug: `coll-product-${suffix}`,
        status: 'active',
        variants: [
          {
            title: 'Default',
            sku: `COLL-${suffix}`,
            unitAmountMinor: 1500,
            currency: 'USD',
            inventoryQuantity: 20,
          },
        ],
      })
      .expect(201);

    const created = await request(server)
      .post('/v1/admin/collections')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: `Summer ${suffix}`,
        slug: `summer-${suffix}`,
        status: 'active',
        productIds: [product.body.id],
      })
      .expect(201);

    expect(created.body.productIds).toEqual([product.body.id]);
    expect(created.body.productCount).toBe(1);

    const storefront = await request(server)
      .get(`/v1/catalog/products?collection=summer-${suffix}`)
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(storefront.body.some((p: { id: string }) => p.id === product.body.id)).toBe(
      true,
    );

    const bySlug = await request(server)
      .get(`/v1/catalog/collections/summer-${suffix}`)
      .set('Host', DEMO_HOST)
      .expect(200);
    expect(bySlug.body.products).toHaveLength(1);

    await request(server)
      .get('/v1/admin/collections')
      .set('Host', OTHER_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(401);
  });

  it.skipIf(!hasDb)('discount coupon applies at checkout', async () => {
    expect(staffToken).toBeTruthy();

    const product = await request(server)
      .post('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: `Disc Product ${suffix}`,
        slug: `disc-product-${suffix}`,
        status: 'active',
        variants: [
          {
            title: 'Default',
            sku: `DISC-${suffix}`,
            unitAmountMinor: 2000,
            currency: 'USD',
            inventoryQuantity: 15,
          },
        ],
      })
      .expect(201);

    const discount = await request(server)
      .post('/v1/admin/discounts')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: `PCT${suffix}`.slice(0, 16).toUpperCase(),
        title: 'Test 10%',
        type: 'percentage',
        value: 10,
        currency: 'USD',
        active: true,
      })
      .expect(201);

    const cart = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    await request(server)
      .post(`/v1/carts/${cart.body.id}/lines`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(201);

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({
        cartId: cart.body.id,
        email: `disc-${suffix}@example.com`,
        paymentMethod: 'cod',
        discountCode: discount.body.code,
        shippingAddress: {
          line1: '12 Clifton',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(201);

    expect(checkout.body.order.subtotalAmountMinor).toBe(2000);
    expect(checkout.body.order.discountAmountMinor).toBe(200);
    expect(checkout.body.order.totalAmountMinor).toBe(1800);
    expect(checkout.body.order.discountCode).toBe(discount.body.code);
  });

  it.skipIf(!hasDb)('locations + stock edit + decrement on order', async () => {
    expect(staffToken).toBeTruthy();

    const locs = await request(server)
      .get('/v1/admin/inventory/locations')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(locs.body.some((l: { isDefault: boolean }) => l.isDefault)).toBe(
      true,
    );
    const defaultLoc = locs.body.find(
      (l: { isDefault: boolean }) => l.isDefault,
    );

    const product = await request(server)
      .post('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: `Inv Product ${suffix}`,
        slug: `inv-product-${suffix}`,
        status: 'active',
        variants: [
          {
            title: 'Default',
            sku: `INV-${suffix}`,
            unitAmountMinor: 1000,
            currency: 'USD',
            inventoryQuantity: 5,
          },
        ],
      })
      .expect(201);

    const variantId = product.body.variants[0].id as string;

    await request(server)
      .put('/v1/admin/inventory/levels')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        locationId: defaultLoc.id,
        variantId,
        quantity: 4,
      })
      .expect(200);

    const levels = await request(server)
      .get('/v1/admin/inventory/levels')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const level = levels.body.find(
      (row: { variantId: string; locationId: string }) =>
        row.variantId === variantId && row.locationId === defaultLoc.id,
    );
    expect(level.quantity).toBe(4);

    const cart = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({})
      .expect(201);

    await request(server)
      .post(`/v1/carts/${cart.body.id}/lines`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({ variantId, quantity: 2 })
      .expect(201);

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({
        cartId: cart.body.id,
        email: `inv-${suffix}@example.com`,
        paymentMethod: 'cod',
        shippingAddress: {
          line1: '1 Demo',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(201);

    const after = await request(server)
      .get('/v1/admin/inventory/levels')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const afterLevel = after.body.find(
      (row: { variantId: string; locationId: string }) =>
        row.variantId === variantId && row.locationId === defaultLoc.id,
    );
    expect(afterLevel.quantity).toBe(2);

    const catalog = await request(server)
      .get(`/v1/admin/catalog/products/${product.body.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(catalog.body.variants[0].inventoryQuantity).toBe(2);
  });
});
