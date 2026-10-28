import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { CmsBootstrap } from '@ecom/sdk-api';
import { defaultTheme, themeToCssVars } from '@ecom/themes';
import { AccountAuth } from './AccountAuth';
import { CookieConsentBanner } from './CookieConsentBanner';
import { StorefrontSwitchers } from './StorefrontSwitchers';

type StoreShellProps = {
  locale: string;
  cms: CmsBootstrap | null;
  children: ReactNode;
};

export function StoreShell({ locale, cms, children }: StoreShellProps) {
  const tokens = cms?.theme.resolved ?? defaultTheme;
  const cssVars = themeToCssVars(tokens) as CSSProperties;
  const siteTitle = cms?.seo.siteTitle || 'ecom · demo';
  const headerItems = cms?.menus.header.items ?? [];
  const footerItems = cms?.menus.footer.items ?? [];
  const mid =
    tokens.id === 'daylight'
      ? '#e4ddd0'
      : tokens.id === 'midnight'
        ? '#152238'
        : '#1a2430';

  return (
    <div
      lang={locale}
      style={{
        ...cssVars,
        minHeight: '100vh',
        background: `linear-gradient(165deg, ${tokens.colors.background} 0%, ${mid} 45%, ${tokens.colors.background} 100%)`,
        color: tokens.colors.foreground,
        fontFamily: tokens.fonts.body,
        display: 'flex',
        flexDirection: 'column',
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
          borderBottom: `1px solid ${tokens.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href={`/${locale}`}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              fontFamily: tokens.fonts.display,
              fontSize: '1.05rem',
              letterSpacing: '0.04em',
            }}
          >
            {siteTitle}
          </Link>
          <nav style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
            {headerItems.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                style={{ color: tokens.colors.muted, textDecoration: 'none' }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${locale}/wishlist`}
              style={{ color: tokens.colors.muted, textDecoration: 'none' }}
            >
              Wishlist
            </Link>
            <Link
              href={`/${locale}/privacy`}
              style={{
                color: tokens.colors.muted,
                textDecoration: 'underline',
              }}
            >
              Privacy
            </Link>
          </nav>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <StorefrontSwitchers locale={locale} />
          <AccountAuth />
        </div>
      </header>
      <main style={{ padding: '0 1.5rem 5rem', flex: 1 }}>{children}</main>
      <footer
        style={{
          padding: '1.25rem 1.5rem 2rem',
          borderTop: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.85rem',
          color: tokens.colors.muted,
        }}
      >
        {footerItems.length === 0 ? (
          <span>Policies coming soon</span>
        ) : (
          footerItems.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          ))
        )}
      </footer>
      <CookieConsentBanner locale={locale} />
    </div>
  );
}
