'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

const selectStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(0,0,0,0.25)',
  color: 'inherit',
  fontSize: '0.8rem',
};

export function LocaleSwitcher({
  locale,
  locales,
}: {
  locale: string;
  locales: string[];
}) {
  const pathname = usePathname() || `/${locale}`;
  const router = useRouter();

  if (locales.length <= 1) return null;

  function onChange(next: string) {
    const parts = pathname.split('/');
    // ['', locale, ...rest]
    if (parts.length >= 2) {
      parts[1] = next;
      router.push(parts.join('/') || `/${next}`);
    } else {
      router.push(`/${next}`);
    }
  }

  return (
    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>Lang</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        aria-label="Language"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    </label>
  );
}
