'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Collection } from '@ecom/sdk-api';
import { AdminShell } from '../../../components/AdminShell';
import { CollectionForm } from '../../../components/CollectionForm';
import { getAdminCollection } from '../../../lib/api';
import { readStaffBearer } from '../../../lib/auth-session';

export default function EditCollectionPage() {
  const params = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const email = 'owner@demo.localhost';

  useEffect(() => {
    if (!readStaffBearer()) return;
    getAdminCollection(params.id)
      .then(setCollection)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ margin: '0 0 0.5rem' }}>
          <Link href="/collections">← Collections</Link>
        </p>
        <h2 style={{ margin: 0 }}>Edit collection</h2>
        {error && (
          <p style={{ color: '#9a3412', marginTop: '1rem' }} role="alert">
            {error}
          </p>
        )}
        {!collection && !error && (
          <p style={{ marginTop: '1rem', opacity: 0.75 }}>Loading…</p>
        )}
        {collection && <CollectionForm mode="edit" initial={collection} />}
      </div>
    </AdminShell>
  );
}
