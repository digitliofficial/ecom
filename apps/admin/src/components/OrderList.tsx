'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminOrderSummary } from '@ecom/sdk-api';
import { formatMoney, listAdminOrders } from '../lib/api';

export function OrderList() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
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
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading orders…</p>;
  }

  if (error) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load orders ({error}). Is the API on :3001 with demo tenant
        schema, and are you signed in as staff?
      </p>
    );
  }

  if (!orders.length) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        No orders yet. Place a guest checkout on the storefront
        (http://localhost:3005/en) — placed orders appear here for the demo
        tenant.
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
      {orders.map((order) => (
        <li
          key={order.id}
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
              href={`/orders/${order.id}`}
              style={{ fontWeight: 500, color: 'inherit', fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem' }}
            >
              {order.id.slice(0, 8)}…
            </Link>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>{order.status}</span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            {order.guestEmail ?? (order.customerId ? 'account customer' : 'no email')}
            {' · '}
            {formatMoney(order.totalAmountMinor, order.chargeCurrency)}
            {' · '}
            {order.lineCount} line{order.lineCount === 1 ? '' : 's'}
            {' · '}
            {order.paymentStatus}
            {' · '}
            {new Date(order.createdAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}
