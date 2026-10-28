import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';
import { DatabaseService } from '../src/db/database.service';

const DEMO_HOST = 'demo.localhost';
const DEMO_TENANT = '00000000-0000-4000-8000-000000000001';
const STARTER_PLAN = '10000000-0000-4000-8000-000000000001';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('SaaS plan metering', () => {
  let app: INestApplication;
  let server: Server;
  let db: DatabaseService;
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
        validateAddress: async () => ({
          valid: true,
          warnings: [],
          normalized: {
            line1: '1 Test St',
            city: 'Karachi',
            country: 'PK',
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
    if (hasDb && db) {
      await db.query(
        `UPDATE plan_entitlements SET value = '100'
         WHERE plan_id = $1 AND key = 'max_products'`,
        [STARTER_PLAN],
      );
      await db.query(
        `UPDATE plan_entitlements SET value = '50'
         WHERE plan_id = $1 AND key = 'soft_max_orders_month'`,
        [STARTER_PLAN],
      );
      await db.query(
        `UPDATE tenants SET plan_id = $1 WHERE id = $2`,
        [STARTER_PLAN, DEMO_TENANT],
      );
    }
    await app.close();
  });

  it.skipIf(!hasDb)('returns usage snapshot + plan catalog for staff', async () => {
    expect(staffToken).toBeTruthy();

    const usage = await request(server)
      .get('/v1/admin/billing/usage')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(usage.body.plan.code).toBe('starter');
    expect(usage.body.meters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'products', enforcement: 'hard' }),
        expect.objectContaining({ metric: 'staff', enforcement: 'hard' }),
        expect.objectContaining({ metric: 'locales', enforcement: 'hard' }),
        expect.objectContaining({
          metric: 'orders_month',
          enforcement: 'soft',
        }),
      ]),
    );

    const plans = await request(server)
      .get('/v1/admin/billing/plans')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(plans.body.map((p: { code: string }) => p.code)).toEqual(
      expect.arrayContaining(['starter', 'growth', 'advanced']),
    );
  });

  it.skipIf(!hasDb)('hard-blocks extra language on Starter (max 1)', async () => {
    const res = await request(server)
      .post('/v1/admin/billing/locales')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ locale: 'fr' })
      .expect(402);

    expect(res.body.code).toBe('upgrade_required');
    expect(res.body.metric).toBe('locales');
    expect(res.body.suggestedPlanCode).toBe('growth');
  });

  it.skipIf(!hasDb)('hard-blocks staff invite past seat cap', async () => {
    // Starter max_staff=2; demo already has owner. Fill the last seat, then block.
    const fill = await request(server)
      .post('/v1/admin/billing/staff')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: `seat2-${suffix}@demo.localhost`,
        password: 'TempPass123!',
        displayName: 'Seat Two',
      });

    if (fill.status === 201 || fill.status === 200) {
      // filled to cap
    } else if (fill.status === 402) {
      // already at cap from prior runs
      expect(fill.body.code).toBe('upgrade_required');
      return;
    } else if (fill.status === 400 && /already/i.test(fill.body.message ?? '')) {
      // seat already filled
    } else {
      expect([200, 201, 402]).toContain(fill.status);
    }

    const blocked = await request(server)
      .post('/v1/admin/billing/staff')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: `seat-block-${suffix}@demo.localhost`,
        password: 'TempPass123!',
      })
      .expect(402);

    expect(blocked.body.code).toBe('upgrade_required');
    expect(blocked.body.metric).toBe('staff');
  });

  it.skipIf(!hasDb)('hard-blocks product create when at product cap', async () => {
    const countRes = await db.withTenant(DEMO_TENANT, async (client) => {
      const r = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM products WHERE status <> 'archived'`,
      );
      return Number(r.rows[0]?.n ?? 0);
    });

    await db.query(
      `UPDATE plan_entitlements SET value = $1
       WHERE plan_id = $2 AND key = 'max_products'`,
      [String(countRes), STARTER_PLAN],
    );

    try {
      const res = await request(server)
        .post('/v1/admin/catalog/products')
        .set('Host', DEMO_HOST)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          title: `Blocked ${suffix}`,
          slug: `blocked-${suffix}`,
          status: 'active',
          variants: [
            {
              title: 'Default',
              sku: `BLK-${suffix}`,
              unitAmountMinor: 100,
            },
          ],
        })
        .expect(402);

      expect(res.body.code).toBe('upgrade_required');
      expect(res.body.metric).toBe('products');
    } finally {
      await db.query(
        `UPDATE plan_entitlements SET value = '100'
         WHERE plan_id = $1 AND key = 'max_products'`,
        [STARTER_PLAN],
      );
    }
  });

  it.skipIf(!hasDb)('Stripe Billing checkout/portal stubs return URLs', async () => {
    const checkout = await request(server)
      .post('/v1/admin/billing/stripe/checkout')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        planCode: 'growth',
        successUrl: 'http://localhost:3002/plans?ok=1',
        cancelUrl: 'http://localhost:3002/plans?cancel=1',
      })
      .expect(201);

    expect(checkout.body.provider).toBe('stripe_billing');
    expect(checkout.body.status).toBe('stub');
    expect(checkout.body.url).toContain('billing=stub');

    const portal = await request(server)
      .post('/v1/admin/billing/stripe/portal')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ returnUrl: 'http://localhost:3002/plans' })
      .expect(201);

    expect(portal.body.provider).toBe('stripe_billing');
    expect(portal.body.url).toContain('billing=portal_stub');
  });

  it.skipIf(!hasDb)('change-plan upgrades entitlements locally', async () => {
    const upgraded = await request(server)
      .post('/v1/admin/billing/change-plan')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ planCode: 'growth' })
      .expect(201);

    expect(upgraded.body.plan.code).toBe('growth');
    expect(upgraded.body.plan.entitlements.max_locales).toBe('3');

    // Growth allows a second language
    const locale = await request(server)
      .post('/v1/admin/billing/locales')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ locale: 'ur' })
      .expect(201);

    expect(locale.body.locale).toBe('ur');
    expect(locale.body.enabled).toBe(true);

    // Restore starter + disable extra locale for other tests
    await request(server)
      .delete('/v1/admin/billing/locales/ur')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    await request(server)
      .post('/v1/admin/billing/change-plan')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ planCode: 'starter' })
      .expect(201);
  });

  it.skipIf(!hasDb)('soft order limit warns but still places order', async () => {
    await db.query(
      `UPDATE plan_entitlements SET value = '0'
       WHERE plan_id = $1 AND key = 'soft_max_orders_month'`,
      [STARTER_PLAN],
    );

    try {
      const products = await request(server)
        .get('/v1/catalog/products')
        .set('Host', DEMO_HOST)
        .expect(200);
      const variantId = products.body[0]?.variants?.[0]?.id as string;
      expect(variantId).toBeTruthy();

      const cart = await request(server)
        .post('/v1/carts')
        .set('Host', DEMO_HOST)
        .send({})
        .expect(201);

      await request(server)
        .post(`/v1/carts/${cart.body.id}/lines`)
        .set('Host', DEMO_HOST)
        .set('X-Cart-Token', cart.body.guestToken)
        .send({ variantId, quantity: 1 })
        .expect(201);

      const checkout = await request(server)
        .post('/v1/checkout/sessions')
        .set('Host', DEMO_HOST)
        .set('X-Cart-Token', cart.body.guestToken)
        .send({
          cartId: cart.body.id,
          email: `soft-${suffix}@example.com`,
          paymentMethod: 'cod',
          shippingMethodId: '40000000-0000-4000-8000-000000000001',
          shippingAddress: {
            line1: '1 Soft Limit St',
            city: 'Karachi',
            country: 'PK',
          },
        })
        .expect(201);

      expect(checkout.body.order.id).toBeTruthy();
      expect(checkout.body.planSoftWarning).toEqual(
        expect.objectContaining({
          metric: 'orders_month',
          limit: 0,
        }),
      );
    } finally {
      await db.query(
        `UPDATE plan_entitlements SET value = '50'
         WHERE plan_id = $1 AND key = 'soft_max_orders_month'`,
        [STARTER_PLAN],
      );
    }
  });
});
