'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Discount } from '@ecom/sdk-api';
import { formatMoney, listAdminDiscounts } from '../lib/api';

function formatValue(d: Discount): string {
  if (d.type === 'percentage') return `${d.value}%`;
  return formatMoney(d.value, d.currency);
}

export function DiscountList() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminDiscounts()
      .then((data) => {
        if (!cancelled) setDiscounts(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading discounts…</p>
    );
  }

  if (error) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load discounts ({error}). Run `pnpm db:apply` and start the API.
      </p>
    );
  }

  if (!discounts.length) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        No coupons yet. <Link href="/discounts/new">Create the first discount</Link>.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '1.5rem 0 0',
        display: 'grid',
        gap: '0.85rem',
      }}
    >
      {discounts.map((discount) => (
        <li
          key={discount.id}
          style={{
            borderTop: '1px solid #cfc8bc',
            paddingTop: '0.85rem',
            display: 'grid',
            gap: '0.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'baseline',
            }}
          >
            <Link
              href={`/discounts/${discount.id}`}
              style={{ fontWeight: 500, color: 'inherit' }}
            >
              {discount.code}
            </Link>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              {discount.active ? 'active' : 'inactive'} · {formatValue(discount)}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            {discount.title} · used {discount.usageCount}
            {discount.usageLimit != null ? ` / ${discount.usageLimit}` : ''}
          </div>
        </li>
      ))}
    </ul>
  );
}
