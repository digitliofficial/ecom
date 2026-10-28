import { ProductDetail } from '../../../../components/ProductDetail';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return <ProductDetail locale={locale} slug={slug} />;
}
