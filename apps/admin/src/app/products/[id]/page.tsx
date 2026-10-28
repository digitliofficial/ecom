'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Product } from '@ecom/sdk-api';
import { AdminShell } from '../../../components/AdminShell';
import { ProductForm } from '../../../components/ProductForm';
import { getAdminProduct } from '../../../lib/api';
import { readStubSessionClient } from '../../../lib/auth-session';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const email = readStubSessionClient()?.email ?? 'staff@merchant.com';

  useEffect(() => {
    let cancelled = false;
    getAdminProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/products">← Products</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Edit product</h2>
        {error ? (
          <p style={{ color: '#9a3412' }} role="alert">
            {error}
          </p>
        ) : null}
        {!error && !product ? (
          <p style={{ opacity: 0.75 }}>Loading…</p>
        ) : null}
        {product ? <ProductForm mode="edit" initial={product} /> : null}
      </div>
    </AdminShell>
  );
}
