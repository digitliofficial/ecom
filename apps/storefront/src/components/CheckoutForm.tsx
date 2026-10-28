'use client';

import {
  useEffect,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import type {
  AuthUser,
  CheckoutSessionResult,
  OfflinePaymentMethod,
  StorefrontPaymentMethod,
} from '@ecom/sdk-api';
import { checkout, formatMoney, listPaymentMethods } from '../lib/api';
import { fetchCustomerMe } from '../lib/auth';

export function CheckoutForm({ locale }: { locale: string }) {
  const [result, setResult] = useState<CheckoutSessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<AuthUser | null>(null);
  const [methods, setMethods] = useState<StorefrontPaymentMethod[]>([]);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<OfflinePaymentMethod | ''>(
    '',
  );

  useEffect(() => {
    let cancelled = false;
    fetchCustomerMe().then((me) => {
      if (!cancelled) setCustomer(me);
    });
    listPaymentMethods()
      .then((list) => {
        if (cancelled) return;
        setMethods(list);
        if (list.length === 1) setPaymentMethod(list[0]!.id);
        else if (list.some((m) => m.id === 'cod')) setPaymentMethod('cod');
        else if (list[0]) setPaymentMethod(list[0].id);
      })
      .catch((err: Error) => {
        if (!cancelled) setMethodsError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentMethod) {
      setError('Select a payment method');
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const discountRaw = String(fd.get('discountCode') ?? '').trim();
        const session = await checkout({
          email: String(fd.get('email') ?? ''),
          shippingAddress: {
            line1: String(fd.get('line1') ?? ''),
            line2: String(fd.get('line2') ?? '') || undefined,
            city: String(fd.get('city') ?? ''),
            region: String(fd.get('region') ?? '') || undefined,
            postalCode: String(fd.get('postalCode') ?? '') || undefined,
            country: String(fd.get('country') ?? 'PK'),
          },
          paymentMethod,
          discountCode: discountRaw || undefined,
        });
        setResult(session);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Checkout failed');
      }
    });
  }

  if (result) {
    const instructions = result.bankTransferInstructions;
    return (
      <section style={{ maxWidth: 560, paddingTop: '2rem' }}>
        <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500 }}>
          Order placed
        </h1>
        <p style={{ opacity: 0.85 }}>
          Order <code>{result.order.id}</code> is{' '}
          <strong>{result.order.status}</strong> (
          {result.order.paymentMethod} · {result.order.paymentStatus}). Total{' '}
          {formatMoney(result.order.totalAmountMinor, result.order.currency)}
          {result.order.discountCode
            ? ` (coupon ${result.order.discountCode} saved ${formatMoney(result.order.discountAmountMinor ?? 0, result.order.currency)})`
            : ''}
          .
        </p>
        {result.order.paymentMethod === 'cod' && (
          <p style={{ opacity: 0.85 }}>
            Pay cash on delivery when your order arrives. Payment status is{' '}
            <code>pending_cod</code>.
          </p>
        )}
        {instructions && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              border: '1px solid #3a4a5c',
              borderRadius: 4,
              background: '#15202b',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
              Bank transfer instructions
            </h2>
            <p style={{ margin: '0 0 0.75rem', opacity: 0.85, fontSize: '0.95rem' }}>
              Transfer the order total and keep your reference. Status is{' '}
              <code>pending_transfer</code> until the merchant confirms.
            </p>
            <dl style={{ margin: 0, display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
              <div>
                <dt style={{ opacity: 0.7, fontSize: '0.8rem' }}>Account name</dt>
                <dd style={{ margin: 0 }}>{instructions.accountName}</dd>
              </div>
              <div>
                <dt style={{ opacity: 0.7, fontSize: '0.8rem' }}>IBAN / account #</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                  {instructions.accountNumber}
                </dd>
              </div>
              <div>
                <dt style={{ opacity: 0.7, fontSize: '0.8rem' }}>Bank</dt>
                <dd style={{ margin: 0 }}>{instructions.bankName}</dd>
              </div>
            </dl>
          </div>
        )}
        {result.addressValidation.warnings.length > 0 && (
          <p style={{ color: '#f0c674' }}>
            Address soft-warn: {result.addressValidation.warnings.join(', ')}
          </p>
        )}
        <Link href={`/${locale}`} style={{ color: '#9ec1ff', display: 'inline-block', marginTop: '1rem' }}>
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
      <p style={{ opacity: 0.75, marginTop: '0.5rem' }}>
        {customer
          ? `Account checkout as ${customer.email}. Guest email still accepted if you change it.`
          : 'Guest checkout — or sign in from the header for an account path (guest cart links on login).'}
      </p>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}
      >
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            defaultValue={customer?.email ?? ''}
            placeholder="guest@example.com"
            style={field}
          />
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
            <input name="city" required placeholder="Karachi" style={field} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Region</span>
            <input name="region" placeholder="Sindh" style={field} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Postal code</span>
            <input name="postalCode" placeholder="75500" style={field} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Country</span>
            <input name="country" required defaultValue="PK" style={field} />
          </label>
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Discount code (optional)</span>
          <input
            name="discountCode"
            placeholder="SAVE10"
            autoComplete="off"
            style={field}
          />
        </label>

        <fieldset
          style={{
            margin: 0,
            padding: '0.85rem 1rem',
            border: '1px solid #3a4a5c',
            borderRadius: 4,
          }}
        >
          <legend style={{ padding: '0 0.35rem' }}>Payment method</legend>
          {methodsError && (
            <p style={{ color: '#ff8e8e', margin: '0 0 0.5rem' }}>{methodsError}</p>
          )}
          {!methodsError && methods.length === 0 && (
            <p style={{ opacity: 0.75, margin: 0 }}>
              No payment methods enabled. Ask the merchant to enable COD or bank
              transfer in admin.
            </p>
          )}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {methods.map((m) => (
              <label
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.id}
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  <strong style={{ fontWeight: 600 }}>{m.label}</strong>
                  {m.id === 'bank_transfer' && 'bankDetails' in m && (
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.85rem' }}>
                      {m.bankDetails.bankName} · {m.bankDetails.accountNumber}
                    </span>
                  )}
                  {m.id === 'cod' && (
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.85rem' }}>
                      Pay when the order is delivered
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p style={{ color: '#ff8e8e' }}>{error}</p>}
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          Offline payments only (COD / bank transfer). Stripe stays optional and
          off by default.
        </p>
        <button
          type="submit"
          disabled={pending || !paymentMethod}
          style={{
            background: '#3d8bfd',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            cursor: pending || !paymentMethod ? 'wait' : 'pointer',
            justifySelf: 'start',
            opacity: !paymentMethod ? 0.6 : 1,
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
