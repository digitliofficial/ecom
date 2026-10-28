import Link from 'next/link';

export default function PlatformHome() {
  return (
    <main style={{ padding: '2rem', maxWidth: 640 }}>
      <h1 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>ecom platform</h1>
      <p style={{ opacity: 0.85, lineHeight: 1.55 }}>
        Ops dashboard stub — tenant domains, first-party analytics, plans, DR,
        and residency land here over time. Merchant staff use the tenant admin
        for day-to-day domain DNS and analytics ingest review.
      </p>

      <section style={{ marginTop: '1.75rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.65rem' }}>Now</h2>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7, opacity: 0.9 }}>
          <li>
            Custom domains — CNAME target{' '}
            <code style={{ fontSize: '0.9em' }}>PLATFORM_CNAME_TARGET</code>;
            merchant table under tenant admin <strong>/domains</strong>
          </li>
          <li>
            Analytics ingest — <code style={{ fontSize: '0.9em' }}>POST /v1/analytics/events</code>;
            summary stub under tenant admin <strong>/analytics</strong>
          </li>
          <li>health: ok</li>
        </ul>
      </section>

      <section style={{ marginTop: '1.75rem' }}>
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
