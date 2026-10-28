'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import type { CustomerGroup, PriceList, Product } from '@ecom/sdk-api';
import {
  createAdminCustomerGroup,
  createAdminPriceList,
  formatMoney,
  listAdminCustomerGroups,
  listAdminPriceLists,
  listAdminProducts,
  updateAdminCustomerGroup,
  updateAdminPriceList,
} from '../lib/api';

const DEMO_CUSTOMER_ID = '60000000-0000-4000-8000-000000000001';

export function B2bAdminPanel() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const [l, g, p] = await Promise.all([
      listAdminPriceLists(),
      listAdminCustomerGroups(),
      listAdminProducts(),
    ]);
    setLists(l);
    setGroups(g);
    setProducts(p);
  }

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
  }, []);

  function onCreateList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const variantId = String(fd.get('variantId') ?? '');
    const unitAmountMinor = Number(fd.get('unitAmountMinor'));
    startTransition(async () => {
      try {
        await createAdminPriceList({
          name,
          currency: 'USD',
          items: variantId
            ? [{ variantId, unitAmountMinor, currency: 'USD' }]
            : [],
        });
        setMessage(`Created price list “${name}”.`);
        setError(null);
        await reload();
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    });
  }

  function onCreateGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const priceListId = String(fd.get('priceListId') ?? '') || null;
    const includeDemo = fd.get('includeDemo') === 'on';
    startTransition(async () => {
      try {
        await createAdminCustomerGroup({
          name,
          priceListId,
          customerIds: includeDemo ? [DEMO_CUSTOMER_ID] : [],
        });
        setMessage(`Created group “${name}”.`);
        setError(null);
        await reload();
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    });
  }

  const variants = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      label: `${p.title} · ${v.sku} (${formatMoney(v.unitAmountMinor, v.currency)})`,
    })),
  );

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading B2B…</p>;
  }

  return (
    <div style={{ marginTop: '1.25rem', display: 'grid', gap: '2rem' }}>
      {error && (
        <p style={{ color: '#9a3412' }} role="alert">
          {error}
        </p>
      )}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <section>
        <h3 style={{ marginTop: 0 }}>Price lists</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lists.map((list) => (
            <li
              key={list.id}
              style={{ borderTop: '1px solid #d6d3d1', padding: '0.85rem 0' }}
            >
              <strong>{list.name}</strong>{' '}
              <span style={{ opacity: 0.7 }}>({list.currency})</span>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                {list.items.map((item) => (
                  <li key={item.id}>
                    {item.sku ?? item.variantId.slice(0, 8)} —{' '}
                    {formatMoney(item.unitAmountMinor, item.currency)}
                  </li>
                ))}
              </ul>
              {variants[0] && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const amount = Math.max(
                          0,
                          Math.trunc(
                            (list.items[0]?.unitAmountMinor ?? 2000) - 100,
                          ),
                        );
                        await updateAdminPriceList(list.id, {
                          items: [
                            {
                              variantId: variants[0]!.id,
                              unitAmountMinor: amount,
                              currency: list.currency,
                            },
                          ],
                        });
                        setMessage(`Updated ${list.name}.`);
                        await reload();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Update failed',
                        );
                      }
                    });
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.3rem 0.6rem',
                    border: '1px solid #a8a29e',
                    background: '#fff',
                    borderRadius: 4,
                    cursor: pending ? 'wait' : 'pointer',
                  }}
                >
                  Set first variant −$1
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          onSubmit={onCreateList}
          style={{
            marginTop: '1rem',
            display: 'grid',
            gap: '0.6rem',
            maxWidth: 420,
          }}
        >
          <strong>New price list</strong>
          <input name="name" placeholder="Name" required />
          <select name="variantId" defaultValue={variants[0]?.id ?? ''}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            name="unitAmountMinor"
            type="number"
            min={0}
            defaultValue={2000}
            required
            placeholder="Unit amount (minor)"
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              justifySelf: 'start',
              padding: '0.45rem 0.8rem',
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Create list
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>Customer groups</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {groups.map((group) => (
            <li
              key={group.id}
              style={{ borderTop: '1px solid #d6d3d1', padding: '0.85rem 0' }}
            >
              <strong>{group.name}</strong>
              <div style={{ opacity: 0.75, fontSize: '0.9rem' }}>
                {group.memberCount} members
                {group.priceListId
                  ? ` · list ${group.priceListId.slice(0, 8)}…`
                  : ' · no price list'}
              </div>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                {group.members.map((m) => (
                  <li key={m.customerId}>
                    {m.email}
                    {m.displayName ? ` (${m.displayName})` : ''}
                  </li>
                ))}
              </ul>
              {lists[0] && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateAdminCustomerGroup(group.id, {
                          priceListId: lists[0]!.id,
                        });
                        setMessage(`Linked ${group.name} to ${lists[0]!.name}.`);
                        await reload();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Update failed',
                        );
                      }
                    });
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.3rem 0.6rem',
                    border: '1px solid #a8a29e',
                    background: '#fff',
                    borderRadius: 4,
                    cursor: pending ? 'wait' : 'pointer',
                  }}
                >
                  Attach first price list
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          onSubmit={onCreateGroup}
          style={{
            marginTop: '1rem',
            display: 'grid',
            gap: '0.6rem',
            maxWidth: 420,
          }}
        >
          <strong>New customer group</strong>
          <input name="name" placeholder="Name" required />
          <select name="priceListId" defaultValue={lists[0]?.id ?? ''}>
            <option value="">No price list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input name="includeDemo" type="checkbox" defaultChecked />
            Include demo customer ({DEMO_CUSTOMER_ID.slice(0, 8)}…)
          </label>
          <button
            type="submit"
            disabled={pending}
            style={{
              justifySelf: 'start',
              padding: '0.45rem 0.8rem',
              cursor: pending ? 'wait' : 'pointer',
            }}
          >
            Create group
          </button>
        </form>
      </section>
    </div>
  );
}
