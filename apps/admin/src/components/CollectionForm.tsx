'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Collection, Product } from '@ecom/sdk-api';
import {
  createAdminCollection,
  deleteAdminCollection,
  listAdminProducts,
  slugify,
  updateAdminCollection,
} from '../lib/api';

type CollectionFormProps = {
  mode: 'create' | 'edit';
  initial?: Collection;
};

export function CollectionForm({ mode, initial }: CollectionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [productIds, setProductIds] = useState<string[]>(
    initial?.productIds ?? [],
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAdminProducts()
      .then(setProducts)
      .catch((err: Error) => setError(err.message));
  }, []);

  function toggleProduct(id: string) {
    setProductIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        slug: (slug.trim() || slugify(title)).toLowerCase(),
        description: description.trim() || null,
        status,
        productIds,
      };
      if (mode === 'create') {
        const created = await createAdminCollection(body);
        router.replace(`/collections/${created.id}`);
      } else if (initial) {
        await updateAdminCollection(initial.id, body);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial || !window.confirm(`Delete collection “${initial.title}”?`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteAdminCollection(initial.id);
      router.replace('/collections');
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
        <span>Title</span>
        <input
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          style={field}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Slug</span>
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          style={field}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={field}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={field}
        >
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <fieldset
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          border: '1px solid #cfc8bc',
          borderRadius: 4,
        }}
      >
        <legend>Products in collection</legend>
        {!products.length && (
          <p style={{ margin: 0, opacity: 0.75 }}>No products in catalog yet.</p>
        )}
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {products.map((product) => (
            <label
              key={product.id}
              style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}
            >
              <input
                type="checkbox"
                checked={productIds.includes(product.id)}
                onChange={() => toggleProduct(product.id)}
              />
              <span>
                {product.title}{' '}
                <span style={{ opacity: 0.65 }}>(/{product.slug})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
          {saving ? 'Saving…' : mode === 'create' ? 'Create collection' : 'Save'}
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
