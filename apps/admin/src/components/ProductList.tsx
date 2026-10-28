'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@ecom/sdk-api';
import { formatMoney, listAdminProducts } from '../lib/api';

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
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
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading products…</p>;
  }

  if (error) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load products ({error}). Is the API on :3001 with demo tenant schema?
      </p>
    );
  }

  if (!products.length) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        No products yet.{' '}
        <Link href="/products/new">Create the first product</Link>.
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
      {products.map((product) => {
        const variant = product.variants[0];
        return (
          <li
            key={product.id}
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
                href={`/products/${product.id}`}
                style={{ fontWeight: 500, color: 'inherit' }}
              >
                {product.title}
              </Link>
              <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                {product.status}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              /{product.slug}
              {variant
                ? ` · ${formatMoney(variant.unitAmountMinor, variant.currency)} · SKU ${variant.sku} · qty ${variant.inventoryQuantity ?? 0}`
                : ' · no variants'}
              {product.variants.length > 1
                ? ` · +${product.variants.length - 1} more`
                : ''}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
