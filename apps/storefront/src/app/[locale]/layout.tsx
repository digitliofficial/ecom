import type { ReactNode } from 'react';
import Link from 'next/link';
import { defaultTheme } from '@ecom/themes';
import { AccountAuth } from '../../components/AccountAuth';

export default function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  void params;
  const t = defaultTheme.colors;
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(165deg, ${t.background} 0%, #1a2430 45%, #243447 100%)`,
        color: t.foreground,
      }}
    >
      <header
        style={{
          padding: '1.25rem 1.5rem',
          letterSpacing: '0.08em',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
          <Link href="/en" style={{ color: 'inherit', textDecoration: 'none' }}>
            ecom · demo
          </Link>
          <span style={{ opacity: 0.65, letterSpacing: '0.04em' }}>
            guest + account checkout
          </span>
        </div>
        <AccountAuth />
      </header>
      <main style={{ padding: '0 1.5rem 3rem' }}>{children}</main>
    </div>
  );
}
