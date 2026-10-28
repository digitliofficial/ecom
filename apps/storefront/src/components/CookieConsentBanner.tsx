'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import type { StorefrontPrivacyConfig } from '@ecom/sdk-api';
import { createApiClient } from '@ecom/sdk-api';
import { getApiBaseUrl, getTenantHost, readCartToken } from '../lib/api';
import { readCustomerBearer } from '../lib/customer-session';
import {
  readConsentSubjectKey,
  readStoredConsent,
  writeStoredConsent,
} from '../lib/consent';

const bar: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  padding: '1rem 1.25rem',
  background: 'rgba(12, 18, 28, 0.96)',
  borderTop: '1px solid #3a4a5c',
  color: '#e8eef6',
  display: 'grid',
  gap: '0.85rem',
  boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
};

const modalWrap: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.55)',
  padding: '1rem',
};

const modalPanel: CSSProperties = {
  maxWidth: 440,
  width: '100%',
  padding: '1.25rem',
  background: '#121a24',
  border: '1px solid #3a4a5c',
  color: '#e8eef6',
  display: 'grid',
  gap: '0.85rem',
};

const btnPrimary: CSSProperties = {
  background: '#3d8bfd',
  color: '#fff',
  border: 'none',
  padding: '0.55rem 0.9rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const btnGhost: CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: '1px solid #3a4a5c',
  padding: '0.55rem 0.9rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

export function CookieConsentBanner({ locale }: { locale: string }) {
  const [config, setConfig] = useState<StorefrontPrivacyConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const client = createApiClient({
      baseUrl: getApiBaseUrl(),
      getHost: getTenantHost,
      getCartToken: readCartToken,
      getToken: () => readCustomerBearer(),
      credentials: 'include',
    });
    client
      .getPrivacyConfig()
      .then((cfg) => {
        if (cancelled) return;
        setConfig(cfg);
        const existing = readStoredConsent();
        if (cfg.cookieBannerEnabled && !existing) {
          setVisible(true);
          setAnalytics(false);
          setMarketing(false);
        }
      })
      .catch(() => {
        /* banner optional if API down */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function save(nextAnalytics: boolean, nextMarketing: boolean) {
    if (!config) return;
    startTransition(async () => {
      const subjectKey = readConsentSubjectKey();
      const client = createApiClient({
        baseUrl: getApiBaseUrl(),
        getHost: getTenantHost,
        getCartToken: readCartToken,
        getToken: () => readCustomerBearer(),
        credentials: 'include',
      });
      try {
        const event = await client.recordConsent({
          subjectKey,
          analytics: config.analyticsCategoryEnabled ? nextAnalytics : false,
          marketing: config.marketingCategoryEnabled ? nextMarketing : false,
          source: 'banner',
        });
        writeStoredConsent({
          categories: event.categories,
          decidedAt: event.createdAt,
          eventId: event.id,
        });
      } catch {
        writeStoredConsent({
          categories: {
            necessary: true,
            analytics: config.analyticsCategoryEnabled ? nextAnalytics : false,
            marketing: config.marketingCategoryEnabled ? nextMarketing : false,
          },
          decidedAt: new Date().toISOString(),
        });
      }
      setVisible(false);
    });
  }

  if (!visible || !config) return null;

  const policyHref = config.privacyPolicyUrl || `/${locale}/privacy`;
  const cookieHref = config.cookiePolicyUrl || `/${locale}/privacy#cookies`;

  const body = (
    <>
      <div>
        <p style={{ margin: '0 0 0.35rem', fontWeight: 600, letterSpacing: '0.04em' }}>
          Cookie preferences
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85, lineHeight: 1.45 }}>
          We use necessary cookies for cart and checkout. Optional analytics and
          marketing cookies stay off until you allow them.{' '}
          <Link href={policyHref} style={{ color: '#9ec1ff' }}>
            Privacy
          </Link>
          {' · '}
          <Link href={cookieHref} style={{ color: '#9ec1ff' }}>
            Cookies
          </Link>
        </p>
      </div>

      {customize ? (
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          <label style={{ display: 'flex', gap: '0.5rem', opacity: 0.75 }}>
            <input type="checkbox" checked disabled />
            Necessary (always on)
          </label>
          {config.analyticsCategoryEnabled ? (
            <label style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              Analytics
            </label>
          ) : null}
          {config.marketingCategoryEnabled ? (
            <label style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              Marketing
            </label>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={pending}
          style={btnPrimary}
          onClick={() =>
            save(
              config.analyticsCategoryEnabled,
              config.marketingCategoryEnabled,
            )
          }
        >
          {pending ? '…' : 'Accept all'}
        </button>
        <button
          type="button"
          disabled={pending}
          style={btnGhost}
          onClick={() => save(false, false)}
        >
          Necessary only
        </button>
        {customize ? (
          <button
            type="button"
            disabled={pending}
            style={btnGhost}
            onClick={() => save(analytics, marketing)}
          >
            Save choices
          </button>
        ) : (
          <button
            type="button"
            style={btnGhost}
            onClick={() => setCustomize(true)}
          >
            Customize
          </button>
        )}
      </div>
    </>
  );

  if (config.cookieBannerLayout === 'modal') {
    return (
      <div style={modalWrap} role="dialog" aria-label="Cookie consent">
        <div style={modalPanel}>{body}</div>
      </div>
    );
  }

  return (
    <div style={bar} role="dialog" aria-label="Cookie consent">
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', display: 'grid', gap: '0.85rem' }}>
        {body}
      </div>
    </div>
  );
}
