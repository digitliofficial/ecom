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

  async function placeGuestOrder(email: string, quantity = 1) {
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
      .send({ variantId: DEMO_VARIANT, quantity })
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
      expect(detail.body.fulfillments).toEqual([]);
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
      expect(fulfilled.body.fulfillments.length).toBe(1);
      expect(fulfilled.body.fulfillments[0].status).toBe('pending');

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
    expect(shipped.body.fulfillments[0].status).toBe('shipped');

    const cancelled = await request(server)
      .patch(`/v1/admin/orders/${cancelId}/status`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.lines[0].qtyFulfilled).toBe(0);
  });

  it.skipIf(!hasDb)(
    'partial and split fulfillments with per-shipment tracking',
    async () => {
      expect(staffToken).toBeTruthy();
      const orderId = await placeGuestOrder(
        `split-${Date.now().toString(36)}@example.com`,
        3,
      );

      const detail = await request(server)
        .get(`/v1/admin/orders/${orderId}`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const lineId = detail.body.lines[0].id as string;
      expect(detail.body.lines[0].qtyOrdered).toBe(3);

      const first = await request(server)
        .post(`/v1/admin/orders/${orderId}/fulfillments`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          lines: [{ orderLineId: lineId, qty: 1 }],
          carrier: 'TCS',
          trackingNumber: 'TCS-AAA-001',
          markShipped: true,
        })
        .expect(201);

      expect(first.body.status).toBe('partially_fulfilled');
      expect(first.body.lines[0].qtyFulfilled).toBe(1);
      expect(first.body.fulfillments).toHaveLength(1);
      expect(first.body.fulfillments[0].trackingNumber).toBe('TCS-AAA-001');
      expect(first.body.fulfillments[0].carrier).toBe('TCS');
      expect(first.body.fulfillments[0].status).toBe('shipped');
      expect(first.body.fulfillments[0].lines[0].qty).toBe(1);

      await request(server)
        .post(`/v1/admin/orders/${orderId}/fulfillments`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          lines: [{ orderLineId: lineId, qty: 5 }],
        })
        .expect(400);

      const second = await request(server)
        .post(`/v1/admin/orders/${orderId}/fulfillments`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          lines: [{ orderLineId: lineId, qty: 2 }],
          markShipped: false,
        })
        .expect(201);

      expect(second.body.status).toBe('fulfilled');
      expect(second.body.lines[0].qtyFulfilled).toBe(3);
      expect(second.body.fulfillments).toHaveLength(2);

      const pendingId = second.body.fulfillments.find(
        (f: { status: string }) => f.status === 'pending',
      ).id as string;

      const tracked = await request(server)
        .patch(`/v1/admin/orders/${orderId}/fulfillments/${pendingId}`)
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          carrier: 'Leopard',
          trackingNumber: 'LEO-BBB-002',
          status: 'shipped',
        })
        .expect(200);

      const updated = tracked.body.fulfillments.find(
        (f: { id: string }) => f.id === pendingId,
      );
      expect(updated.status).toBe('shipped');
      expect(updated.trackingNumber).toBe('LEO-BBB-002');
      expect(updated.carrier).toBe('Leopard');
      expect(updated.shippedAt).toBeTruthy();
    },
  );
});
