import Link from 'next/link';
import { MigrationPanel } from '../components/MigrationPanel';
import { listMigrationJobs, type MigrationJob } from '../lib/api';

export default async function PlatformHome() {
  let initialJobs: MigrationJob[] = [];
  let loadError: string | null = null;
  try {
    initialJobs = await listMigrationJobs('demo');
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 960 }}>
      <h1 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>ecom platform</h1>
      <p style={{ opacity: 0.85, lineHeight: 1.55, maxWidth: 640 }}>
        Ops dashboard — Shopify → SaaS import for anchor merchants, plus tenant
        domains / analytics pointers. Use <code>PLATFORM_API_KEY</code> via this
        UI or <code>pnpm migrate:shopify</code>. Merchant staff use the tenant
        admin for day-to-day domain DNS and analytics ingest review.
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.65rem' }}>Now</h2>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7, opacity: 0.9 }}>
          <li>
            Shopify import jobs — Admin API / CSV / fixtures (below)
          </li>
          <li>
            Custom domains — CNAME target{' '}
            <code style={{ fontSize: '0.9em' }}>PLATFORM_CNAME_TARGET</code>;
            merchant table under tenant admin <strong>/domains</strong>
          </li>
          <li>
            Analytics ingest —{' '}
            <code style={{ fontSize: '0.9em' }}>POST /v1/analytics/events</code>
            ; summary stub under tenant admin <strong>/analytics</strong>
          </li>
          <li>health: ok</li>
        </ul>
      </section>

      {loadError && (
        <p style={{ color: '#f88' }}>
          Could not load jobs (is Nest API up and <code>pnpm db:apply</code>{' '}
          including <code>16-migration.sql</code>?): {loadError}
        </p>
      )}

      <section style={{ marginTop: '1.75rem' }}>
        <MigrationPanel initialJobs={initialJobs} />
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.65rem' }}>Later</h2>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7, opacity: 0.75 }}>
          <li>Plans / metering / Stripe Billing</li>
          <li>Cross-tenant domain inventory + SSL job status</li>
          <li>DR drills and data residency controls</li>
        </ul>
      </section>

      <p style={{ marginTop: '2rem', opacity: 0.55, fontSize: '0.9rem' }}>
        Tenant admin (local):{' '}
        <Link href="http://localhost:3002" style={{ color: 'inherit' }}>
          localhost:3002
        </Link>
      </p>
    </main>
  );
}
