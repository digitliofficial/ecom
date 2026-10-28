'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { TenantNotificationSettings } from '@ecom/sdk-api';
import {
  getAdminNotificationSettings,
  processAdminNotifications,
  updateAdminNotificationSettings,
} from '../lib/api';

const field: CSSProperties = {
  padding: '0.55rem 0.65rem',
  borderRadius: 4,
  border: '1px solid #a8a29e',
  background: '#fff',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<TenantNotificationSettings | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminNotificationSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const updated = await updateAdminNotificationSettings({
        orderPlacedCustomer: settings.orderPlacedCustomer,
        orderPlacedMerchant: settings.orderPlacedMerchant,
        orderShippedCustomer: settings.orderShippedCustomer,
        orderCancelledCustomer: settings.orderCancelledCustomer,
        abandonedCartEnabled: settings.abandonedCartEnabled,
        abandonedCartIdleMinutes: settings.abandonedCartIdleMinutes,
        merchantAlertEmail: settings.merchantAlertEmail,
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onProcess() {
    setProcessMsg(null);
    setError(null);
    setBusy(true);
    try {
      const result = await processAdminNotifications();
      setProcessMsg(
        `Processed — abandoned queued: ${result.abandonedQueued}, emails sent: ${result.emailsSent}. Check Nest API console for EMAIL blocks.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Process failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading notifications…</p>
    );
  }

  if (!settings) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load notification settings ({error ?? 'unknown'}). Is the API
        on :3001 with schema applied (`pnpm db:apply`)?
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem', maxWidth: 520 }}
    >
      <fieldset style={{ border: '1px solid #d6d3d1', borderRadius: 4, padding: '0.75rem 1rem' }}>
        <legend style={{ padding: '0 0.35rem' }}>Order lifecycle</legend>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={settings.orderPlacedCustomer}
            onChange={(e) =>
              setSettings({ ...settings, orderPlacedCustomer: e.target.checked })
            }
          />
          <span>Customer: order placed</span>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={settings.orderPlacedMerchant}
            onChange={(e) =>
              setSettings({ ...settings, orderPlacedMerchant: e.target.checked })
            }
          />
          <span>Merchant alert: new order</span>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={settings.orderShippedCustomer}
            onChange={(e) =>
              setSettings({ ...settings, orderShippedCustomer: e.target.checked })
            }
          />
          <span>Customer: shipped / fulfilled</span>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={settings.orderCancelledCustomer}
            onChange={(e) =>
              setSettings({
                ...settings,
                orderCancelledCustomer: e.target.checked,
              })
            }
          />
          <span>Customer: cancelled</span>
        </label>
      </fieldset>

      <fieldset style={{ border: '1px solid #d6d3d1', borderRadius: 4, padding: '0.75rem 1rem' }}>
        <legend style={{ padding: '0 0.35rem' }}>Abandoned cart</legend>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={settings.abandonedCartEnabled}
            onChange={(e) =>
              setSettings({ ...settings, abandonedCartEnabled: e.target.checked })
            }
          />
          <span>Enable abandoned-cart reminder</span>
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
          <span>Idle TTL (minutes; 0 = immediate for local demos)</span>
          <input
            type="number"
            min={0}
            max={10080}
            style={field}
            value={settings.abandonedCartIdleMinutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                abandonedCartIdleMinutes: Number(e.target.value),
              })
            }
          />
        </label>
      </fieldset>

      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Merchant alert email (defaults to owner)</span>
        <input
          type="email"
          style={field}
          value={settings.merchantAlertEmail ?? ''}
          onChange={(e) =>
            setSettings({
              ...settings,
              merchantAlertEmail: e.target.value || null,
            })
          }
          placeholder="owner@demo.localhost"
        />
      </label>

      {error ? (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p style={{ color: '#166534', margin: 0 }}>Saved.</p>
      ) : null}
      {processMsg ? (
        <p style={{ color: '#166534', margin: 0 }}>{processMsg}</p>
      ) : null}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '0.55rem 1rem',
            cursor: busy ? 'wait' : 'pointer',
            border: '1px solid #44403c',
            background: '#1c1917',
            color: '#fafaf9',
            borderRadius: 4,
          }}
        >
          {busy ? 'Working…' : 'Save settings'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onProcess()}
          style={{
            padding: '0.55rem 1rem',
            cursor: busy ? 'wait' : 'pointer',
            border: '1px solid #a8a29e',
            background: 'transparent',
            borderRadius: 4,
          }}
        >
          Run abandon scan + send now
        </button>
      </div>
    </form>
  );
}
