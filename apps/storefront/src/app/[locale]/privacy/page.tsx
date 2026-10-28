import { PrivacyDsarPanel } from '../../../components/PrivacyDsarPanel';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  void locale;

  return (
    <div style={{ maxWidth: 640, paddingTop: '0.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', letterSpacing: '-0.02em', marginTop: 0 }}>
        Privacy
      </h1>
      <p style={{ opacity: 0.85, lineHeight: 1.55, maxWidth: 520 }}>
        This demo store supports GDPR-style data subject requests: export your
        data or ask us to anonymize personal information on customer accounts and
        guest orders. Necessary cookies power cart and checkout; analytics and
        marketing stay off until you consent via the banner.
      </p>

      <section id="cookies" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>Cookies</h2>
        <ul style={{ opacity: 0.85, lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>
            <strong>Necessary</strong> — session, cart, locale/currency, CSRF
          </li>
          <li>
            <strong>Analytics</strong> — first-party measurement (off by default)
          </li>
          <li>
            <strong>Marketing</strong> — promotional tracking (off by default)
          </li>
        </ul>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <PrivacyDsarPanel />
      </section>
    </div>
  );
}
