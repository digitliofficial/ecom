import Link from 'next/link';
import { Button } from '@ecom/ui';
import { t } from '@ecom/i18n-messages';

export default async function StoreHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <section style={{ maxWidth: 720, paddingTop: '4rem' }}>
      <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>demo.localhost</p>
      <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: '0 0 1rem', fontWeight: 500 }}>
        ecom
      </h1>
      <p style={{ fontSize: '1.15rem', maxWidth: 420, lineHeight: 1.5, opacity: 0.9 }}>
        Phase 0 storefront skeleton — locale routes, cart and checkout shells for the guest
        checkout vertical slice.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        <Link href={`/${locale}/cart`}>
          <Button
            style={{
              background: '#3d8bfd',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.25rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            {t(locale, 'cart.title')}
          </Button>
        </Link>
        <Link href={`/${locale}/checkout`} style={{ color: '#9ec1ff', alignSelf: 'center' }}>
          {t(locale, 'checkout.title')}
        </Link>
      </div>
    </section>
  );
}
