import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('Localization settings + storefront config', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    process.env.JWT_SECRET ??= 'test-jwt-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it.skipIf(!hasDb)('storefront returns demo defaults with multi off', async () => {
    const res = await request(server)
      .get('/v1/localization')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(res.body.defaultLocale).toBe('en');
    expect(res.body.defaultCurrency).toBe('USD');
    expect(res.body.multiLanguage).toBe(false);
    expect(res.body.multiCurrency).toBe(false);
    expect(res.body.locales).toEqual(['en']);
    expect(res.body.currencies).toEqual(['USD']);
  });

  it.skipIf(!hasDb)('staff can enable multi-language and locales', async () => {
    expect(staffToken).toBeTruthy();

    // Starter hard-caps languages at 1 — bump to Growth for multi-locale exercise.
    await request(server)
      .post('/v1/admin/billing/change-plan')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ planCode: 'growth' })
      .expect(201);

    const before = await request(server)
      .get('/v1/admin/localization/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(before.body.defaultLocale).toBe('en');
    expect(before.body.availableLocales).toContain('ur');
    expect(before.body.maxLocales).toBeGreaterThanOrEqual(2);

    const patched = await request(server)
      .patch('/v1/admin/localization/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        multiLanguage: true,
        enabledLocales: ['en', 'ur'],
        multiCurrency: true,
        enabledCurrencies: ['USD', 'PKR'],
      })
      .expect(200);

    expect(patched.body.multiLanguage).toBe(true);
    expect(patched.body.multiCurrency).toBe(true);
    expect(patched.body.enabledLocales).toEqual(
      expect.arrayContaining(['en', 'ur']),
    );
    expect(patched.body.enabledCurrencies).toEqual(
      expect.arrayContaining(['USD', 'PKR']),
    );

    const storefront = await request(server)
      .get('/v1/localization')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(storefront.body.multiLanguage).toBe(true);
    expect(storefront.body.locales).toEqual(
      expect.arrayContaining(['en', 'ur']),
    );
    expect(storefront.body.currencies).toEqual(
      expect.arrayContaining(['USD', 'PKR']),
    );

    // Reset to defaults so other suites stay stable
    await request(server)
      .patch('/v1/admin/localization/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        multiLanguage: false,
        multiCurrency: false,
        enabledLocales: ['en'],
        enabledCurrencies: ['USD'],
        defaultLocale: 'en',
        defaultCurrency: 'USD',
      })
      .expect(200);

    await request(server)
      .post('/v1/admin/billing/change-plan')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ planCode: 'starter' })
      .expect(201);
  });

  it.skipIf(!hasDb)('rejects enabling more locales than plan cap', async () => {
    expect(staffToken).toBeTruthy();

    const settings = await request(server)
      .get('/v1/admin/localization/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const max = settings.body.maxLocales as number;
    const extra = (settings.body.availableLocales as string[]).slice(0, max + 1);
    if (extra.length <= max) {
      // Catalog smaller than cap — nothing to assert
      return;
    }

    const res = await request(server)
      .patch('/v1/admin/localization/settings')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        multiLanguage: true,
        enabledLocales: extra,
      })
      .expect(403);

    expect(res.body.message?.error ?? res.body.error).toBeDefined();
  });

  it.skipIf(!hasDb)('cart create uses tenant default currency when omitted', async () => {
    const created = await request(server)
      .post('/v1/carts')
      .set('Host', DEMO_HOST)
      .send({})
      .expect(201);

    expect(created.body.locale).toBe('en');
    expect(created.body.chargeCurrency).toBe('USD');
  });

  it.skipIf(!hasDb)('other tenant localization stays isolated', async () => {
    const res = await request(server)
      .get('/v1/localization')
      .set('Host', OTHER_HOST)
      .expect(200);

    expect(res.body.defaultLocale).toBe('en');
    expect(res.body.multiLanguage).toBe(false);
    expect(res.body.locales).toEqual(['en']);
  });
});
