'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import type { Product, ProductReview } from '@ecom/sdk-api';
import {
  addToCart,
  addWishlistItem,
  createProductReview,
  formatMoney,
  listProductReviews,
  listProducts,
} from '../lib/api';
import { fetchCustomerMe } from '../lib/auth';

export function ProductDetail({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProducts(), fetchCustomerMe()])
      .then(async ([products, me]) => {
        if (cancelled) return;
        const found = products.find((p) => p.slug === slug) ?? null;
        setProduct(found);
        setAuthed(Boolean(me));
        if (found) {
          const approved = await listProductReviews(found.id);
          if (!cancelled) setReviews(approved);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!product && !error) {
    return <p style={{ paddingTop: '2rem', opacity: 0.7 }}>Loading…</p>;
  }
  if (!product) {
    return (
      <section style={{ paddingTop: '2rem' }}>
        <p style={{ color: '#ff8e8e' }}>{error ?? 'Product not found'}</p>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          ← Catalog
        </Link>
      </section>
    );
  }

  const variant = product.variants[0];

  function onReviewSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rating = Number(fd.get('rating'));
    const title = String(fd.get('title') ?? '') || undefined;
    const body = String(fd.get('body') ?? '');
    startTransition(async () => {
      try {
        await createProductReview(product!.id, {
          rating,
          title,
          body,
          locale,
        });
        setMessage('Review submitted for moderation.');
        setError(null);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Review failed');
      }
    });
  }

  return (
    <section style={{ maxWidth: 720, paddingTop: '2rem' }}>
      <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          Catalog
        </Link>
      </p>
      <h1
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 500,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          margin: '0 0 0.75rem',
        }}
      >
        {product.title}
      </h1>
      <p style={{ opacity: 0.85, lineHeight: 1.5 }}>{product.description}</p>
      {(product.ratingCount ?? 0) > 0 && (
        <p style={{ opacity: 0.8 }}>
          {product.ratingAvg?.toFixed(1)} ★ · {product.ratingCount} reviews
        </p>
      )}
      {error && <p style={{ color: '#ff8e8e' }}>{error}</p>}
      {message && <p style={{ color: '#9ec1ff' }}>{message}</p>}

      {variant && (
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.2rem' }}>
            {formatMoney(variant.unitAmountMinor, variant.currency)}
            {variant.compareAtAmountMinor != null && (
              <span style={{ opacity: 0.55, marginLeft: '0.5rem', textDecoration: 'line-through' }}>
                {formatMoney(variant.compareAtAmountMinor, variant.currency)}
              </span>
            )}
            {variant.priceSource === 'price_list' ? (
              <span style={{ opacity: 0.7, marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                wholesale
              </span>
            ) : null}
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
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Add to cart
          </button>
          <button
            type="button"
            disabled={pending || !authed}
            onClick={() => {
              startTransition(async () => {
                try {
                  await addWishlistItem(variant.id);
                  setMessage('Saved to wishlist.');
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Wishlist failed',
                  );
                }
              });
            }}
            style={{
              background: 'transparent',
              color: 'inherit',
              border: '1px solid #3a4a5c',
              padding: '0.65rem 1.1rem',
              cursor: !authed || pending ? 'not-allowed' : 'pointer',
              opacity: authed ? 1 : 0.55,
            }}
          >
            {authed ? 'Add to wishlist' : 'Sign in to wishlist'}
          </button>
        </div>
      )}

      <h2 style={{ marginTop: '2.75rem', fontWeight: 500 }}>Reviews</h2>
      {reviews.length === 0 && (
        <p style={{ opacity: 0.75 }}>No approved reviews yet.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
        {reviews.map((r) => (
          <li
            key={r.id}
            style={{ borderTop: '1px solid #3a4a5c', padding: '1rem 0' }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
              <strong>{r.rating} ★</strong>
              <span>{r.title ?? 'Review'}</span>
              {r.verifiedPurchase && (
                <span style={{ opacity: 0.65, fontSize: '0.8rem' }}>
                  verified purchase
                </span>
              )}
            </div>
            <p style={{ margin: '0.35rem 0', opacity: 0.9 }}>{r.body}</p>
            <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>
              {r.authorDisplayName ?? 'Customer'}
            </p>
          </li>
        ))}
      </ul>

      {authed ? (
        <form
          onSubmit={onReviewSubmit}
          style={{
            marginTop: '1.75rem',
            display: 'grid',
            gap: '0.75rem',
            maxWidth: 480,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 500 }}>Write a review</h3>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            Rating
            <select name="rating" defaultValue="5" required>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            Title
            <input name="title" maxLength={120} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            Review
            <textarea name="body" required rows={4} />
          </label>
          <button
            type="submit"
            disabled={pending}
            style={{
              justifySelf: 'start',
              background: '#3d8bfd',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1rem',
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Submit for moderation
          </button>
        </form>
      ) : (
        <p style={{ opacity: 0.75, marginTop: '1.5rem' }}>
          Sign in to leave a review.
        </p>
      )}
    </section>
  );
}
