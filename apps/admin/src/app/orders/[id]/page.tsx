'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminOrderDetail } from '@ecom/sdk-api';
import { AdminShell } from '../../../components/AdminShell';
import { OrderDetail } from '../../../components/OrderDetail';
import { fetchStaffMe, getAdminOrder } from '../../../lib/api';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [email, setEmail] = useState('owner@demo.localhost');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStaffMe()
      .then((me) => {
        if (!cancelled) setEmail(me.email);
      })
      .catch(() => {
        /* middleware should have gated; keep fallback */
      });
    getAdminOrder(id)
      .then((data) => {
        if (!cancelled) setOrder(data);
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
          <Link href="/orders">← Orders</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Order detail</h2>
        {error ? (
          <p style={{ color: '#9a3412' }} role="alert">
            {error}
          </p>
        ) : null}
        {!error && !order ? (
          <p style={{ opacity: 0.75 }}>Loading…</p>
        ) : null}
        {order ? <OrderDetail initial={order} /> : null}
      </div>
    </AdminShell>
  );
}
