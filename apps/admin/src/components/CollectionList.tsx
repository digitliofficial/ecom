'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Collection } from '@ecom/sdk-api';
import { listAdminCollections } from '../lib/api';

export function CollectionList() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminCollections()
      .then((data) => {
        if (!cancelled) setCollections(data);
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
      <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading collections…</p>
    );
  }

  if (error) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load collections ({error}). Run `pnpm db:apply` and start the API.
      </p>
    );
  }

  if (!collections.length) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        No collections yet.{' '}
        <Link href="/collections/new">Create the first collection</Link>.
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
      {collections.map((collection) => (
        <li
          key={collection.id}
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
              href={`/collections/${collection.id}`}
              style={{ fontWeight: 500, color: 'inherit' }}
            >
              {collection.title}
            </Link>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              {collection.status}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            /{collection.slug} · {collection.productCount} product
            {collection.productCount === 1 ? '' : 's'}
          </div>
        </li>
      ))}
    </ul>
  );
}
