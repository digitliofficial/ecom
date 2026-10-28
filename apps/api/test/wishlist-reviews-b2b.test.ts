import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const DEMO_HOST = 'demo.localhost';
const DEMO_VARIANT = '30000000-0000-4000-8000-000000000001';
const DEMO_PRODUCT = '20000000-0000-4000-8000-000000000001';
const DEMO_CUSTOMER_ID = '60000000-0000-4000-8000-000000000001';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('wishlist + reviews + B2B', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';
  let customerToken = '';
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
        validateAddress: async (body: {
          line1: string;
          city: string;
          country: string;
        }) => ({
          valid: true,
          warnings: [],
          normalized: {
            ...body,
            line1: body.line1.trim(),
            city: body.city.trim(),
            country: body.country.trim().toUpperCase(),
          },
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;

    if (hasDb) {
      const staff = await request(server)
        .post('/v1/auth/staff/login')
        .set('Host', DEMO_HOST)
        .send({ email: 'owner@demo.localhost', password: 'DemoOwner123!' });
      staffToken = staff.body.token as string;

      // B2B is Growth+ (feature_b2b); leave Starter for other suites after we finish.
      await request(server)
        .post('/v1/admin/billing/change-plan')
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ planCode: 'growth' })
        .expect(201);

      const customer = await request(server)
        .post('/v1/auth/customer/login')
        .set('Host', DEMO_HOST)
        .send({
          email: 'customer@demo.localhost',
          password: 'DemoCustomer123!',
        });
      customerToken = customer.body.token as string;
    }
  });

  afterAll(async () => {
    if (hasDb && staffToken) {
      await request(server)
        .post('/v1/admin/billing/change-plan')
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ planCode: 'starter' });
    }
    await app.close();
  });

  it.skipIf(!hasDb)('wishlist requires customer auth and persists items', async () => {
    await request(server)
      .get('/v1/wishlist')
      .set('Host', DEMO_HOST)
      .expect(401);

    const added = await request(server)
      .post('/v1/wishlist/items')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: DEMO_VARIANT })
      .expect(201);

    expect(added.body.customerId).toBe(DEMO_CUSTOMER_ID);
    expect(
      added.body.items.some(
        (i: { variantId: string }) => i.variantId === DEMO_VARIANT,
      ),
    ).toBe(true);
    // Demo customer is on wholesale list → mug at 2000
    const mug = added.body.items.find(
      (i: { variantId: string }) => i.variantId === DEMO_VARIANT,
    );
    expect(mug.unitAmountMinor).toBe(2000);
    expect(mug.priceSource).toBe('price_list');

    const listed = await request(server)
      .get('/v1/wishlist')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(listed.body.items.length).toBeGreaterThanOrEqual(1);

    await request(server)
      .delete(`/v1/wishlist/items/${DEMO_VARIANT}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
  });

  it.skipIf(!hasDb)('reviews submit pending, admin approves, storefront lists', async () => {
    const created = await request(server)
      .post(`/v1/catalog/products/${DEMO_PRODUCT}/reviews`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        rating: 5,
        title: `Great mug ${suffix}`,
        body: 'Solid demo mug for the vertical slice.',
        locale: 'en',
      })
      .expect(201);

    expect(created.body.status).toBe('pending');
    expect(created.body.rating).toBe(5);

    const publicBefore = await request(server)
      .get(`/v1/catalog/products/${DEMO_PRODUCT}/reviews`)
      .set('Host', DEMO_HOST)
      .expect(200);
    expect(
      publicBefore.body.some((r: { id: string }) => r.id === created.body.id),
    ).toBe(false);

    const pending = await request(server)
      .get('/v1/admin/reviews?status=pending')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(
      pending.body.some((r: { id: string }) => r.id === created.body.id),
    ).toBe(true);

    await request(server)
      .patch(`/v1/admin/reviews/${created.body.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const publicAfter = await request(server)
      .get(`/v1/catalog/products/${DEMO_PRODUCT}/reviews`)
      .set('Host', DEMO_HOST)
      .expect(200);
    expect(
      publicAfter.body.some((r: { id: string }) => r.id === created.body.id),
    ).toBe(true);

    const rating = await request(server)
      .get(`/v1/catalog/products/${DEMO_PRODUCT}/rating`)
      .set('Host', DEMO_HOST)
      .expect(200);
    expect(rating.body.ratingCount).toBeGreaterThanOrEqual(1);
    expect(rating.body.ratingAvg).toBeGreaterThan(0);
  });

  it.skipIf(!hasDb)('B2B price list applies to catalog + cart for group member', async () => {
    const guestCatalog = await request(server)
      .get('/v1/catalog/products')
      .set('Host', DEMO_HOST)
      .expect(200);
    const guestMug = guestCatalog.body
      .find((p: { id: string }) => p.id === DEMO_PRODUCT)
      ?.variants.find((v: { id: string }) => v.id === DEMO_VARIANT);
    expect(guestMug.unitAmountMinor).toBe(2500);

    const memberCatalog = await request(server)
      .get('/v1/catalog/products')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const memberMug = memberCatalog.body
      .find((p: { id: string }) => p.id === DEMO_PRODUCT)
      ?.variants.find((v: { id: string }) => v.id === DEMO_VARIANT);
    expect(memberMug.unitAmountMinor).toBe(2000);
    expect(memberMug.priceSource).toBe('price_list');
    expect(memberMug.compareAtAmountMinor).toBe(2500);

    const cart = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    // Link cart to customer via login cart merge path: set customer_id by
    // using guest token after register is already done — add via cart that
    // was created while authenticated still starts guest; attach by
    // customer login with X-Cart-Token.
    const relink = await request(server)
      .post('/v1/auth/customer/login')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({
        email: 'customer@demo.localhost',
        password: 'DemoCustomer123!',
      })
      .expect(201);

    const withLine = await request(server)
      .post(`/v1/carts/${cart.body.id}/lines`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${relink.body.token}`)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({ variantId: DEMO_VARIANT, quantity: 1 })
      .expect(201);

    const line = withLine.body.lines.find(
      (l: { variantId: string }) => l.variantId === DEMO_VARIANT,
    );
    expect(line.unitAmountMinor).toBe(2000);
  });

  it.skipIf(!hasDb)('admin can list seeded B2B groups and price lists', async () => {
    const lists = await request(server)
      .get('/v1/admin/b2b/price-lists')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(
      lists.body.some((l: { name: string }) => l.name === 'Wholesale USD'),
    ).toBe(true);

    const groups = await request(server)
      .get('/v1/admin/b2b/customer-groups')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    const wholesale = groups.body.find(
      (g: { name: string }) => g.name === 'Wholesale',
    );
    expect(wholesale).toBeTruthy();
    expect(
      wholesale.members.some(
        (m: { customerId: string }) => m.customerId === DEMO_CUSTOMER_ID,
      ),
    ).toBe(true);

    const created = await request(server)
      .post('/v1/admin/b2b/price-lists')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: `Test list ${suffix}`,
        currency: 'USD',
        items: [
          {
            variantId: DEMO_VARIANT,
            unitAmountMinor: 1800,
            currency: 'USD',
          },
        ],
      })
      .expect(201);
    expect(created.body.items[0].unitAmountMinor).toBe(1800);
  });
});
