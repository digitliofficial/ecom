'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Collection, Product } from '@ecom/sdk-api';
import {
  addToCart,
  formatMoney,
  listCollections,
  listProducts,
} from '../lib/api';

export function ProductCatalog({
  locale,
  collectionSlug,
}: {
  locale: string;
  collectionSlug?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listProducts(
        collectionSlug ? { collection: collectionSlug } : undefined,
      ),
      listCollections(),
    ])
      .then(([productData, collectionData]) => {
        if (cancelled) return;
        setProducts(productData);
        setCollections(collectionData);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionSlug]);

  const activeCollection = collections.find((c) => c.slug === collectionSlug);

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
        {activeCollection
          ? activeCollection.description ||
            `Browsing collection “${activeCollection.title}”.`
          : 'Guest checkout slice — add a demo product, apply a coupon, place an order.'}
      </p>

      {collections.length > 0 && (
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1.5rem',
            fontSize: '0.95rem',
          }}
          aria-label="Collections"
        >
          <Link
            href={`/${locale}`}
            style={{
              color: collectionSlug ? '#9ec1ff' : '#fff',
              textDecoration: collectionSlug ? 'underline' : 'none',
              fontWeight: collectionSlug ? 400 : 600,
            }}
          >
            All
          </Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/${locale}/collections/${c.slug}`}
              style={{
                color: collectionSlug === c.slug ? '#fff' : '#9ec1ff',
                textDecoration: collectionSlug === c.slug ? 'none' : 'underline',
                fontWeight: collectionSlug === c.slug ? 600 : 400,
              }}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}

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
        {!products.length && !error && (
          <li style={{ opacity: 0.75 }}>No products in this view.</li>
        )}
        {products.map((product) => {
          const variant = product.variants[0];
          if (!variant) return null;
          return (
            <li key={product.id} style={{ borderTop: '1px solid #3a4a5c', paddingTop: '1.25rem' }}>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem', fontWeight: 500 }}>
                {product.title}
              </h2>
              <p style={{ margin: '0 0 1rem', opacity: 0.8 }}>{product.description}</p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(variant.unitAmountMinor, variant.currency)}
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
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.5rem' }}>
        <Link href={`/${locale}/cart`} style={{ color: '#9ec1ff' }}>
          View cart
        </Link>
        <Link href={`/${locale}/checkout`} style={{ color: '#9ec1ff' }}>
          Checkout
        </Link>
      </div>
    </section>
  );
}
