import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const DEMO_VARIANT = '30000000-0000-4000-8000-000000000001';
const DEMO_STANDARD_SHIP = '40000000-0000-4000-8000-000000000001';
const DEMO_AGG_SHIP = '40000000-0000-4000-8000-000000000003';
const OTHER_FLAT_SHIP = '40000000-0000-4000-8000-000000000010';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('shipping / couriers MVP', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';

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
        createShipment: async ({ orderId }: { orderId?: string }) => ({
          trackingNumber: `AGG-${(orderId ?? 'X').slice(0, 8).toUpperCase()}`,
          labelUrl: 'https://example.invalid/labels/test',
          carrier: 'aggregator_stub',
          adapter: 'aggregator_stub',
        }),
        shippingRates: async () => ({ rates: [] }),
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

  async function cartWithLine(host = DEMO_HOST, variantId = DEMO_VARIANT) {
    const created = await request(server)
      .post('/v1/carts')
      .set('Host', host)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    const cartId = created.body.id as string;
    const guestToken = created.body.guestToken as string;

    await request(server)
      .post(`/v1/carts/${cartId}/lines`)
      .set('Host', host)
      .set('X-Cart-Token', guestToken)
      .send({ variantId, quantity: 1 })
      .expect(201);

    return { cartId, guestToken };
  }

  it.skipIf(!hasDb)('lists storefront shipping methods for demo', async () => {
    const res = await request(server)
      .get('/v1/shipping/methods')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(DEMO_STANDARD_SHIP);
  });

  it.skipIf(!hasDb)('COD filter hides non-COD-compatible methods', async () => {
    const all = await request(server)
      .get('/v1/shipping/methods')
      .set('Host', DEMO_HOST)
      .expect(200);

    const cod = await request(server)
      .get('/v1/shipping/methods?paymentMethod=cod')
      .set('Host', DEMO_HOST)
      .expect(200);

    const allIds = all.body.map((m: { id: string }) => m.id);
    const codIds = cod.body.map((m: { id: string }) => m.id);
    expect(allIds).toContain(DEMO_AGG_SHIP);
    expect(codIds).not.toContain(DEMO_AGG_SHIP);
    expect(codIds).toContain(DEMO_STANDARD_SHIP);
  });

  it.skipIf(!hasDb)('staff can create and patch shipping methods', async () => {
    expect(staffToken).toBeTruthy();

    const created = await request(server)
      .post('/v1/admin/shipping/methods')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Same-day city',
        priceAmountMinor: 1200,
        currency: 'USD',
        codCompatible: true,
        adapter: 'manual',
      })
      .expect(201);

    expect(created.body.name).toBe('Same-day city');
    expect(created.body.priceAmountMinor).toBe(1200);

    const patched = await request(server)
      .patch(`/v1/admin/shipping/methods/${created.body.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ enabled: false, codCompatible: false })
      .expect(200);

    expect(patched.body.enabled).toBe(false);
    expect(patched.body.codCompatible).toBe(false);
  });

  it.skipIf(!hasDb)('checkout adds shipping to total', async () => {
    const { cartId, guestToken } = await cartWithLine();

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'ship-guest@example.com',
        paymentMethod: 'cod',
        shippingMethodId: DEMO_STANDARD_SHIP,
        shippingAddress: {
          line1: '12 Clifton',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(201);

    // mug 2500 + standard ship 500
    expect(checkout.body.order.subtotalAmountMinor).toBe(2500);
    expect(checkout.body.order.shippingAmountMinor).toBe(500);
    expect(checkout.body.order.totalAmountMinor).toBe(3000);
    expect(checkout.body.shipping.methodName).toBe('Standard shipping');

    const detail = await request(server)
      .get(`/v1/admin/orders/${checkout.body.order.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(detail.body.shippingAmountMinor).toBe(500);
    expect(detail.body.shippingMethodName).toBe('Standard shipping');
  });

  it.skipIf(!hasDb)('rejects COD with non-COD-compatible shipping', async () => {
    const { cartId, guestToken } = await cartWithLine();

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'bad-cod-ship@example.com',
        paymentMethod: 'cod',
        shippingMethodId: DEMO_AGG_SHIP,
        shippingAddress: {
          line1: '1 St',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(400);
  });

  it.skipIf(!hasDb)('fulfill with tracking persists on order + shipment', async () => {
    const { cartId, guestToken } = await cartWithLine();

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'track@example.com',
        paymentMethod: 'cod',
        shippingMethodId: DEMO_STANDARD_SHIP,
        shippingAddress: {
          line1: '9 Street',
          city: 'Lahore',
          country: 'PK',
        },
      })
      .expect(201);

    const orderId = checkout.body.order.id as string;

    const shipped = await request(server)
      .patch(`/v1/admin/orders/${orderId}/status`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        status: 'shipped',
        trackingNumber: 'TCS-DEMO-001',
        trackingCarrier: 'TCS',
      })
      .expect(200);

    expect(shipped.body.status).toBe('shipped');
    expect(shipped.body.trackingNumber).toBe('TCS-DEMO-001');
    expect(shipped.body.trackingCarrier).toBe('TCS');
    expect(shipped.body.shippedAt).toBeTruthy();
  });

  it.skipIf(!hasDb)('other tenant flat rate is isolated', async () => {
    const res = await request(server)
      .get('/v1/shipping/methods')
      .set('Host', OTHER_HOST)
      .expect(200);

    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toEqual([OTHER_FLAT_SHIP]);
  });
});
