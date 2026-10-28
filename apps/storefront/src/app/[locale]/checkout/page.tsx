import { CheckoutForm } from '../../../components/CheckoutForm';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CheckoutForm locale={locale} />;
}
