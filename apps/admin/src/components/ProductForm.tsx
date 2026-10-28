'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, UpgradeRequiredError, VariantInput } from '@ecom/sdk-api';
import {
  ApiError,
  createAdminProduct,
  slugify,
  updateAdminProduct,
} from '../lib/api';
import { UpgradePrompt } from './UpgradePrompt';

type VariantDraft = {
  key: string;
  id?: string;
  title: string;
  sku: string;
  unitAmountMinor: string;
  currency: string;
  inventoryQuantity: string;
};

type ProductFormProps = {
  mode: 'create' | 'edit';
  initial?: Product;
};

function toDrafts(product?: Product): VariantDraft[] {
  if (!product?.variants.length) {
    return [
      {
        key: 'new-0',
        title: 'Default',
        sku: '',
        unitAmountMinor: '2500',
        currency: 'USD',
        inventoryQuantity: '0',
      },
    ];
  }
  return product.variants.map((v, index) => ({
    key: v.id || `existing-${index}`,
    id: v.id,
    title: v.title,
    sku: v.sku,
    unitAmountMinor: String(v.unitAmountMinor),
    currency: v.currency,
    inventoryQuantity: String(v.inventoryQuantity ?? 0),
  }));
}

export function ProductForm({ mode, initial }: ProductFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    toDrafts(initial),
  );
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeRequiredError | null>(null);
  const [saving, setSaving] = useState(false);

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addVariant() {
    setVariants((rows) => [
      ...rows,
      {
        key: `new-${Date.now()}`,
        title: 'Default',
        sku: '',
        unitAmountMinor: '0',
        currency: 'USD',
        inventoryQuantity: '0',
      },
    ]);
  }

  function removeVariant(key: string) {
    setVariants((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setUpgrade(null);
    setSaving(true);
    try {
      const parsedVariants: VariantInput[] = variants.map((v) => ({
        id: v.id,
        title: v.title.trim(),
        sku: v.sku.trim(),
        unitAmountMinor: Number(v.unitAmountMinor),
        currency: v.currency.trim().toUpperCase() || 'USD',
        inventoryQuantity: Number(v.inventoryQuantity || 0),
      }));

      if (mode === 'create') {
        const created = await createAdminProduct({
          title: title.trim(),
          slug: (slug.trim() || slugify(title)).toLowerCase(),
          description: description.trim() || null,
          status,
          variants: parsedVariants,
        });
        router.replace(`/products/${created.id}`);
        router.refresh();
      } else if (initial) {
        await updateAdminProduct(initial.id, {
          title: title.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() || null,
          status,
          variants: parsedVariants,
        });
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.upgradeRequired) {
        setUpgrade(err.upgradeRequired);
      } else {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = {
    display: 'grid' as const,
    gap: '0.35rem',
  };
  const inputStyle = { padding: '0.55rem', width: '100%', boxSizing: 'border-box' as const };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }}>
      {upgrade ? (
        <UpgradePrompt error={upgrade} onDismiss={() => setUpgrade(null)} />
      ) : null}
      <label style={fieldStyle}>
        <span>Title</span>
        <input
          required
          value={title}
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next));
          }}
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        <span>Slug</span>
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        <span>Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={inputStyle}
        >
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <fieldset
        style={{
          border: '1px solid #cfc8bc',
          borderRadius: 4,
          padding: '1rem',
          margin: 0,
        }}
      >
        <legend style={{ padding: '0 0.35rem' }}>Variants</legend>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {variants.map((variant, index) => (
            <div
              key={variant.key}
              style={{
                display: 'grid',
                gap: '0.65rem',
                paddingTop: index === 0 ? 0 : '0.75rem',
                borderTop: index === 0 ? undefined : '1px solid #ddd6cb',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontWeight: 500 }}>Variant {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => removeVariant(variant.key)}
                  disabled={variants.length <= 1}
                  style={{ cursor: variants.length <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  Remove
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gap: '0.65rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                }}
              >
                <label style={fieldStyle}>
                  <span>Title</span>
                  <input
                    required
                    value={variant.title}
                    onChange={(e) =>
                      updateVariant(variant.key, { title: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span>SKU</span>
                  <input
                    required
                    value={variant.sku}
                    onChange={(e) =>
                      updateVariant(variant.key, { sku: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span>Price (minor)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step={1}
                    value={variant.unitAmountMinor}
                    onChange={(e) =>
                      updateVariant(variant.key, {
                        unitAmountMinor: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span>Currency</span>
                  <input
                    required
                    value={variant.currency}
                    onChange={(e) =>
                      updateVariant(variant.key, { currency: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span>Inventory qty</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step={1}
                    value={variant.inventoryQuantity}
                    onChange={(e) =>
                      updateVariant(variant.key, {
                        inventoryQuantity: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addVariant}
          style={{ marginTop: '1rem', cursor: 'pointer', padding: '0.45rem 0.75rem' }}
        >
          Add variant
        </button>
      </fieldset>

      {error ? (
        <p style={{ margin: 0, color: '#9a3412' }} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '0.7rem 1rem',
          cursor: saving ? 'wait' : 'pointer',
          justifySelf: 'start',
        }}
      >
        {saving ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
      </button>
    </form>
  );
}
