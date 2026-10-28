import { WishlistView } from '../../../components/WishlistView';

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <WishlistView locale={locale} />;
}
