'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Discount, DiscountType } from '@ecom/sdk-api';
import {
  createAdminDiscount,
  deleteAdminDiscount,
  updateAdminDiscount,
} from '../lib/api';

type DiscountFormProps = {
  mode: 'create' | 'edit';
  initial?: Discount;
};

export function DiscountForm({ mode, initial }: DiscountFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<DiscountType>(initial?.type ?? 'percentage');
  const [value, setValue] = useState(String(initial?.value ?? 10));
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [minSubtotalMinor, setMinSubtotalMinor] = useState(
    String(initial?.minSubtotalMinor ?? 0),
  );
  const [usageLimit, setUsageLimit] = useState(
    initial?.usageLimit != null ? String(initial.usageLimit) : '',
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        type,
        value: Number(value),
        currency: currency.trim().toUpperCase(),
        minSubtotalMinor: Number(minSubtotalMinor || 0),
        usageLimit: usageLimit.trim() === '' ? null : Number(usageLimit),
        active,
      };
      if (mode === 'create') {
        const created = await createAdminDiscount(body);
        router.replace(`/discounts/${created.id}`);
      } else if (initial) {
        await updateAdminDiscount(initial.id, body);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial || !window.confirm(`Delete discount “${initial.code}”?`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteAdminDiscount(initial.id);
      router.replace('/discounts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
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

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      style={{ display: 'grid', gap: '0.85rem', marginTop: '1.25rem' }}
    >
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Code</span>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SAVE10"
          style={field}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={field}
        />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
            style={field}
          >
            <option value="percentage">percentage</option>
            <option value="fixed">fixed (minor units)</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Value</span>
          <input
            required
            type="number"
            min={0}
            step={type === 'percentage' ? '0.01' : '1'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={field}
          />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Currency</span>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            style={field}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Min subtotal (minor)</span>
          <input
            type="number"
            min={0}
            value={minSubtotalMinor}
            onChange={(e) => setMinSubtotalMinor(e.target.value)}
            style={field}
          />
        </label>
      </div>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Usage limit (blank = unlimited)</span>
        <input
          type="number"
          min={1}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
          style={field}
        />
      </label>
      <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        <span>Active</span>
      </label>

      {mode === 'edit' && initial && (
        <p style={{ margin: 0, opacity: 0.75, fontSize: '0.9rem' }}>
          Used {initial.usageCount}
          {initial.usageLimit != null ? ` / ${initial.usageLimit}` : ''} times
        </p>
      )}

      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.6rem 1rem',
            cursor: saving ? 'wait' : 'pointer',
            border: '1px solid #44403c',
            background: '#292524',
            color: '#fafaf9',
            borderRadius: 4,
          }}
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create discount' : 'Save'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onDelete()}
            style={{
              padding: '0.6rem 1rem',
              cursor: saving ? 'wait' : 'pointer',
              border: '1px solid #a8a29e',
              background: 'transparent',
              borderRadius: 4,
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
