import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { ComputeClientService } from '../src/common/compute.client';

const DEMO_HOST = 'demo.localhost';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('auth', () => {
  let app: INestApplication;
  let server: Server;
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
          normalized: {},
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it.skipIf(!hasDb)('rejects invalid staff login', async () => {
    await request(server)
      .post('/v1/auth/staff/login')
      .set('Host', DEMO_HOST)
      .send({ email: 'owner@demo.localhost', password: 'wrong-password' })
      .expect(401);
  });

  it.skipIf(!hasDb)('staff login sets cookie and protects admin catalog', async () => {
    const login = await request(server)
      .post('/v1/auth/staff/login')
      .set('Host', DEMO_HOST)
      .send({ email: 'owner@demo.localhost', password: 'DemoOwner123!' })
      .expect(201);

    expect(login.body.user.email).toBe('owner@demo.localhost');
    expect(login.body.user.kind).toBe('staff');
    expect(login.body.token).toBeTruthy();
    expect(login.headers['set-cookie']?.join(';')).toContain(
      'ecom_staff_session=',
    );

    await request(server)
      .get('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .expect(401);

    await request(server)
      .get('/v1/admin/catalog/products')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    const me = await request(server)
      .get('/v1/auth/me')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.email).toBe('owner@demo.localhost');

    const logout = await request(server)
      .post('/v1/auth/staff/logout')
      .set('Host', DEMO_HOST)
      .expect(201);
    expect(logout.headers['set-cookie']?.join(';')).toMatch(
      /ecom_staff_session=;/,
    );
  });

  it.skipIf(!hasDb)('customer register + login links guest cart', async () => {
    const cart = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({ locale: 'en', currency: 'USD' })
      .expect(201);

    const email = `shopper-${suffix}@example.com`;
    const password = 'ShopperPass1!';

    const registered = await request(server)
      .post('/v1/auth/customer/register')
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .send({ email, password, displayName: 'Shopper' })
      .expect(201);

    expect(registered.body.user.kind).toBe('customer');
    expect(registered.body.user.email).toBe(email);
    expect(registered.headers['set-cookie']?.join(';')).toContain(
      'ecom_customer_session=',
    );

    const linked = await request(server)
      .get(`/v1/carts/${cart.body.id}`)
      .set('Host', DEMO_HOST)
      .set('X-Cart-Token', cart.body.guestToken)
      .expect(200);
    expect(linked.body.customerId).toBe(registered.body.user.id);

    await request(server)
      .post('/v1/auth/customer/logout')
      .set('Host', DEMO_HOST)
      .expect(201);

    const login = await request(server)
      .post('/v1/auth/customer/login')
      .set('Host', DEMO_HOST)
      .send({ email, password })
      .expect(201);
    expect(login.body.user.id).toBe(registered.body.user.id);

    await request(server)
      .post('/v1/auth/customer/register')
      .set('Host', DEMO_HOST)
      .send({ email, password })
      .expect(409);
  });

  it.skipIf(!hasDb)('seeded demo customer can login', async () => {
    const login = await request(server)
      .post('/v1/auth/customer/login')
      .set('Host', DEMO_HOST)
      .send({
        email: 'customer@demo.localhost',
        password: 'DemoCustomer123!',
      })
      .expect(201);
    expect(login.body.user.email).toBe('customer@demo.localhost');
  });
});
