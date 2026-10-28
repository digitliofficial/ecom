'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { TenantLocalizationSettings } from '@ecom/sdk-api';
import {
  getAdminLocalizationSettings,
  updateAdminLocalizationSettings,
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

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.65rem 1rem',
};

export function LocalizationSettingsForm() {
  const [settings, setSettings] = useState<TenantLocalizationSettings | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminLocalizationSettings()
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

  function toggleLocale(locale: string, checked: boolean) {
    if (!settings) return;
    if (locale === settings.defaultLocale && !checked) return;
    const enabledLocales = checked
      ? [...new Set([...settings.enabledLocales, locale])]
      : settings.enabledLocales.filter((l) => l !== locale);
    setSettings({ ...settings, enabledLocales });
  }

  function toggleCurrency(currency: string, checked: boolean) {
    if (!settings) return;
    if (currency === settings.defaultCurrency && !checked) return;
    const enabledCurrencies = checked
      ? [...new Set([...settings.enabledCurrencies, currency])]
      : settings.enabledCurrencies.filter((c) => c !== currency);
    setSettings({ ...settings, enabledCurrencies });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const updated = await updateAdminLocalizationSettings({
        defaultLocale: settings.defaultLocale,
        defaultCurrency: settings.defaultCurrency,
        multiLanguage: settings.multiLanguage,
        multiCurrency: settings.multiCurrency,
        enabledLocales: settings.enabledLocales,
        enabledCurrencies: settings.enabledCurrencies,
        fxRounding: settings.fxRounding,
        fxDisclaimer: settings.fxDisclaimer,
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
    return (
      <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading localization…</p>
    );
  }

  if (!settings) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load localization settings ({error ?? 'unknown'}). Is the API
        on :3001 with schema applied (`pnpm db:apply`)?
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: '1.15rem', marginTop: '1.25rem', maxWidth: 520 }}
    >
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Default locale</span>
        <select
          value={settings.defaultLocale}
          onChange={(e) => {
            const defaultLocale = e.target.value;
            const enabledLocales = settings.enabledLocales.includes(defaultLocale)
              ? settings.enabledLocales
              : [...settings.enabledLocales, defaultLocale];
            setSettings({ ...settings, defaultLocale, enabledLocales });
          }}
          style={field}
        >
          {settings.availableLocales.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          Default currency (charge)
        </span>
        <select
          value={settings.defaultCurrency}
          onChange={(e) => {
            const defaultCurrency = e.target.value;
            const enabledCurrencies = settings.enabledCurrencies.includes(
              defaultCurrency,
            )
              ? settings.enabledCurrencies
              : [...settings.enabledCurrencies, defaultCurrency];
            setSettings({ ...settings, defaultCurrency, enabledCurrencies });
          }}
          style={field}
        >
          {settings.availableCurrencies.map((cur) => (
            <option key={cur} value={cur}>
              {cur}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={settings.multiLanguage}
          onChange={(e) =>
            setSettings({ ...settings, multiLanguage: e.target.checked })
          }
        />
        <span>Enable multi-language</span>
      </label>

      <fieldset
        disabled={!settings.multiLanguage}
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          border: '1px solid #cfc8bc',
          borderRadius: 4,
          opacity: settings.multiLanguage ? 1 : 0.55,
        }}
      >
        <legend>
          Enabled locales ({settings.enabledLocales.length}/{settings.maxLocales})
        </legend>
        <div style={chipRow}>
          {settings.availableLocales.map((loc) => {
            const checked = settings.enabledLocales.includes(loc);
            const locked = loc === settings.defaultLocale;
            return (
              <label
                key={loc}
                style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => toggleLocale(loc, e.target.checked)}
                />
                <span>
                  {loc}
                  {locked ? ' (default)' : ''}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={settings.multiCurrency}
          onChange={(e) =>
            setSettings({ ...settings, multiCurrency: e.target.checked })
          }
        />
        <span>Enable multi-currency (display)</span>
      </label>

      <fieldset
        disabled={!settings.multiCurrency}
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          border: '1px solid #cfc8bc',
          borderRadius: 4,
          opacity: settings.multiCurrency ? 1 : 0.55,
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <legend>
          Enabled currencies ({settings.enabledCurrencies.length}/
          {settings.maxCurrencies})
        </legend>
        <div style={chipRow}>
          {settings.availableCurrencies.map((cur) => {
            const checked = settings.enabledCurrencies.includes(cur);
            const locked = cur === settings.defaultCurrency;
            return (
              <label
                key={cur}
                style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => toggleCurrency(cur, e.target.checked)}
                />
                <span>
                  {cur}
                  {locked ? ' (charge)' : ''}
                </span>
              </label>
            );
          })}
        </div>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            Display FX disclaimer
          </span>
          <textarea
            value={settings.fxDisclaimer ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, fxDisclaimer: e.target.value })
            }
            rows={2}
            style={{ ...field, resize: 'vertical' }}
          />
        </label>
      </fieldset>

      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p style={{ color: '#166534', margin: 0 }}>
          Saved localization settings.
        </p>
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
