'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { TenantPaymentSettings } from '@ecom/sdk-api';
import {
  getAdminPaymentSettings,
  updateAdminPaymentSettings,
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

export function PaymentSettingsForm() {
  const [settings, setSettings] = useState<TenantPaymentSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminPaymentSettings()
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
      const updated = await updateAdminPaymentSettings({
        codEnabled: settings.codEnabled,
        bankTransferEnabled: settings.bankTransferEnabled,
        bankAccountName: settings.bankAccountName,
        bankAccountNumber: settings.bankAccountNumber,
        bankName: settings.bankName,
        stripeEnabled: settings.stripeEnabled,
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading payments…</p>;
  }

  if (!settings) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load payment settings ({error ?? 'unknown'}). Is the API on
        :3001 with schema applied (`pnpm db:apply`)?
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem', maxWidth: 480 }}
    >
      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={settings.codEnabled}
          onChange={(e) =>
            setSettings({ ...settings, codEnabled: e.target.checked })
          }
        />
        <span>Enable cash on delivery (COD)</span>
      </label>

      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={settings.bankTransferEnabled}
          onChange={(e) =>
            setSettings({ ...settings, bankTransferEnabled: e.target.checked })
          }
        />
        <span>Enable bank transfer</span>
      </label>

      <fieldset
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          border: '1px solid #cfc8bc',
          borderRadius: 4,
          display: 'grid',
          gap: '0.65rem',
        }}
      >
        <legend>Bank transfer details</legend>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Account name</span>
          <input
            value={settings.bankAccountName ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, bankAccountName: e.target.value })
            }
            placeholder="Merchant Legal Name"
            style={field}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            IBAN / account #
          </span>
          <input
            value={settings.bankAccountNumber ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, bankAccountNumber: e.target.value })
            }
            placeholder="PKxx…"
            style={field}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Bank name</span>
          <input
            value={settings.bankName ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, bankName: e.target.value })
            }
            placeholder="Bank name"
            style={field}
          />
        </label>
      </fieldset>

      <label
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          opacity: 0.75,
        }}
      >
        <input
          type="checkbox"
          checked={settings.stripeEnabled}
          onChange={(e) =>
            setSettings({ ...settings, stripeEnabled: e.target.checked })
          }
        />
        <span>Enable Stripe (optional — not wired; leave off)</span>
      </label>

      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p style={{ color: '#166534', margin: 0 }}>Saved payment settings.</p>
      )}

      <button
        type="submit"
        disabled={busy}
        style={{
          justifySelf: 'start',
          padding: '0.65rem 1.1rem',
          cursor: busy ? 'wait' : 'pointer',
          border: '1px solid #57534e',
          background: '#1c1917',
          color: '#fafaf9',
          borderRadius: 4,
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
