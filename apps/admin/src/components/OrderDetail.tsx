'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AdminOrderDetail,
  AdminOrderStatusUpdate,
} from '@ecom/sdk-api';
import {
  createAdminFulfillment,
  formatMoney,
  updateAdminFulfillment,
  updateAdminOrderStatus,
} from '../lib/api';

type OrderDetailProps = {
  initial: AdminOrderDetail;
};

const SHORTCUTS: { status: AdminOrderStatusUpdate; label: string }[] = [
  { status: 'fulfilled', label: 'Fulfill remaining' },
  { status: 'shipped', label: 'Ship remaining' },
  { status: 'cancelled', label: 'Cancel order' },
];

export function OrderDetail({ initial }: OrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [markShipped, setMarkShipped] = useState(true);
  const [qtyByLine, setQtyByLine] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initial.lines.map((line) => {
        const remaining = Math.max(
          0,
          line.qtyOrdered - line.qtyFulfilled - (line.qtyRefunded ?? 0),
        );
        return [line.id, remaining];
      }),
    ),
  );
  const [trackingEdits, setTrackingEdits] = useState<
    Record<string, { trackingNumber: string; carrier: string }>
  >({});

  const canFulfill =
    order.status === 'placed' ||
    order.status === 'pending' ||
    order.status === 'partially_fulfilled';

  const remainingByLine = useMemo(
    () =>
      Object.fromEntries(
        order.lines.map((line) => [
          line.id,
          Math.max(
            0,
            line.qtyOrdered - line.qtyFulfilled - (line.qtyRefunded ?? 0),
          ),
        ]),
      ),
    [order.lines],
  );

  const selectedLines = useMemo(
    () =>
      order.lines
        .map((line) => ({
          orderLineId: line.id,
          qty: Math.min(
            Math.max(0, Number(qtyByLine[line.id] ?? 0) || 0),
            remainingByLine[line.id] ?? 0,
          ),
        }))
        .filter((line) => line.qty > 0),
    [order.lines, qtyByLine, remainingByLine],
  );

  const hasRemaining = Object.values(remainingByLine).some((q) => q > 0);

  function syncOrder(updated: AdminOrderDetail) {
    setOrder(updated);
    setQtyByLine(
      Object.fromEntries(
        updated.lines.map((line) => {
          const remaining = Math.max(
            0,
            line.qtyOrdered - line.qtyFulfilled - (line.qtyRefunded ?? 0),
          );
          return [line.id, remaining];
        }),
      ),
    );
    router.refresh();
  }

  async function applyStatus(status: AdminOrderStatusUpdate) {
    setError(null);
    setBusy(`status:${status}`);
    try {
      const updated = await updateAdminOrderStatus(
        order.id,
        status,
        status === 'cancelled'
          ? undefined
          : {
              trackingNumber: trackingNumber.trim() || null,
              trackingCarrier: carrier.trim() || null,
            },
      );
      setTrackingNumber('');
      setCarrier('');
      syncOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function createShipment() {
    if (selectedLines.length === 0) {
      setError('Select at least one line quantity to ship');
      return;
    }
    setError(null);
    setBusy('create');
    try {
      const updated = await createAdminFulfillment(order.id, {
        lines: selectedLines,
        trackingNumber: trackingNumber.trim() || null,
        carrier: carrier.trim() || null,
        markShipped,
      });
      setTrackingNumber('');
      setCarrier('');
      syncOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fulfillment failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveTracking(fulfillmentId: string) {
    const edit = trackingEdits[fulfillmentId] ?? {
      trackingNumber: '',
      carrier: '',
    };
    setError(null);
    setBusy(`track:${fulfillmentId}`);
    try {
      const updated = await updateAdminFulfillment(order.id, fulfillmentId, {
        trackingNumber: edit.trackingNumber.trim() || null,
        carrier: edit.carrier.trim() || null,
        status: 'shipped',
      });
      setTrackingEdits((prev) => {
        const next = { ...prev };
        delete next[fulfillmentId];
        return next;
      });
      syncOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tracking update failed');
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
          {order.shippingAmountMinor > 0 || order.shippingMethodName ? (
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', opacity: 0.75 }}>
              incl. shipping{' '}
              {formatMoney(order.shippingAmountMinor, order.chargeCurrency)}
              {order.shippingMethodName ? ` (${order.shippingMethodName})` : ''}
            </p>
          ) : null}
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
            <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Shipping address</dt>
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
        {order.shippingMethodName ? (
          <div>
            <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Shipping method</dt>
            <dd style={{ margin: 0 }}>{order.shippingMethodName}</dd>
          </div>
        ) : null}
        {order.trackingNumber ? (
          <div>
            <dt style={{ opacity: 0.7, fontSize: '0.85rem' }}>Latest tracking</dt>
            <dd style={{ margin: 0 }}>
              <code>{order.trackingNumber}</code>
              {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Lines</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.65rem' }}>
          {order.lines.map((line) => {
            const remaining = remainingByLine[line.id] ?? 0;
            return (
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
                  ordered {line.qtyOrdered} · fulfilled {line.qtyFulfilled}
                  {' · '}
                  remaining {remaining}
                  {' · '}
                  {formatMoney(line.unitAmountMinor * line.quantity, line.currency)}
                </div>
                {canFulfill && remaining > 0 ? (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.45rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    Ship qty
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={qtyByLine[line.id] ?? 0}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setQtyByLine((prev) => ({
                          ...prev,
                          [line.id]: Number.isFinite(next) ? next : 0,
                        }));
                      }}
                      style={{ width: '4.5rem', padding: '0.25rem 0.4rem' }}
                    />
                    <span style={{ opacity: 0.65 }}>/ {remaining}</span>
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {(order.fulfillments?.length ?? 0) > 0 ? (
        <section>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Shipments</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.85rem' }}>
            {order.fulfillments.map((f, index) => {
              const edit = trackingEdits[f.id] ?? {
                trackingNumber: f.trackingNumber ?? '',
                carrier: f.carrier ?? '',
              };
              return (
                <li
                  key={f.id}
                  style={{
                    borderTop: '1px solid #cfc8bc',
                    paddingTop: '0.75rem',
                    display: 'grid',
                    gap: '0.45rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <strong>Shipment {index + 1}</strong>
                    <span style={{ opacity: 0.75 }}>{f.status}</span>
                  </div>
                  <div style={{ opacity: 0.85, fontSize: '0.9rem' }}>
                    {f.lines.map((l) => `${l.title} × ${l.qty}`).join(' · ')}
                  </div>
                  {f.trackingNumber || f.carrier ? (
                    <div style={{ fontSize: '0.9rem' }}>
                      {f.carrier ? `${f.carrier} · ` : ''}
                      {f.trackingNumber ? (
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {f.trackingNumber}
                        </span>
                      ) : (
                        'No tracking'
                      )}
                      {f.shippedAt
                        ? ` · shipped ${new Date(f.shippedAt).toLocaleString()}`
                        : null}
                    </div>
                  ) : null}
                  {f.status !== 'cancelled' ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginTop: '0.25rem',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Carrier"
                        value={edit.carrier}
                        onChange={(e) =>
                          setTrackingEdits((prev) => ({
                            ...prev,
                            [f.id]: { ...edit, carrier: e.target.value },
                          }))
                        }
                        style={{ padding: '0.35rem 0.5rem', minWidth: '7rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Tracking number"
                        value={edit.trackingNumber}
                        onChange={(e) =>
                          setTrackingEdits((prev) => ({
                            ...prev,
                            [f.id]: {
                              ...edit,
                              trackingNumber: e.target.value,
                            },
                          }))
                        }
                        style={{ padding: '0.35rem 0.5rem', minWidth: '10rem', flex: 1 }}
                      />
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void saveTracking(f.id)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          cursor: busy !== null ? 'wait' : 'pointer',
                          border: '1px solid #57534e',
                          background: '#fafaf9',
                          color: '#1c1917',
                          borderRadius: 4,
                        }}
                      >
                        {busy === `track:${f.id}` ? 'Saving…' : 'Save tracking'}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      {canFulfill && hasRemaining ? (
        <section
          style={{
            display: 'grid',
            gap: '0.75rem',
            borderTop: '1px solid #cfc8bc',
            paddingTop: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Create shipment</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
            Choose line quantities above, then create a shipment. You can split
            an order across multiple shipments. Leave tracking blank on
            aggregator stub methods to mint a number.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Carrier (optional)"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              style={{ padding: '0.4rem 0.55rem', minWidth: '8rem' }}
            />
            <input
              type="text"
              placeholder="Tracking number (optional)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              style={{ padding: '0.4rem 0.55rem', minWidth: '12rem', flex: 1 }}
            />
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.9rem',
            }}
          >
            <input
              type="checkbox"
              checked={markShipped}
              onChange={(e) => setMarkShipped(e.target.checked)}
            />
            Mark shipment as shipped
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy !== null || selectedLines.length === 0}
              onClick={() => void createShipment()}
              style={{
                padding: '0.5rem 0.85rem',
                cursor:
                  busy !== null || selectedLines.length === 0
                    ? 'wait'
                    : 'pointer',
                border: '1px solid #57534e',
                background: '#1c1917',
                color: '#fafaf9',
                borderRadius: 4,
                opacity: busy !== null || selectedLines.length === 0 ? 0.55 : 1,
              }}
            >
              {busy === 'create' ? 'Creating…' : 'Create shipment'}
            </button>
            {SHORTCUTS.map(({ status, label }) => (
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
                  background: status === 'cancelled' ? 'transparent' : '#fafaf9',
                  color: status === 'cancelled' ? '#b91c1c' : '#1c1917',
                  borderRadius: 4,
                  opacity: busy !== null && busy !== `status:${status}` ? 0.55 : 1,
                }}
              >
                {busy === `status:${status}` ? 'Saving…' : label}
              </button>
            ))}
          </div>
        </section>
      ) : canFulfill && !hasRemaining ? (
        <p style={{ margin: 0, opacity: 0.75, fontSize: '0.9rem' }}>
          All line quantities are fulfilled.
        </p>
      ) : (
        <p style={{ margin: 0, opacity: 0.75, fontSize: '0.9rem' }}>
          This order is {order.status}; no further fulfillments.
        </p>
      )}
    </div>
  );
}
