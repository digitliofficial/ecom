import { ProductCatalog } from '../../components/ProductCatalog';

export default async function StoreHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ProductCatalog locale={locale} />;
}
