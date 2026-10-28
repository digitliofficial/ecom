import { ProductCatalog } from '../../../../components/ProductCatalog';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return <ProductCatalog locale={locale} collectionSlug={slug} />;
}
