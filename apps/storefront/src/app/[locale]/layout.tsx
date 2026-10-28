import type { ReactNode } from 'react';
import { defaultTheme } from '@ecom/themes';

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
      <header style={{ padding: '1.25rem 1.5rem', letterSpacing: '0.08em', fontSize: '0.85rem' }}>
        ecom · demo
      </header>
      <main style={{ padding: '0 1.5rem 3rem' }}>{children}</main>
    </div>
  );
}
