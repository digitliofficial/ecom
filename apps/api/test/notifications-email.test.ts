import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';
import { DatabaseService } from '../src/db/database.service';

const DEMO_HOST = 'demo.localhost';
const DEMO_VARIANT = '30000000-0000-4000-8000-000000000001';
const DEMO_STANDARD_SHIP = '40000000-0000-4000-8000-000000000001';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('Order lifecycle + abandoned cart email', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';
  let db: DatabaseService;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.EMAIL_PROVIDER = 'console';
    process.env.NOTIFICATIONS_WORKER = '0';

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
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;
    db = app.get(DatabaseService);

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

  async function cartWithLineAndEmail(email: string) {
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

    await request(server)
      .patch(`/v1/carts/${cartId}/email`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({ email })
      .expect(200);

    return { cartId, guestToken };
  }

  it.skipIf(!hasDb)('admin notification settings get/patch', async () => {
    const get = await request(server)
      .get('/v1/admin/notifications/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(get.body.orderPlacedCustomer).toBe(true);
    expect(get.body.abandonedCartEnabled).toBe(true);

    const patched = await request(server)
      .patch('/v1/admin/notifications/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        abandonedCartEnabled: true,
        abandonedCartIdleMinutes: 0,
        merchantAlertEmail: 'owner@demo.localhost',
      })
      .expect(200);

    expect(patched.body.abandonedCartIdleMinutes).toBe(0);
    expect(patched.body.merchantAlertEmail).toBe('owner@demo.localhost');
  });

  it.skipIf(!hasDb)('checkout enqueues order placed + merchant alert', async () => {
    const suffix = Date.now().toString(36);
    const { cartId, guestToken } = await cartWithLineAndEmail(
      `placed-${suffix}@example.com`,
    );

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: `placed-${suffix}@example.com`,
        paymentMethod: 'cod',
        shippingAddress: {
          line1: '1 Test St',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(201);

    const orderId = checkout.body.order.id as string;
    const demoTenant = '00000000-0000-4000-8000-000000000001';

    const outbox = await db.withTenant(demoTenant, async (client) =>
      client.query<{ template_id: string; to_email: string; status: string }>(
        `SELECT template_id, to_email, status
         FROM notification_outbox
         WHERE idempotency_key LIKE $1
         ORDER BY template_id`,
        [`order:${orderId}:%`],
      ),
    );

    const templates = outbox.rows.map((r) => r.template_id).sort();
    expect(templates).toContain('order_placed');
    expect(templates).toContain('order_placed_merchant');
    expect(outbox.rows.every((r) => r.status === 'sent')).toBe(true);
  });

  it.skipIf(!hasDb)('ship / cancel enqueue customer lifecycle mail', async () => {
    const suffix = Date.now().toString(36);
    const { cartId, guestToken } = await cartWithLineAndEmail(
      `ship-${suffix}@example.com`,
    );

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: `ship-${suffix}@example.com`,
        paymentMethod: 'cod',
        shippingAddress: {
          line1: '2 Test St',
          city: 'Lahore',
          country: 'PK',
        },
      })
      .expect(201);

    const orderId = checkout.body.order.id as string;

    await request(server)
      .patch(`/v1/admin/orders/${orderId}/status`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'shipped' })
      .expect(200);

    const demoTenant = '00000000-0000-4000-8000-000000000001';
    const shipped = await db.withTenant(demoTenant, async (client) =>
      client.query<{ template_id: string; status: string }>(
        `SELECT template_id, status FROM notification_outbox
         WHERE idempotency_key = $1`,
        [`order:${orderId}:shipped:customer`],
      ),
    );
    expect(shipped.rows[0]?.template_id).toBe('order_shipped');
    expect(shipped.rows[0]?.status).toBe('sent');
  });

  it.skipIf(!hasDb)('abandoned cart reminder when enabled + idle', async () => {
    const suffix = Date.now().toString(36);
    const email = `abandon-${suffix}@example.com`;
    const { cartId } = await cartWithLineAndEmail(email);

    await request(server)
      .patch('/v1/admin/notifications/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ abandonedCartEnabled: true, abandonedCartIdleMinutes: 0 })
      .expect(200);

    const processed = await request(server)
      .post('/v1/admin/notifications/process')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    expect(processed.body.abandonedQueued).toBeGreaterThanOrEqual(1);

    const demoTenant = '00000000-0000-4000-8000-000000000001';
    const run = await db.withTenant(demoTenant, async (client) =>
      client.query<{ status: string }>(
        `SELECT status FROM abandoned_cart_runs
         WHERE cart_id = $1 AND step = 1`,
        [cartId],
      ),
    );
    expect(run.rows[0]?.status).toBe('sent');

    const mail = await db.withTenant(demoTenant, async (client) =>
      client.query<{ template_id: string; status: string }>(
        `SELECT template_id, status FROM notification_outbox
         WHERE idempotency_key LIKE $1`,
        [`%:${cartId}:1`],
      ),
    );
    expect(mail.rows[0]?.template_id).toBe('abandoned_cart_step');
    expect(mail.rows[0]?.status).toBe('sent');

    // Idempotent — second process should not re-queue same cart
    const again = await request(server)
      .post('/v1/admin/notifications/process')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(again.body.abandonedQueued).toBe(0);
  });
});
