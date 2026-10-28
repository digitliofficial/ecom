'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Discount } from '@ecom/sdk-api';
import { AdminShell } from '../../../components/AdminShell';
import { DiscountForm } from '../../../components/DiscountForm';
import { getAdminDiscount } from '../../../lib/api';
import { readStaffBearer } from '../../../lib/auth-session';

export default function EditDiscountPage() {
  const params = useParams<{ id: string }>();
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!readStaffBearer()) return;
    getAdminDiscount(params.id)
      .then(setDiscount)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  return (
    <AdminShell email="owner@demo.localhost">
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ margin: '0 0 0.5rem' }}>
          <Link href="/discounts">← Discounts</Link>
        </p>
        <h2 style={{ margin: 0 }}>Edit discount</h2>
        {error && (
          <p style={{ color: '#9a3412', marginTop: '1rem' }} role="alert">
            {error}
          </p>
        )}
        {!discount && !error && (
          <p style={{ marginTop: '1rem', opacity: 0.75 }}>Loading…</p>
        )}
        {discount && <DiscountForm mode="edit" initial={discount} />}
      </div>
    </AdminShell>
  );
}
