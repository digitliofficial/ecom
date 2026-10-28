import { CartView } from '../../../components/CartView';

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CartView locale={locale} />;
}
