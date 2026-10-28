'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { UpgradeRequiredError } from '@ecom/sdk-api';
import {
  ApiError,
  changeBillingPlan,
  createStripeBillingCheckout,
  createStripeBillingPortal,
  type PlanView,
  type TenantBillingSnapshot,
} from '../lib/api';
import { UpgradePrompt } from './UpgradePrompt';
import { UsageMeters } from './UsageMeters';

type PlansPanelProps = {
  initialUsage: TenantBillingSnapshot;
  plans: PlanView[];
};

function entitlementLabel(key: string): string {
  switch (key) {
    case 'max_products':
      return 'Products';
    case 'max_staff':
      return 'Staff seats';
    case 'max_locales':
      return 'Languages';
    case 'soft_max_orders_month':
      return 'Orders / month (soft)';
    case 'feature_b2b':
      return 'B2B';
    default:
      return key;
  }
}

function formatEntitlement(key: string, value: string): string {
  if (key === 'feature_b2b') return value === '1' ? 'Yes' : 'No';
  if (value === '-1') return 'Unlimited';
  return value;
}

export function PlansPanel({ initialUsage, plans }: PlansPanelProps) {
  const [usage, setUsage] = useState(initialUsage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeRequiredError | null>(null);

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder),
    [plans],
  );

  async function onChangePlan(planCode: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setUpgrade(null);
    try {
      const next = await changeBillingPlan(planCode);
      setUsage(next);
      setMessage(`Plan switched to ${next.plan.name} (local demo — no Stripe charge).`);
    } catch (err) {
      if (err instanceof ApiError && err.upgradeRequired) {
        setUpgrade(err.upgradeRequired);
      } else {
        setError(err instanceof Error ? err.message : 'Plan change failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onStripeCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const planCode = String(form.get('planCode') || '');
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const origin = window.location.origin;
      const result = await createStripeBillingCheckout({
        planCode,
        successUrl: `${origin}/plans?billing=success`,
        cancelUrl: `${origin}/plans?billing=cancel`,
      });
      setMessage(`${result.message} Opening stub URL…`);
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout stub failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPortal() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createStripeBillingPortal(
        `${window.location.origin}/plans`,
      );
      setMessage(result.message);
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portal stub failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '2rem', marginTop: '1.5rem' }}>
      <UsageMeters
        meters={usage.meters}
        softWarnings={usage.softWarnings}
        planName={usage.plan.name}
        planCode={usage.plan.code}
      />

      {upgrade ? (
        <UpgradePrompt error={upgrade} onDismiss={() => setUpgrade(null)} />
      ) : null}
      {error ? (
        <p role="alert" style={{ color: '#9f1239', margin: 0 }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" style={{ margin: 0, opacity: 0.85 }}>
          {message}
        </p>
      ) : null}

      <section>
        <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>Compare plans</h2>
        <p style={{ marginTop: '0.35rem', opacity: 0.75, maxWidth: 560 }}>
          Hard limits block products, staff seats, and languages with an upgrade
          prompt. Orders/month is a soft warning only.
        </p>
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            marginTop: '1rem',
          }}
        >
          {sorted.map((plan) => {
            const current = plan.code === usage.plan.code;
            return (
              <div
                key={plan.id}
                style={{
                  border: current ? '2px solid #44403c' : '1px solid #d6d3d1',
                  padding: '1rem',
                  borderRadius: 4,
                  display: 'grid',
                  gap: '0.65rem',
                  alignContent: 'start',
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{plan.name}</strong>
                  {current ? (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                      Current
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                  {plan.description}
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
                  {Object.entries(plan.entitlements).map(([key, value]) => (
                    <li key={key}>
                      {entitlementLabel(key)}: {formatEntitlement(key, value)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy || current}
                  onClick={() => void onChangePlan(plan.code)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: busy || current ? 'default' : 'pointer',
                    border: '1px solid #a8a29e',
                    background: current ? '#f5f5f4' : 'transparent',
                    borderRadius: 4,
                  }}
                >
                  {current ? 'Current plan' : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          borderTop: '1px solid #cfc8bc',
          paddingTop: '1.5rem',
          display: 'grid',
          gap: '0.75rem',
          maxWidth: 480,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Stripe Billing (stub)</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
          Optional merchant←platform subscription. Commerce checkout stays on COD /
          bank transfer. Stub returns placeholder URLs until{' '}
          <code>STRIPE_BILLING_SECRET_KEY</code> is set.
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
          Configured: {usage.stripeBillingConfigured ? 'yes' : 'no (stub mode)'}
        </p>
        <form
          onSubmit={(e) => void onStripeCheckout(e)}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <select
            name="planCode"
            defaultValue={usage.plan.code === 'starter' ? 'growth' : usage.plan.code}
            style={{ padding: '0.5rem' }}
          >
            {sorted.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '0.5rem 0.75rem',
              cursor: busy ? 'default' : 'pointer',
              border: '1px solid #a8a29e',
              background: 'transparent',
              borderRadius: 4,
            }}
          >
            Stub Checkout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPortal()}
            style={{
              padding: '0.5rem 0.75rem',
              cursor: busy ? 'default' : 'pointer',
              border: '1px solid #a8a29e',
              background: 'transparent',
              borderRadius: 4,
            }}
          >
            Stub Customer Portal
          </button>
        </form>
      </section>
    </div>
  );
}
