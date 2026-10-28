'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Product } from '@ecom/sdk-api';
import { addToCart, formatMoney, listProducts } from '../lib/api';

export function ProductCatalog({ locale }: { locale: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={{ maxWidth: 720, paddingTop: '3rem' }}>
      <p style={{ opacity: 0.7, marginBottom: '0.5rem', letterSpacing: '0.06em' }}>
        demo.localhost
      </p>
      <h1
        style={{
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          margin: '0 0 0.75rem',
          fontWeight: 500,
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        ecom
      </h1>
      <p style={{ fontSize: '1.1rem', maxWidth: 440, lineHeight: 1.5, opacity: 0.9 }}>
        Guest checkout slice — add a demo product, review the cart, place an order
        without charging.
      </p>

      {error && (
        <p style={{ color: '#ff8e8e', marginTop: '1.5rem' }}>
          Could not load catalog ({error}). Is the API running on :3001?
        </p>
      )}
      {message && (
        <p style={{ color: '#9ec1ff', marginTop: '1.5rem' }}>{message}</p>
      )}

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '2.5rem 0 0',
          display: 'grid',
          gap: '1.5rem',
        }}
      >
        {products.map((product) => {
          const variant = product.variants[0];
          if (!variant) return null;
          return (
            <li key={product.id} style={{ borderTop: '1px solid #3a4a5c', paddingTop: '1.25rem' }}>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem', fontWeight: 500 }}>
                <Link
                  href={`/${locale}/products/${product.slug}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {product.title}
                </Link>
              </h2>
              <p style={{ margin: '0 0 0.5rem', opacity: 0.8 }}>{product.description}</p>
              {(product.ratingCount ?? 0) > 0 && (
                <p style={{ margin: '0 0 1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                  {product.ratingAvg?.toFixed(1)} ★ · {product.ratingCount} reviews
                </p>
              )}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(variant.unitAmountMinor, variant.currency)}
                  {variant.compareAtAmountMinor != null && (
                    <span
                      style={{
                        opacity: 0.55,
                        marginLeft: '0.45rem',
                        textDecoration: 'line-through',
                      }}
                    >
                      {formatMoney(variant.compareAtAmountMinor, variant.currency)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await addToCart(variant.id, 1);
                        setMessage(`Added ${product.title} to cart.`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Add failed');
                      }
                    });
                  }}
                  style={{
                    background: '#3d8bfd',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.1rem',
                    fontSize: '0.95rem',
                    cursor: pending ? 'wait' : 'pointer',
                  }}
                >
                  Add to cart
                </button>
                <Link
                  href={`/${locale}/products/${product.slug}`}
                  style={{ color: '#9ec1ff', fontSize: '0.95rem' }}
                >
                  Reviews
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
        <Link href={`/${locale}/cart`} style={{ color: '#9ec1ff' }}>
          View cart
        </Link>
        <Link href={`/${locale}/wishlist`} style={{ color: '#9ec1ff' }}>
          Wishlist
        </Link>
        <Link href={`/${locale}/checkout`} style={{ color: '#9ec1ff' }}>
          Checkout
        </Link>
      </div>
    </section>
  );
}
