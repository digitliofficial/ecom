'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  DISPLAY_CURRENCY_COOKIE,
  writeDisplayCurrency,
} from '../lib/display-currency';

const selectStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(0,0,0,0.25)',
  color: 'inherit',
  fontSize: '0.8rem',
};

export function CurrencySwitcher({
  currency,
  currencies,
}: {
  currency: string;
  currencies: string[];
}) {
  const [value, setValue] = useState(currency);

  useEffect(() => {
    setValue(currency);
  }, [currency]);

  if (currencies.length <= 1) return null;

  function onChange(next: string) {
    setValue(next);
    writeDisplayCurrency(next);
    document.cookie = `${DISPLAY_CURRENCY_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>Currency</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        aria-label="Currency"
      >
        {currencies.map((cur) => (
          <option key={cur} value={cur}>
            {cur}
          </option>
        ))}
      </select>
    </label>
  );
}
