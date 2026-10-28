'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import {
  createAndOptionallyRun,
  fetchJobs,
  runJobAction,
} from '../app/actions';
import type { MigrationJob } from '../lib/api';

const ALL_ENTITIES = ['products', 'customers', 'orders', 'redirects'] as const;

type Props = {
  initialJobs: MigrationJob[];
};

export function MigrationPanel({ initialJobs }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [tenantId, setTenantId] = useState('demo');
  const [source, setSource] = useState<'shopify_api' | 'csv' | 'fixture'>(
    'fixture',
  );
  const [entities, setEntities] = useState<string[]>([...ALL_ENTITIES]);
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [csvProducts, setCsvProducts] = useState('');
  const [csvCustomers, setCsvCustomers] = useState('');
  const [fixtureJson, setFixtureJson] = useState(
    JSON.stringify(
      {
        products: [
          {
            id: 1,
            title: 'Sample Product',
            handle: 'sample-product',
            status: 'active',
            variants: [
              {
                id: 11,
                sku: 'SAMPLE-01',
                title: 'Default',
                price: '10.00',
                inventory_quantity: 5,
              },
            ],
          },
        ],
        customers: [],
        orders: [],
        redirects: [],
      },
      null,
      2,
    ),
  );

  function toggleEntity(name: string) {
    setEntities((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  function refresh(tenant?: string) {
    startTransition(async () => {
      try {
        setError(null);
        const next = await fetchJobs(tenant || tenantId);
        setJobs(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onCreate(runNow: boolean) {
    startTransition(async () => {
      setError(null);
      const result = await createAndOptionallyRun({
        tenantId,
        source,
        entityTypes: entities,
        shopDomain,
        accessToken,
        csvProducts,
        csvCustomers,
        fixtureJson,
        runNow,
      });
      if (result.error) setError(result.error);
      const next = await fetchJobs(tenantId);
      setJobs(next);
    });
  }

  function onRun(id: string) {
    startTransition(async () => {
      try {
        setError(null);
        await runJobAction(id);
        const next = await fetchJobs(tenantId);
        setJobs(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: 960 }}>
      <section>
        <h2 style={{ marginTop: 0 }}>Create import job</h2>
        <p style={{ opacity: 0.75, marginTop: 0 }}>
          Shopify Admin API (primary) or CSV/fixture fallback. Jobs write
          idempotent <code>migration_records</code> and archive orders as{' '}
          <code>source=shopify_import</code>. Passwords and card tokens are never
          imported.
        </p>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label>
            Tenant id or slug
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            Source
            <select
              value={source}
              onChange={(e) =>
                setSource(e.target.value as 'shopify_api' | 'csv' | 'fixture')
              }
              style={inputStyle}
            >
              <option value="shopify_api">shopify_api</option>
              <option value="csv">csv</option>
              <option value="fixture">fixture</option>
            </select>
          </label>

          <fieldset style={{ border: '1px solid #333', borderRadius: 6 }}>
            <legend>Entities</legend>
            {ALL_ENTITIES.map((name) => (
              <label key={name} style={{ marginRight: '1rem' }}>
                <input
                  type="checkbox"
                  checked={entities.includes(name)}
                  onChange={() => toggleEntity(name)}
                />{' '}
                {name}
              </label>
            ))}
          </fieldset>

          {source === 'shopify_api' && (
            <>
              <label>
                Shop domain
                <input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="mystore.myshopify.com"
                  style={inputStyle}
                />
              </label>
              <label>
                Admin API access token
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          )}

          {source === 'csv' && (
            <>
              <label>
                Products CSV
                <textarea
                  value={csvProducts}
                  onChange={(e) => setCsvProducts(e.target.value)}
                  rows={6}
                  style={inputStyle}
                />
              </label>
              <label>
                Customers CSV
                <textarea
                  value={csvCustomers}
                  onChange={(e) => setCsvCustomers(e.target.value)}
                  rows={4}
                  style={inputStyle}
                />
              </label>
            </>
          )}

          {source === 'fixture' && (
            <label>
              Fixture JSON
              <textarea
                value={fixtureJson}
                onChange={(e) => setFixtureJson(e.target.value)}
                rows={12}
                style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }}
              />
            </label>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={pending || entities.length === 0}
              onClick={() => onCreate(false)}
              style={buttonStyle}
            >
              Create job
            </button>
            <button
              type="button"
              disabled={pending || entities.length === 0}
              onClick={() => onCreate(true)}
              style={buttonStyle}
            >
              Create + run
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => refresh()}
              style={buttonStyle}
            >
              Refresh list
            </button>
          </div>
        </div>
      </section>

      {error && (
        <p style={{ color: '#f88', whiteSpace: 'pre-wrap' }}>{error}</p>
      )}

      <section>
        <h2>Jobs</h2>
        {jobs.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No jobs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {jobs.map((job) => (
              <article
                key={job.id}
                style={{
                  border: '1px solid #333',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{job.status}</strong> · {job.source} ·{' '}
                    {job.entityTypes.join(', ')}
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      {job.id}
                      {job.shopDomain ? ` · ${job.shopDomain}` : ''}
                    </div>
                  </div>
                  {(job.status === 'pending' || job.status === 'failed') && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onRun(job.id)}
                      style={buttonStyle}
                    >
                      Run
                    </button>
                  )}
                </div>
                {job.error && (
                  <p style={{ color: '#f88', marginBottom: 0 }}>{job.error}</p>
                )}
                {job.stats && Object.keys(job.stats).length > 0 && (
                  <pre
                    style={{
                      marginBottom: 0,
                      fontSize: 12,
                      opacity: 0.8,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(job.stats, null, 2)}
                  </pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem 0.6rem',
  borderRadius: 6,
  border: '1px solid #444',
  background: '#1a1a1a',
  color: '#eee',
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 0.9rem',
  borderRadius: 6,
  border: '1px solid #555',
  background: '#222',
  color: '#eee',
  cursor: 'pointer',
};
