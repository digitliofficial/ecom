import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCmsPolicy, isPolicyKind } from '../../../../lib/cms';

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const { locale, kind } = await params;
  if (!isPolicyKind(kind)) notFound();

  const policy = await fetchCmsPolicy(kind, locale);
  if (!policy) notFound();

  return (
    <article style={{ maxWidth: 640, paddingTop: '2.5rem' }}>
      <p style={{ marginTop: 0, opacity: 0.7 }}>
        <Link href={`/${locale}`} style={{ color: 'inherit' }}>
          ← Home
        </Link>
      </p>
      <h1
        style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          margin: '0 0 1rem',
          fontWeight: 500,
          fontFamily: 'var(--theme-font-display, Georgia, serif)',
        }}
      >
        {policy.title}
      </h1>
      <div
        style={{
          lineHeight: 1.65,
          opacity: 0.92,
          whiteSpace: 'pre-wrap',
        }}
      >
        {policy.body}
      </div>
    </article>
  );
}
