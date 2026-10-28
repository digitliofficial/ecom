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
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('COD + bank transfer payments', () => {
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

  async function cartWithLine() {
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

    return { cartId, guestToken };
  }

  it.skipIf(!hasDb)('lists enabled storefront methods for demo', async () => {
    const res = await request(server)
      .get('/v1/payments/methods')
      .set('Host', DEMO_HOST)
      .expect(200);

    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toContain('cod');
    expect(ids).toContain('bank_transfer');
    const bank = res.body.find((m: { id: string }) => m.id === 'bank_transfer');
    expect(bank.bankDetails.accountNumber).toBeTruthy();
    expect(bank.bankDetails.bankName).toBeTruthy();
  });

  it.skipIf(!hasDb)('other tenant only exposes COD', async () => {
    const res = await request(server)
      .get('/v1/payments/methods')
      .set('Host', OTHER_HOST)
      .expect(200);

    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toEqual(['cod']);
  });

  it.skipIf(!hasDb)('staff can read and patch payment settings', async () => {
    expect(staffToken).toBeTruthy();

    const before = await request(server)
      .get('/v1/admin/payments/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(before.body.codEnabled).toBe(true);
    expect(before.body.stripeEnabled).toBe(false);

    const patched = await request(server)
      .patch('/v1/admin/payments/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        codEnabled: true,
        bankTransferEnabled: true,
        bankAccountName: 'Demo Merchant PK',
        bankAccountNumber: 'PK36SCBL0000001123456702',
        bankName: 'Demo Bank Pakistan',
        stripeEnabled: false,
      })
      .expect(200);

    expect(patched.body.bankName).toBe('Demo Bank Pakistan');
    expect(patched.body.stripeEnabled).toBe(false);
  });

  it.skipIf(!hasDb)('rejects enabling bank transfer without details', async () => {
    expect(staffToken).toBeTruthy();

    await request(server)
      .patch('/v1/admin/payments/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        bankTransferEnabled: true,
        bankAccountName: '',
        bankAccountNumber: '',
        bankName: '',
      })
      .expect(400);
  });

  it.skipIf(!hasDb)('COD checkout → pending_cod + payment_method persisted', async () => {
    const { cartId, guestToken } = await cartWithLine();

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'cod-guest@example.com',
        paymentMethod: 'cod',
        shippingAddress: {
          line1: '12 Clifton',
          city: 'Karachi',
          country: 'PK',
          postalCode: '75500',
        },
      })
      .expect(201);

    expect(checkout.body.order.paymentMethod).toBe('cod');
    expect(checkout.body.order.paymentStatus).toBe('pending_cod');
    expect(checkout.body.payment.provider).toBe('cod');
    expect(checkout.body.bankTransferInstructions).toBeNull();

    const detail = await request(server)
      .get(`/v1/admin/orders/${checkout.body.order.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(detail.body.paymentMethod).toBe('cod');
    expect(detail.body.paymentStatus).toBe('pending_cod');
  });

  it.skipIf(!hasDb)(
    'bank transfer checkout → pending_transfer + instructions',
    async () => {
      const { cartId, guestToken } = await cartWithLine();

      const checkout = await request(server)
        .post('/v1/checkout/sessions')
        .set('Host', DEMO_HOST)
        .set('X-Cart-Token', guestToken)
        .send({
          cartId,
          email: 'transfer-guest@example.com',
          paymentMethod: 'bank_transfer',
          shippingAddress: {
            line1: '45 Gulberg',
            city: 'Lahore',
            country: 'PK',
          },
        })
        .expect(201);

      expect(checkout.body.order.paymentMethod).toBe('bank_transfer');
      expect(checkout.body.order.paymentStatus).toBe('pending_transfer');
      expect(checkout.body.payment.provider).toBe('bank_transfer');
      expect(checkout.body.bankTransferInstructions).toMatchObject({
        accountName: 'Demo Merchant PK',
        accountNumber: 'PK36SCBL0000001123456702',
        bankName: 'Demo Bank Pakistan',
      });
    },
  );

  it.skipIf(!hasDb)('rejects missing or disabled payment method', async () => {
    const { cartId, guestToken } = await cartWithLine();

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'no-method@example.com',
        shippingAddress: {
          line1: '1 St',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(400);

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'stripe@example.com',
        paymentMethod: 'stripe_connect',
        shippingAddress: {
          line1: '1 St',
          city: 'Karachi',
          country: 'PK',
        },
      })
      .expect(400);

    // other tenant: bank_transfer disabled
    const otherCart = await request(server)
      .post('/v1/carts')
      .set('Host', OTHER_HOST)
      .send({})
      .expect(201);

    await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', OTHER_HOST)
      .set('X-Cart-Token', otherCart.body.guestToken)
      .send({
        cartId: otherCart.body.id,
        email: 'other@example.com',
        paymentMethod: 'bank_transfer',
        shippingAddress: {
          line1: '1 St',
          city: 'City',
          country: 'PK',
        },
      })
      .expect(400);
  });
});
