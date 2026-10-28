'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { ShippingMethod } from '@ecom/sdk-api';
import {
  createAdminShippingMethod,
  formatMoney,
  listAdminShippingMethods,
  updateAdminShippingMethod,
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

const emptyForm = {
  name: '',
  priceAmountMinor: 500,
  currency: 'USD',
  codCompatible: true,
  enabled: true,
  adapter: 'manual',
};

export function ShippingMethodsForm() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function reload() {
    const list = await listAdminShippingMethods();
    setMethods(list);
  }

  useEffect(() => {
    let cancelled = false;
    listAdminShippingMethods()
      .then((list) => {
        if (!cancelled) setMethods(list);
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

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createAdminShippingMethod({
        name: form.name,
        priceAmountMinor: Number(form.priceAmountMinor),
        currency: form.currency,
        codCompatible: form.codCompatible,
        enabled: form.enabled,
        adapter: form.adapter,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(method: ShippingMethod) {
    setError(null);
    setBusy(true);
    try {
      await updateAdminShippingMethod(method.id, { enabled: !method.enabled });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCod(method: ShippingMethod) {
    setError(null);
    setBusy(true);
    try {
      await updateAdminShippingMethod(method.id, {
        codCompatible: !method.codCompatible,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading shipping…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.25rem' }}>
      {error ? (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
        {methods.map((m) => (
          <li
            key={m.id}
            style={{
              borderTop: '1px solid #cfc8bc',
              paddingTop: '0.75rem',
              display: 'grid',
              gap: '0.35rem',
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {m.name}{' '}
              <span style={{ fontWeight: 400, opacity: 0.75 }}>
                · {formatMoney(m.priceAmountMinor, m.currency)}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              adapter <code>{m.adapter}</code>
              {m.codCompatible ? ' · COD ok' : ' · COD blocked'}
              {m.enabled ? '' : ' · disabled'}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleEnabled(m)}
                style={{
                  padding: '0.35rem 0.65rem',
                  cursor: busy ? 'wait' : 'pointer',
                  border: '1px solid #a8a29e',
                  background: 'transparent',
                  borderRadius: 4,
                }}
              >
                {m.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleCod(m)}
                style={{
                  padding: '0.35rem 0.65rem',
                  cursor: busy ? 'wait' : 'pointer',
                  border: '1px solid #a8a29e',
                  background: 'transparent',
                  borderRadius: 4,
                }}
              >
                {m.codCompatible ? 'Mark not COD-compatible' : 'Allow with COD'}
              </button>
            </div>
          </li>
        ))}
        {methods.length === 0 ? (
          <li style={{ opacity: 0.75 }}>No shipping methods yet — add one below.</li>
        ) : null}
      </ul>

      <form
        onSubmit={onCreate}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: 420 }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Add method</h3>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Standard shipping"
            style={field}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Price (minor units)</span>
            <input
              required
              type="number"
              min={0}
              value={form.priceAmountMinor}
              onChange={(e) =>
                setForm({ ...form, priceAmountMinor: Number(e.target.value) })
              }
              style={field}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Currency</span>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              style={field}
            />
          </label>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Adapter</span>
          <select
            value={form.adapter}
            onChange={(e) => setForm({ ...form, adapter: e.target.value })}
            style={field}
          >
            <option value="manual">manual (flat-rate)</option>
            <option value="aggregator_stub">aggregator_stub</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.codCompatible}
            onChange={(e) =>
              setForm({ ...form, codCompatible: e.target.checked })
            }
          />
          <span>COD-compatible</span>
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '0.55rem 0.85rem',
            cursor: busy ? 'wait' : 'pointer',
            border: '1px solid #57534e',
            background: '#1c1917',
            color: '#fafaf9',
            borderRadius: 4,
            justifySelf: 'start',
          }}
        >
          {busy ? 'Saving…' : 'Add shipping method'}
        </button>
      </form>
    </div>
  );
}
