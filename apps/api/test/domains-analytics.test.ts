import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';

const DEMO_HOST = 'demo.localhost';
const OTHER_HOST = 'other.localhost';
const hasDb = Boolean(process.env.DATABASE_URL ?? true);

describe('Custom domains + analytics ingest', () => {
  let app: INestApplication;
  let server: Server;
  let staffToken = '';
  let otherStaffToken = '';
  const customHost = `shop-${Date.now()}.example.com`;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.PLATFORM_CNAME_TARGET ??= 'edge.ecom.digitli.local';

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

      // other tenant may not have staff seed — skip if login fails
      const otherLogin = await request(server)
        .post('/v1/auth/staff/login')
        .set('Host', OTHER_HOST)
        .send({ email: 'owner@demo.localhost', password: 'DemoOwner123!' });
      if (otherLogin.status === 201 || otherLogin.status === 200) {
        otherStaffToken = otherLogin.body.token as string;
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.skipIf(!hasDb)('staff lists domains with CNAME instructions', async () => {
    expect(staffToken).toBeTruthy();

    const res = await request(server)
      .get('/v1/admin/domains')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.cname.cnameTarget).toBe('edge.ecom.digitli.local');
    expect(Array.isArray(res.body.cname.notes)).toBe(true);
    expect(res.body.domains.length).toBeGreaterThanOrEqual(1);
    const hosts = res.body.domains.map((d: { host: string }) => d.host);
    expect(hosts).toContain('demo.localhost');
  });

  it.skipIf(!hasDb)('staff can add, verify, and remove a custom domain', async () => {
    expect(staffToken).toBeTruthy();

    const added = await request(server)
      .post('/v1/admin/domains')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ host: customHost })
      .expect(201);

    expect(added.body.host).toBe(customHost);
    expect(added.body.verificationStatus).toBe('pending');
    expect(added.body.sslStatus).toBe('pending');

    const verified = await request(server)
      .post(`/v1/admin/domains/${added.body.id}/verify`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({})
      .expect(201);

    expect(verified.body.verificationStatus).toBe('verified');
    expect(verified.body.verifiedAt).toBeTruthy();

    await request(server)
      .delete(`/v1/admin/domains/${added.body.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(204);

    const after = await request(server)
      .get('/v1/admin/domains')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const hosts = after.body.domains.map((d: { host: string }) => d.host);
    expect(hosts).not.toContain(customHost);
  });

  it.skipIf(!hasDb)('rejects removing platform seed hosts', async () => {
    expect(staffToken).toBeTruthy();

    const list = await request(server)
      .get('/v1/admin/domains')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const demo = list.body.domains.find(
      (d: { host: string }) => d.host === 'demo.localhost',
    );
    expect(demo).toBeTruthy();

    await request(server)
      .delete(`/v1/admin/domains/${demo.id}`)
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400);
  });

  it.skipIf(!hasDb)('ingests analytics events and returns admin summary', async () => {
    const created = await request(server)
      .post('/v1/analytics/events')
      .set('Host', DEMO_HOST)
      .send({
        eventName: 'page_view',
        path: '/en',
        sessionId: 'sess-test-1',
        properties: { locale: 'en' },
      })
      .expect(201);

    expect(created.body.eventName).toBe('page_view');
    expect(created.body.path).toBe('/en');

    await request(server)
      .post('/v1/analytics/events')
      .set('Host', DEMO_HOST)
      .send({ eventName: 'add_to_cart', path: '/en/cart' })
      .expect(201);

    expect(staffToken).toBeTruthy();
    const summary = await request(server)
      .get('/v1/admin/analytics/summary')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(summary.body.stub).toBe(true);
    expect(summary.body.totalEvents).toBeGreaterThanOrEqual(2);
    const names = summary.body.byEventName.map(
      (r: { eventName: string }) => r.eventName,
    );
    expect(names).toContain('page_view');
  });

  it.skipIf(!hasDb)('rejects unknown analytics event names', async () => {
    await request(server)
      .post('/v1/analytics/events')
      .set('Host', DEMO_HOST)
      .send({ eventName: 'not_a_real_event' })
      .expect(400);
  });

  it.skipIf(!hasDb)('analytics summary is tenant-isolated', async () => {
    await request(server)
      .post('/v1/analytics/events')
      .set('Host', OTHER_HOST)
      .send({ eventName: 'page_view', path: '/other-only' })
      .expect(201);

    expect(staffToken).toBeTruthy();
    const demoSummary = await request(server)
      .get('/v1/admin/analytics/summary')
      .set('Host', DEMO_HOST)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const leaked = demoSummary.body.recent.some(
      (e: { path: string | null }) => e.path === '/other-only',
    );
    expect(leaked).toBe(false);

    // If other tenant has no staff user, isolation still holds via RLS on ingest.
    void otherStaffToken;
  });
});
