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

describe('guest checkout vertical slice', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ComputeClientService)
      .useValue({
        validateAddress: async (body: {
          line1: string;
          city: string;
          country: string;
          postalCode?: string;
        }) => ({
          valid: true,
          warnings: body.postalCode ? [] : ['postal_code_missing'],
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
  });

  afterAll(async () => {
    await app.close();
  });

  it.skipIf(!hasDb)('happy path: catalog → cart lines → checkout order placed', async () => {
    const products = await request(server)
      .get('/v1/catalog/products')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(products.body.length).toBeGreaterThanOrEqual(1);
    expect(products.body[0].variants[0].id).toBe(DEMO_VARIANT);

    const created = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    const cartId = created.body.id as string;
    const guestToken = created.body.guestToken as string;
    expect(guestToken).toBeTruthy();

    const withLine = await request(server)
      .post(`/v1/carts/${cartId}/lines`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({ variantId: DEMO_VARIANT, quantity: 2 })
      .expect(201);

    expect(withLine.body.lines).toHaveLength(1);
    expect(withLine.body.lines[0].quantity).toBe(2);
    expect(withLine.body.lines[0].unitAmountMinor).toBe(2500);

    const updated = await request(server)
      .patch(`/v1/carts/${cartId}/lines/${withLine.body.lines[0].id}`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({ quantity: 3 })
      .expect(200);

    expect(updated.body.lines[0].quantity).toBe(3);

    const checkout = await request(server)
      .post('/v1/checkout/sessions')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({
        cartId,
        email: 'guest@example.com',
        paymentMethod: 'cod',
        shippingMethodId: DEMO_STANDARD_SHIP,
        shippingAddress: {
          line1: ' 123 Demo St ',
          city: ' Austin ',
          region: 'TX',
          country: 'us',
        },
      })
      .expect(201);

    expect(checkout.body.order.status).toBe('placed');
    expect(checkout.body.order.paymentMethod).toBe('cod');
    expect(checkout.body.order.paymentStatus).toBe('pending_cod');
    // 3 × 2500 subtotal + 500 standard shipping
    expect(checkout.body.order.subtotalAmountMinor).toBe(7500);
    expect(checkout.body.order.shippingAmountMinor).toBe(500);
    expect(checkout.body.order.totalAmountMinor).toBe(8000);
    expect(checkout.body.payment.status).toBe('pending_cod');
    expect(checkout.body.payment.provider).toBe('cod');
    expect(checkout.body.bankTransferInstructions).toBeNull();
    expect(checkout.body.addressValidation.mode).toBe('soft_warn');
    expect(checkout.body.addressValidation.warnings).toContain(
      'postal_code_missing',
    );
    expect(checkout.body.addressValidation.normalized.country).toBe('US');
    expect(checkout.body.addressValidation.normalized.line1).toBe('123 Demo St');
  });

  it.skipIf(!hasDb)('tenant isolation: other tenant cannot read demo cart by UUID', async () => {
    const created = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({})
      .expect(201);

    const cartId = created.body.id as string;
    const guestToken = created.body.guestToken as string;

    await request(server)
      .post(`/v1/carts/${cartId}/lines`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', guestToken)
      .send({ variantId: DEMO_VARIANT, quantity: 1 })
      .expect(201);

    // Same UUID + guessed token under other tenant → not found (RLS + token)
    await request(server)
      .get(`/v1/carts/${cartId}`)
      .set('Host', OTHER_HOST)
      .set('X-Cart-Token', guestToken)
      .expect(404);

    // Catalog isolation
    const otherProducts = await request(server)
      .get('/v1/catalog/products')
      .set('Host', OTHER_HOST)
      .expect(200);

    const slugs = otherProducts.body.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain('other-shirt');
    expect(slugs).not.toContain('demo-mug');
  });

  it('rejects unknown tenant host', async () => {
    await request(server)
      .get('/v1/catalog/products')
      .set('Host', 'unknown.example')
      .expect(401);
  });
});
