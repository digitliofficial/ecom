'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Wishlist } from '@ecom/sdk-api';
import {
  addToCart,
  formatMoney,
  getWishlist,
  removeWishlistItem,
} from '../lib/api';
import { fetchCustomerMe } from '../lib/auth';

export function WishlistView({ locale }: { locale: string }) {
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchCustomerMe()
      .then(async (me) => {
        if (cancelled) return;
        if (!me) {
          setAuthed(false);
          return;
        }
        setAuthed(true);
        const data = await getWishlist();
        if (!cancelled) setWishlist(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authed === false) {
    return (
      <section style={{ maxWidth: 640, paddingTop: '2rem' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 500 }}>Wishlist</h1>
        <p style={{ opacity: 0.85 }}>
          Sign in from the header to save products to your wishlist.
        </p>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          ← Back to catalog
        </Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 720, paddingTop: '2rem' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 500, marginTop: 0 }}>
        Wishlist
      </h1>
      {error && <p style={{ color: '#ff8e8e' }}>{error}</p>}
      {message && <p style={{ color: '#9ec1ff' }}>{message}</p>}
      {!wishlist && !error && <p style={{ opacity: 0.7 }}>Loading…</p>}
      {wishlist && wishlist.items.length === 0 && (
        <p style={{ opacity: 0.8 }}>Your wishlist is empty.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0 0' }}>
        {wishlist?.items.map((item) => (
          <li
            key={item.id}
            style={{
              borderTop: '1px solid #3a4a5c',
              padding: '1.1rem 0',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <Link
                href={`/${locale}/products/${item.productSlug}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <strong>{item.productTitle}</strong>
              </Link>
              <div style={{ opacity: 0.75, fontSize: '0.9rem' }}>
                {item.variantTitle} · {item.sku}
              </div>
              <div style={{ marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(item.unitAmountMinor, item.currency)}
                {item.priceSource === 'price_list' ? ' · wholesale' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await addToCart(item.variantId, 1);
                      setMessage(`Added ${item.productTitle} to cart.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Add failed');
                    }
                  });
                }}
                style={{
                  background: '#3d8bfd',
                  color: '#fff',
                  border: 'none',
                  padding: '0.5rem 0.85rem',
                  cursor: pending ? 'wait' : 'pointer',
                }}
              >
                Add to cart
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const next = await removeWishlistItem(item.variantId);
                      setWishlist(next);
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Remove failed',
                      );
                    }
                  });
                }}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid #3a4a5c',
                  padding: '0.5rem 0.85rem',
                  cursor: pending ? 'wait' : 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: '2rem' }}>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          ← Catalog
        </Link>
      </p>
    </section>
  );
}
