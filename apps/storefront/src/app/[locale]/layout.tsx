import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StoreShell } from '../../components/StoreShell';
import { fetchCmsBootstrap } from '../../lib/cms';

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const cms = await fetchCmsBootstrap(locale);
  if (!cms) {
    return { title: 'ecom · demo' };
  }
  return {
    title: cms.seo.siteTitle,
    description: cms.seo.metaDescription || undefined,
    openGraph: cms.seo.ogImageUrl
      ? {
          title: cms.seo.siteTitle,
          description: cms.seo.metaDescription || undefined,
          images: [cms.seo.ogImageUrl],
        }
      : {
          title: cms.seo.siteTitle,
          description: cms.seo.metaDescription || undefined,
        },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  const cms = await fetchCmsBootstrap(locale);
  return (
    <StoreShell locale={locale} cms={cms}>
      {children}
    </StoreShell>
  );
}
