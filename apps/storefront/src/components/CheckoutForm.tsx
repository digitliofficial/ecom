'use client';

import { useState, useTransition, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import type { CheckoutSessionResult } from '@ecom/sdk-api';
import { checkout, formatMoney } from '../lib/api';

export function CheckoutForm({ locale }: { locale: string }) {
  const [result, setResult] = useState<CheckoutSessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const session = await checkout({
          email: String(fd.get('email') ?? ''),
          shippingAddress: {
            line1: String(fd.get('line1') ?? ''),
            line2: String(fd.get('line2') ?? '') || undefined,
            city: String(fd.get('city') ?? ''),
            region: String(fd.get('region') ?? '') || undefined,
            postalCode: String(fd.get('postalCode') ?? '') || undefined,
            country: String(fd.get('country') ?? 'US'),
          },
        });
        setResult(session);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Checkout failed');
      }
    });
  }

  if (result) {
    return (
      <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
        <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>
          Order placed
        </h1>
        <p style={{ opacity: 0.85 }}>
          Order <code>{result.order.id}</code> is{' '}
          <strong>{result.order.status}</strong> ({result.order.paymentStatus}).
          Total {formatMoney(result.order.totalAmountMinor, result.order.currency)}.
        </p>
        {result.addressValidation.warnings.length > 0 && (
          <p style={{ color: '#f0c674' }}>
            Address soft-warn: {result.addressValidation.warnings.join(', ')}
          </p>
        )}
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          Payment provider returned <code>{result.payment.status}</code> via{' '}
          {result.payment.provider} — no charge was made.
        </p>
        <Link href={`/${locale}`} style={{ color: '#9ec1ff' }}>
          Back to store
        </Link>
      </section>
    );
  }

  const field: CSSProperties = {
    padding: '0.6rem 0.75rem',
    borderRadius: 4,
    border: '1px solid #3a4a5c',
    background: '#1a2430',
    color: 'inherit',
  };

  return (
    <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
      <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>
        Checkout
      </h1>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}
      >
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Email</span>
          <input name="email" type="email" required placeholder="guest@example.com" style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Address line 1</span>
          <input name="line1" required placeholder="123 Demo St" style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Address line 2</span>
          <input name="line2" placeholder="Apt (optional)" style={field} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>City</span>
            <input name="city" required placeholder="Austin" style={field} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Region</span>
            <input name="region" placeholder="TX" style={field} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Postal code</span>
            <input name="postalCode" placeholder="78701" style={field} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Country</span>
            <input name="country" required defaultValue="US" style={field} />
          </label>
        </div>
        {error && <p style={{ color: '#ff8e8e' }}>{error}</p>}
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          Places a <code>placed</code> order without charging (NoopAdapter). Address
          validation runs soft-warn via FastAPI.
        </p>
        <button
          type="submit"
          disabled={pending}
          style={{
            background: '#3d8bfd',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            cursor: pending ? 'wait' : 'pointer',
            justifySelf: 'start',
          }}
        >
          {pending ? 'Placing…' : 'Place order'}
        </button>
      </form>
      <Link href={`/${locale}/cart`} style={{ color: '#9ec1ff', display: 'inline-block', marginTop: '1rem' }}>
        Back to cart
      </Link>
    </section>
  );
}
