'use client';

import { useEffect, useState } from 'react';
import type { StorefrontLocalization } from '@ecom/sdk-api';
import { getStorefrontLocalization } from '../lib/api';
import { readDisplayCurrency, writeDisplayCurrency } from '../lib/display-currency';
import { CurrencySwitcher } from './CurrencySwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';

export function StorefrontSwitchers({ locale }: { locale: string }) {
  const [config, setConfig] = useState<StorefrontLocalization | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStorefrontLocalization()
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        const preferred = readDisplayCurrency();
        const next =
          preferred && data.currencies.includes(preferred)
            ? preferred
            : data.defaultCurrency;
        writeDisplayCurrency(next);
        setDisplayCurrency(next);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const showLocale =
    config.multiLanguage && config.locales.length > 1;
  const showCurrency =
    config.multiCurrency && config.currencies.length > 1;

  if (!showLocale && !showCurrency) return null;

  const activeLocale = config.locales.includes(locale)
    ? locale
    : config.defaultLocale;

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.85rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {showLocale && (
        <LocaleSwitcher locale={activeLocale} locales={config.locales} />
      )}
      {showCurrency && displayCurrency && (
        <CurrencySwitcher
          currency={displayCurrency}
          currencies={config.currencies}
        />
      )}
    </div>
  );
}
