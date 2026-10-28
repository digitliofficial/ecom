'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type {
  InventoryLevel,
  InventoryLocation,
  Product,
} from '@ecom/sdk-api';
import {
  createAdminLocation,
  listAdminInventoryLevels,
  listAdminLocations,
  listAdminProducts,
  setAdminInventoryLevel,
} from '../lib/api';

export function InventoryManager() {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [locName, setLocName] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locDefault, setLocDefault] = useState(false);

  const [stockLocationId, setStockLocationId] = useState('');
  const [stockVariantId, setStockVariantId] = useState('');
  const [stockQty, setStockQty] = useState('0');

  const reload = useCallback(async () => {
    const [locs, lvls, prods] = await Promise.all([
      listAdminLocations(),
      listAdminInventoryLevels(),
      listAdminProducts(),
    ]);
    setLocations(locs);
    setLevels(lvls);
    setProducts(prods);
    setStockLocationId((current) => current || locs[0]?.id || '');
    setStockVariantId((current) => {
      if (current) return current;
      return prods[0]?.variants[0]?.id ?? '';
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function onCreateLocation(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createAdminLocation({
        name: locName.trim(),
        code: locCode.trim().toUpperCase(),
        isDefault: locDefault,
      });
      setLocName('');
      setLocCode('');
      setLocDefault(false);
      setMessage('Location created');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onSetStock(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await setAdminInventoryLevel({
        locationId: stockLocationId,
        variantId: stockVariantId,
        quantity: Number(stockQty),
      });
      setMessage('Stock updated');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock update failed');
    } finally {
      setSaving(false);
    }
  }

  const field = {
    padding: '0.55rem 0.7rem',
    borderRadius: 4,
    border: '1px solid #a8a29e',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  const variants = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      label: `${p.title} · ${v.sku}`,
    })),
  );

  if (loading) {
    return (
      <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading inventory…</p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '2rem', marginTop: '1.5rem' }}>
      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p style={{ color: '#166534', margin: 0 }}>{message}</p>
      )}

      <section>
        <h3 style={{ margin: '0 0 0.75rem' }}>Locations</h3>
        {!locations.length && (
          <p style={{ opacity: 0.75 }}>No locations yet.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.65rem' }}>
          {locations.map((loc) => (
            <li
              key={loc.id}
              style={{ borderTop: '1px solid #cfc8bc', paddingTop: '0.65rem' }}
            >
              <strong>{loc.name}</strong>{' '}
              <span style={{ opacity: 0.75 }}>
                ({loc.code}
                {loc.isDefault ? ' · default' : ''}
                {!loc.active ? ' · inactive' : ''})
              </span>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => void onCreateLocation(e)}
          style={{
            display: 'grid',
            gap: '0.65rem',
            marginTop: '1rem',
            maxWidth: 420,
          }}
        >
          <h4 style={{ margin: 0 }}>Add location</h4>
          <input
            required
            placeholder="Name"
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            style={field}
          />
          <input
            required
            placeholder="Code (e.g. STORE)"
            value={locCode}
            onChange={(e) => setLocCode(e.target.value.toUpperCase())}
            style={field}
          />
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={locDefault}
              onChange={(e) => setLocDefault(e.target.checked)}
            />
            Set as default
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{
              justifySelf: 'start',
              padding: '0.55rem 0.9rem',
              cursor: saving ? 'wait' : 'pointer',
              border: '1px solid #44403c',
              background: '#292524',
              color: '#fafaf9',
              borderRadius: 4,
            }}
          >
            Create location
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ margin: '0 0 0.75rem' }}>Edit stock</h3>
        <form
          onSubmit={(e) => void onSetStock(e)}
          style={{ display: 'grid', gap: '0.65rem', maxWidth: 480 }}
        >
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Location</span>
            <select
              required
              value={stockLocationId}
              onChange={(e) => setStockLocationId(e.target.value)}
              style={field}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Variant</span>
            <select
              required
              value={stockVariantId}
              onChange={(e) => setStockVariantId(e.target.value)}
              style={field}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Quantity</span>
            <input
              required
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              style={field}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !stockLocationId || !stockVariantId}
            style={{
              justifySelf: 'start',
              padding: '0.55rem 0.9rem',
              cursor: saving ? 'wait' : 'pointer',
              border: '1px solid #44403c',
              background: '#292524',
              color: '#fafaf9',
              borderRadius: 4,
            }}
          >
            Set stock
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ margin: '0 0 0.75rem' }}>Stock levels</h3>
        {!levels.length && (
          <p style={{ opacity: 0.75 }}>No inventory levels yet.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.55rem' }}>
          {levels.map((level) => (
            <li
              key={level.id}
              style={{
                borderTop: '1px solid #cfc8bc',
                paddingTop: '0.55rem',
                fontSize: '0.95rem',
              }}
            >
              <strong>{level.productTitle}</strong> · {level.sku} @{' '}
              {level.locationCode}: <strong>{level.quantity}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
