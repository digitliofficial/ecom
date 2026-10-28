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
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('admin orders', () => {
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
        validateAddress: async () => ({
          valid: true,
          warnings: [],
          normalized: {
            line1: '1 Demo St',
            city: 'Demo City',
            country: 'US',
          },
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

  async function placeGuestOrder(email: string) {
    const created = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    const cartId = created.body.id as string;
    const guestToken = created.body.guestToken as string;

    await request(server)
      .post(`/v1/carts/${cartId}/lines`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({ variantId: DEMO_VARIANT, quantity: 1 })
      .expect(201);

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email,
        paymentMethod: 'cod',
        shippingMethodId: DEMO_STANDARD_SHIP,
        shippingAddress: {
          line1: '1 Demo St',
          city: 'Demo City',
          country: 'US',
          postalCode: '10001',
        },
      })
      .expect(201);

    return checkout.body.order.id as string;
  }

  it.skipIf(!hasDb)('requires staff bearer for admin list', async () => {
    await request(server)
      .get('/v1/admin/orders')
      .set('Host', DEMO_HOST)
      .expect(401);
  });

  it.skipIf(!hasDb)(
    'guest checkout appears in admin list → fulfill',
    async () => {
      expect(staffToken).toBeTruthy();
      const suffix = Date.now().toString(36);
      const orderId = await placeGuestOrder(`guest-${suffix}@example.com`);

      const list = await request(server)
        .get('/v1/admin/orders')
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const found = list.body.find((o: { id: string }) => o.id === orderId);
      expect(found).toBeTruthy();
      expect(found.status).toBe('placed');
      expect(found.guestEmail).toBe(`guest-${suffix}@example.com`);

      const detail = await request(server)
        .get(`/v1/admin/orders/${orderId}`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(detail.body.lines.length).toBeGreaterThanOrEqual(1);
      expect(detail.body.lines[0].qtyFulfilled).toBe(0);
      expect(detail.body.shippingAddress.line1).toBe('1 Demo St');

      const fulfilled = await request(server)
        .patch(`/v1/admin/orders/${orderId}/status`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'fulfilled' })
        .expect(200);

      expect(fulfilled.body.status).toBe('fulfilled');
      expect(fulfilled.body.lines[0].qtyFulfilled).toBe(
        fulfilled.body.lines[0].qtyOrdered,
      );

      await request(server)
        .patch(`/v1/admin/orders/${orderId}/status`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'cancelled' })
        .expect(400);

      await request(server)
        .get('/v1/admin/orders')
        .set('Host', OTHER_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(401);
    },
  );

  it.skipIf(!hasDb)('ship and cancel transitions from placed', async () => {
    expect(staffToken).toBeTruthy();
    const shipId = await placeGuestOrder(
      `ship-${Date.now().toString(36)}@example.com`,
    );
    const cancelId = await placeGuestOrder(
      `cancel-${Date.now().toString(36)}@example.com`,
    );

    const shipped = await request(server)
      .patch(`/v1/admin/orders/${shipId}/status`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'shipped' })
      .expect(200);
    expect(shipped.body.status).toBe('shipped');
    expect(shipped.body.lines[0].qtyFulfilled).toBe(
      shipped.body.lines[0].qtyOrdered,
    );

    const cancelled = await request(server)
      .patch(`/v1/admin/orders/${cancelId}/status`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.lines[0].qtyFulfilled).toBe(0);
  });
});
