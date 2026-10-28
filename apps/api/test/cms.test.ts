import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('CMS — menus, SEO, theme, policies', () => {
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

  it.skipIf(!hasDb)('storefront bootstrap returns demo CMS defaults', async () => {
    const res = await request(server)
      .get('/v1/cms/bootstrap?locale=en')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(res.body.theme.themePackId).toBe('default');
    expect(res.body.theme.resolved.colors.accent).toBeTruthy();
    expect(res.body.seo.siteTitle).toMatch(/demo/i);
    expect(res.body.menus.header.items.length).toBeGreaterThan(0);
    expect(res.body.menus.footer.items.some((i: { href: string }) =>
      i.href.includes('/policies/'),
    )).toBe(true);
    expect(res.body.policies.map((p: { kind: string }) => p.kind)).toEqual(
      expect.arrayContaining(['privacy', 'refund', 'terms', 'shipping', 'cookie']),
    );
  });

  it.skipIf(!hasDb)('other tenant bootstrap is isolated', async () => {
    const res = await request(server)
      .get('/v1/cms/bootstrap')
      .set('Host', OTHER_HOST)
      .expect(200);

    expect(res.body.theme.themePackId).toBe('daylight');
    expect(res.body.seo.siteTitle).toBe('Other store');
    expect(res.body.menus.footer.items).toHaveLength(1);
  });

  it.skipIf(!hasDb)('storefront policy page returns seeded privacy copy', async () => {
    const res = await request(server)
      .get('/v1/cms/policies/privacy')
      .set('Host', DEMO_HOST)
      .expect(200);

    expect(res.body.kind).toBe('privacy');
    expect(res.body.title).toMatch(/privacy/i);
    expect(res.body.body.length).toBeGreaterThan(20);
  });

  it.skipIf(!hasDb)('staff can patch theme pack and SEO', async () => {
    expect(staffToken).toBeTruthy();

    const packs = await request(server)
      .get('/v1/admin/cms/theme-packs')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(packs.body.map((p: { id: string }) => p.id)).toEqual(
      expect.arrayContaining(['default', 'daylight', 'midnight']),
    );

    const theme = await request(server)
      .patch('/v1/admin/cms/theme')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ themePackId: 'midnight' })
      .expect(200);

    expect(theme.body.themePackId).toBe('midnight');
    expect(theme.body.resolved.id).toBe('midnight');

    const seo = await request(server)
      .patch('/v1/admin/cms/seo')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        locale: 'en',
        siteTitle: 'Demo CMS Title',
        metaDescription: 'Updated SEO description for tests.',
      })
      .expect(200);

    expect(seo.body.siteTitle).toBe('Demo CMS Title');

    // restore defaults for other tests / local demos
    await request(server)
      .patch('/v1/admin/cms/theme')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ themePackId: 'default' })
      .expect(200);

    await request(server)
      .patch('/v1/admin/cms/seo')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        locale: 'en',
        siteTitle: 'ecom · demo',
        metaDescription:
          'Demo multi-tenant storefront — guest checkout, COD, and bank transfer.',
      })
      .expect(200);
  });

  it.skipIf(!hasDb)('staff can replace header menu and patch a policy', async () => {
    expect(staffToken).toBeTruthy();

    const menu = await request(server)
      .put('/v1/admin/cms/menus/header')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Header',
        items: [
          { label: 'Home', href: '/en', position: 0 },
          { label: 'Cart', href: '/en/cart', position: 1 },
          { label: 'Terms', href: '/en/policies/terms', position: 2 },
        ],
      })
      .expect(200);

    expect(menu.body.items).toHaveLength(3);
    expect(menu.body.items[2].label).toBe('Terms');

    const policy = await request(server)
      .patch('/v1/admin/cms/policies/terms')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Terms of service',
        body: 'Updated terms body for CMS tests.',
      })
      .expect(200);

    expect(policy.body.body).toContain('Updated terms body');

    // restore header + terms
    await request(server)
      .put('/v1/admin/cms/menus/header')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Header',
        items: [
          { label: 'Home', href: '/en', position: 0 },
          { label: 'Cart', href: '/en/cart', position: 1 },
        ],
      })
      .expect(200);

    await request(server)
      .patch('/v1/admin/cms/policies/terms')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Terms of service',
        body: 'By placing an order you agree to provide accurate contact and shipping details.\n\nPrices and availability may change. Offline payments (COD / bank transfer) remain pending until the merchant confirms receipt.',
      })
      .expect(200);
  });

  it.skipIf(!hasDb)('rejects unknown theme pack', async () => {
    expect(staffToken).toBeTruthy();
    await request(server)
      .patch('/v1/admin/cms/theme')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ themePackId: 'not-a-pack' })
      .expect(400);
  });
});
