import Link from 'next/link';
import { t } from '@ecom/i18n-messages';

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
      <h1>{t(locale, 'cart.title')}</h1>
      <p style={{ opacity: 0.8 }}>Empty cart skeleton — lines land in the vertical slice.</p>
      <Link href={`/${locale}/checkout`} style={{ color: '#9ec1ff' }}>
        Continue to checkout
      </Link>
    </section>
  );
}
