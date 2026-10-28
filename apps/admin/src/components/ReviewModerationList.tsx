'use client';

import { useEffect, useState, useTransition } from 'react';
import type { ProductReview, ReviewStatus } from '@ecom/sdk-api';
import { listAdminReviews, moderateAdminReview } from '../lib/api';

export function ReviewModerationList() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  function load(status: ReviewStatus | 'all') {
    setLoading(true);
    listAdminReviews(status === 'all' ? undefined : status)
      .then(setReviews)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: '0.35rem 0.7rem',
              border: '1px solid #a8a29e',
              background: filter === s ? '#e7e5e4' : 'transparent',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {error && (
        <p style={{ color: '#9a3412', marginTop: '1rem' }} role="alert">
          {error}
        </p>
      )}
      {loading && <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading…</p>}
      {!loading && reviews.length === 0 && (
        <p style={{ marginTop: '1rem', opacity: 0.75 }}>No reviews.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '1.25rem 0 0' }}>
        {reviews.map((r) => (
          <li
            key={r.id}
            style={{
              borderTop: '1px solid #d6d3d1',
              padding: '1rem 0',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong>{r.rating} ★</strong>
              <span>{r.title ?? '(no title)'}</span>
              <span style={{ opacity: 0.7 }}>{r.status}</span>
              {r.verifiedPurchase && (
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                  verified purchase
                </span>
              )}
            </div>
            <p style={{ margin: '0.4rem 0' }}>{r.body}</p>
            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
              {r.authorDisplayName ?? r.customerId} · product {r.productId.slice(0, 8)}…
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
              {r.status !== 'approved' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await moderateAdminReview(r.id, 'approved');
                        load(filter);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Moderate failed',
                        );
                      }
                    });
                  }}
                  style={{
                    padding: '0.35rem 0.7rem',
                    cursor: pending ? 'wait' : 'pointer',
                    border: '1px solid #a8a29e',
                    background: '#fff',
                    borderRadius: 4,
                  }}
                >
                  Approve
                </button>
              )}
              {r.status !== 'rejected' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await moderateAdminReview(r.id, 'rejected');
                        load(filter);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Moderate failed',
                        );
                      }
                    });
                  }}
                  style={{
                    padding: '0.35rem 0.7rem',
                    cursor: pending ? 'wait' : 'pointer',
                    border: '1px solid #a8a29e',
                    background: '#fff',
                    borderRadius: 4,
                  }}
                >
                  Reject
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
