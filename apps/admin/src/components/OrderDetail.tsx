'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AdminOrderDetail,
  AdminOrderStatusUpdate,
} from '@ecom/sdk-api';
import { formatMoney, updateAdminOrderStatus } from '../lib/api';

type OrderDetailProps = {
  initial: AdminOrderDetail;
};

const ACTIONS: { status: AdminOrderStatusUpdate; label: string }[] = [
  { status: 'fulfilled', label: 'Fulfill' },
  { status: 'shipped', label: 'Mark shipped' },
  { status: 'cancelled', label: 'Cancel' },
];

export function OrderDetail({ initial }: OrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<AdminOrderStatusUpdate | null>(null);

  const canAct = order.status === 'placed' || order.status === 'pending';

  async function applyStatus(status: AdminOrderStatusUpdate) {
    setError(null);
    setBusy(status);
    try {
      const updated = await updateAdminOrderStatus(order.id, status);
      setOrder(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  const addr = order.shippingAddress;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Status</p>
          <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{order.status}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Total</p>
          <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>
            {formatMoney(order.totalAmountMinor, order.chargeCurrency)}
          </p>
        </div>
      </div>

      <dl
        style={{
          margin: 0,
          display: 'grid',
          gap: '0.65rem',
          fontSize: '0.95rem',
        }}
      >
        <div>
          <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Order id</dt>
          <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>
            {order.id}
          </dd>
        </div>
        <div>
          <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Customer</dt>
          <dd style={{ margin: 0 }}>
            {order.guestEmail ??
              (order.customerId
                ? `Customer ${order.customerId.slice(0, 8)}…`
                : '—')}
          </dd>
        </div>
        <div>
          <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Payment</dt>
          <dd style={{ margin: 0 }}>
            {order.paymentMethod ? `${order.paymentMethod} · ` : null}
            {order.paymentStatus}
          </dd>
        </div>
        <div>
          <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Created</dt>
          <dd style={{ margin: 0 }}>{new Date(order.createdAt).toLocaleString()}</dd>
        </div>
        {addr ? (
          <div>
            <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Shipping</dt>
            <dd style={{ margin: 0, lineHeight: 1.5 }}>
              {addr.line1}
              {addr.line2 ? (
                <>
                  <br />
                  {addr.line2}
                </>
              ) : null}
              <br />
              {[addr.city, addr.region, addr.postalCode].filter(Boolean).join(', ')}
              <br />
              {addr.country}
            </dd>
          </div>
        ) : null}
      </dl>

      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Lines</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.65rem' }}>
          {order.lines.map((line) => (
            <li
              key={line.id}
              style={{
                borderTop: '1px solid #cfc8bc',
                paddingTop: '0.65rem',
                fontSize: '0.95rem',
              }}
            >
              <div style={{ fontWeight: 500 }}>{line.title}</div>
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                qty {line.quantity} · fulfilled {line.qtyFulfilled}/{line.qtyOrdered}
                {' · '}
                {formatMoney(line.unitAmountMinor * line.quantity, line.currency)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      {canAct ? (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {ACTIONS.map(({ status, label }) => (
            <button
              key={status}
              type="button"
              disabled={busy !== null}
              onClick={() => void applyStatus(status)}
              style={{
                padding: '0.5rem 0.85rem',
                cursor: busy !== null ? 'wait' : 'pointer',
                border:
                  status === 'cancelled'
                    ? '1px solid #b91c1c'
                    : '1px solid #57534e',
                background: status === 'cancelled' ? 'transparent' : '#1c1917',
                color: status === 'cancelled' ? '#b91c1c' : '#fafaf9',
                borderRadius: 4,
                opacity: busy !== null && busy !== status ? 0.55 : 1,
              }}
            >
              {busy === status ? 'Saving…' : label}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, opacity: 0.75, fontSize: '0.9rem' }}>
          This order is {order.status}; no further status changes.
        </p>
      )}
    </div>
  );
}
