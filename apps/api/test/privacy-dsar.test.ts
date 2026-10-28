import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const DEMO_VARIANT = '30000000-0000-4000-8000-000000000001';
const DEMO_STANDARD_SHIP = '40000000-0000-4000-8000-000000000001';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('privacy consent + DSAR', () => {
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

  it.skipIf(!hasDb)('exposes storefront privacy config for demo', async () => {
    const res = await request(server)
      .get('/v1/privacy/config')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(res.body.cookieBannerEnabled).toBe(true);
    expect(res.body.analyticsCategoryEnabled).toBe(true);
    expect(res.body.marketingCategoryEnabled).toBe(true);
    expect(res.body.privacyContactEmail).toBe('privacy@demo.localhost');
  });

  it.skipIf(!hasDb)('other tenant has marketing category disabled', async () => {
    const res = await request(server)
      .get('/v1/privacy/config')
      .set('Host', OTHER_HOST)
      .expect(200);

    expect(res.body.marketingCategoryEnabled).toBe(false);
    expect(res.body.analyticsCategoryEnabled).toBe(true);
  });

  it.skipIf(!hasDb)('staff can read and patch privacy settings', async () => {
    expect(staffToken).toBeTruthy();

    const before = await request(server)
      .get('/v1/admin/privacy/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(before.body.dpaAcknowledged).toBe(true);
    expect(before.body.retentionDays).toBe(730);

    const patched = await request(server)
      .patch('/v1/admin/privacy/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        retentionDays: 365,
        cookieBannerLayout: 'modal',
        privacyContactEmail: 'privacy@demo.localhost',
      })
      .expect(200);

    expect(patched.body.retentionDays).toBe(365);
    expect(patched.body.cookieBannerLayout).toBe('modal');

    // restore demo defaults
    await request(server)
      .patch('/v1/admin/privacy/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        retentionDays: 730,
        cookieBannerLayout: 'bottom',
      })
      .expect(200);
  });

  it.skipIf(!hasDb)('records consent events', async () => {
    const subjectKey = `testsubj${suffix}abcdef12`;
    const res = await request(server)
      .post('/v1/privacy/consent')
      .set('Host', DEMO_HOST)
      .send({
        subjectKey,
        analytics: true,
        marketing: false,
        source: 'banner',
      })
      .expect(201);

    expect(res.body.categories.necessary).toBe(true);
    expect(res.body.categories.analytics).toBe(true);
    expect(res.body.categories.marketing).toBe(false);
    expect(res.body.subjectKey).toBe(subjectKey);
  });

  it.skipIf(!hasDb)('customer export + delete DSAR', async () => {
    const email = `privacy-${suffix}@example.com`;
    const password = 'PrivacyTest123!';

    const reg = await request(server)
      .post('/v1/auth/customer/register')
      .set('Host', DEMO_HOST)
      .send({ email, password, displayName: 'Privacy Tester' })
      .expect(201);

    const token = reg.body.token as string;

    const cart = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    await request(server)
      .post(`/v1/carts/${cart.body.id}/lines`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({ variantId: DEMO_VARIANT, quantity: 1 })
      .expect(201);

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({
        cartId: cart.body.id,
        email,
        paymentMethod: 'cod',
        shippingMethodId: DEMO_STANDARD_SHIP,
        shippingAddress: {
          line1: '1 Privacy Lane',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(201);

    const exported = await request(server)
      .post('/v1/privacy/account/dsar/export')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(exported.body.requestType).toBe('export');
    expect(exported.body.status).toBe('completed');
    expect(exported.body.hasArtifact).toBe(true);
    expect(exported.body.artifact.profile.email).toBe(email);
    expect(exported.body.artifact.orders.length).toBeGreaterThanOrEqual(1);

    const deleted = await request(server)
      .post('/v1/privacy/account/dsar/delete')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({ password })
      .expect(201);

    expect(deleted.body.requestType).toBe('delete');
    expect(deleted.body.status).toBe('completed');
    expect(deleted.body.artifact.customersUpdated).toBe(1);

    const inbox = await request(server)
      .get('/v1/admin/privacy/dsar')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(
      inbox.body.some(
        (r: { subjectEmail: string; requestType: string }) =>
          r.subjectEmail === email && r.requestType === 'export',
      ),
    ).toBe(true);
  });

  it.skipIf(!hasDb)('guest DSAR export via order access token', async () => {
    const email = `guest-privacy-${suffix}@example.com`;

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
          line1: '9 Guest Ave',
          city: 'Lahore',
          country: 'PK',
        },
      })
      .expect(201);

    const accessToken = checkout.body.order.accessToken as string;

    const exported = await request(server)
      .post('/v1/privacy/dsar/guest')
      .set('Host', DEMO_HOST)
      .send({
        requestType: 'export',
        email,
        orderAccessToken: accessToken,
      })
      .expect(201);

    expect(exported.body.subjectKind).toBe('guest');
    expect(exported.body.status).toBe('completed');
    expect(exported.body.artifact.orders.length).toBeGreaterThanOrEqual(1);

    const wiped = await request(server)
      .post('/v1/privacy/dsar/guest')
      .set('Host', DEMO_HOST)
      .send({
        requestType: 'delete',
        email,
        orderAccessToken: accessToken,
      })
      .expect(201);

    expect(wiped.body.status).toBe('completed');
    expect(wiped.body.artifact.ordersUpdated).toBeGreaterThanOrEqual(1);
  });
});
