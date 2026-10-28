'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Cart } from '@ecom/sdk-api';
import {
  fetchCurrentCart,
  formatMoney,
  removeCartLine,
  updateCartLine,
} from '../lib/api';

export function CartView({ locale }: { locale: string }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchCurrentCart()
      .then((data) => {
        if (!cancelled) setCart(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total =
    cart?.lines.reduce((sum, l) => sum + l.unitAmountMinor * l.quantity, 0) ?? 0;
  const currency = cart?.lines[0]?.currency ?? 'USD';

  return (
    <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
      <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>
        Your cart
      </h1>
      {error && <p style={{ color: '#ff8e8e' }}>{error}</p>}
      {!cart || cart.lines.length === 0 ? (
        <p style={{ opacity: 0.8 }}>Cart is empty.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0' }}>
          {cart.lines.map((line) => (
            <li
              key={line.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.75rem',
                padding: '0.85rem 0',
                borderBottom: '1px solid #3a4a5c',
              }}
            >
              <div>
                <div>{line.title ?? 'Item'}</div>
                <div style={{ opacity: 0.75, fontSize: '0.9rem' }}>
                  {formatMoney(line.unitAmountMinor, line.currency)} ×{' '}
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    disabled={pending}
                    onChange={(e) => {
                      const quantity = Number(e.target.value);
                      startTransition(async () => {
                        try {
                          const next = await updateCartLine(cart.id, line.id, quantity);
                          setCart(next);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Update failed');
                        }
                      });
                    }}
                    style={{
                      width: 56,
                      marginLeft: 4,
                      padding: '0.2rem 0.35rem',
                      background: '#1a2430',
                      color: 'inherit',
                      border: '1px solid #3a4a5c',
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const next = await removeCartLine(cart.id, line.id);
                      setCart(next);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Remove failed');
                    }
                  });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff8e8e',
                  cursor: 'pointer',
                  alignSelf: 'start',
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {cart && cart.lines.length > 0 && (
        <p style={{ fontVariantNumeric: 'tabular-nums' }}>
          Subtotal {formatMoney(total, currency)}
        </p>
      )}
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.5rem' }}>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          Continue shopping
        </Link>
        <Link href={`/${locale}/checkout`} style={{ color: '#9ec1ff' }}>
          Checkout
        </Link>
      </div>
    </section>
  );
}
