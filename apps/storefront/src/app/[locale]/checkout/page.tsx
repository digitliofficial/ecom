import { t } from '@ecom/i18n-messages';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
      <h1>{t(locale, 'checkout.title')}</h1>
      <form style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t(locale, 'checkout.email')}</span>
          <input
            name="email"
            type="email"
            placeholder="guest@example.com"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 4, border: '1px solid #3a4a5c' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Shipping address</span>
          <textarea
            name="address"
            rows={3}
            placeholder="Line 1, city, country"
            style={{ padding: '0.6rem 0.75rem', borderRadius: 4, border: '1px solid #3a4a5c' }}
          />
        </label>
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          Stops before PaymentIntent (NoopAdapter). Address validation via compute in slice.
        </p>
      </form>
    </section>
  );
}
