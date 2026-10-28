'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { TenantPrivacySettings } from '@ecom/sdk-api';
import {
  getAdminPrivacySettings,
  updateAdminPrivacySettings,
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

export function PrivacySettingsForm() {
  const [settings, setSettings] = useState<TenantPrivacySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminPrivacySettings()
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
      const updated = await updateAdminPrivacySettings({
        dpaAcknowledged: settings.dpaAcknowledged,
        retentionDays: settings.retentionDays,
        privacyContactEmail: settings.privacyContactEmail,
        cookieBannerEnabled: settings.cookieBannerEnabled,
        cookieBannerLayout: settings.cookieBannerLayout,
        analyticsCategoryEnabled: settings.analyticsCategoryEnabled,
        marketingCategoryEnabled: settings.marketingCategoryEnabled,
        privacyPolicyUrl: settings.privacyPolicyUrl,
        cookiePolicyUrl: settings.cookiePolicyUrl,
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
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading privacy…</p>;
  }

  if (!settings) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load privacy settings ({error ?? 'unknown'}). Is the API on
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
          checked={settings.dpaAcknowledged}
          onChange={(e) =>
            setSettings({ ...settings, dpaAcknowledged: e.target.checked })
          }
        />
        <span>DPA acknowledged</span>
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Retention days (30–3650)
        </span>
        <input
          type="number"
          min={30}
          max={3650}
          value={settings.retentionDays}
          onChange={(e) =>
            setSettings({
              ...settings,
              retentionDays: Number(e.target.value) || 30,
            })
          }
          style={field}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Privacy contact email
        </span>
        <input
          type="email"
          value={settings.privacyContactEmail ?? ''}
          onChange={(e) =>
            setSettings({ ...settings, privacyContactEmail: e.target.value })
          }
          placeholder="privacy@merchant.example"
          style={field}
        />
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
        <legend>Cookie banner</legend>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.cookieBannerEnabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                cookieBannerEnabled: e.target.checked,
              })
            }
          />
          <span>Enable banner</span>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Layout</span>
          <select
            value={settings.cookieBannerLayout}
            onChange={(e) =>
              setSettings({
                ...settings,
                cookieBannerLayout: e.target.value as 'bottom' | 'modal',
              })
            }
            style={field}
          >
            <option value="bottom">Bottom bar</option>
            <option value="modal">Modal</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.analyticsCategoryEnabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                analyticsCategoryEnabled: e.target.checked,
              })
            }
          />
          <span>Offer analytics category</span>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.marketingCategoryEnabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                marketingCategoryEnabled: e.target.checked,
              })
            }
          />
          <span>Offer marketing category</span>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            Privacy policy URL
          </span>
          <input
            value={settings.privacyPolicyUrl ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, privacyPolicyUrl: e.target.value })
            }
            placeholder="/en/privacy"
            style={field}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            Cookie policy URL
          </span>
          <input
            value={settings.cookiePolicyUrl ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, cookiePolicyUrl: e.target.value })
            }
            placeholder="/en/privacy#cookies"
            style={field}
          />
        </label>
      </fieldset>

      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p style={{ color: '#166534', margin: 0 }}>Saved privacy settings.</p>
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
