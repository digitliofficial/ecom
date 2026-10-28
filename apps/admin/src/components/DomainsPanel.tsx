'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { DomainsConfig, TenantDomain } from '@ecom/sdk-api';
import {
  addAdminDomain,
  getAdminDomains,
  removeAdminDomain,
  verifyAdminDomain,
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

const button: CSSProperties = {
  padding: '0.4rem 0.7rem',
  cursor: 'pointer',
  border: '1px solid #a8a29e',
  background: 'transparent',
  borderRadius: 4,
  fontSize: '0.85rem',
};

export function DomainsPanel() {
  const [config, setConfig] = useState<DomainsConfig | null>(null);
  const [host, setHost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = await getAdminDomains();
    setConfig(data);
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

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await addAdminDomain({ host });
      setHost('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(domain: TenantDomain) {
    setError(null);
    setBusy(true);
    try {
      await verifyAdminDomain(domain.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(domain: TenantDomain) {
    setError(null);
    setBusy(true);
    try {
      await removeAdminDomain(domain.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading domains…</p>;
  }

  if (!config) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load domains ({error ?? 'unknown'}). Is the API on :3001 with
        schema applied (`pnpm db:apply`)?
      </p>
    );
  }

  const { domains, cname, platformHosts } = config;

  return (
    <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1.75rem' }}>
      {error ? (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h3 style={{ marginTop: 0 }}>CNAME instructions</h3>
        <p style={{ opacity: 0.8, maxWidth: 560 }}>
          Point your custom hostname at the platform edge, then Verify. SSL is
          stubbed until CDN/WAF is wired.
        </p>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.35rem 1rem',
            maxWidth: 560,
            fontSize: '0.95rem',
          }}
        >
          <dt style={{ opacity: 0.7 }}>Type</dt>
          <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>CNAME</dd>
          <dt style={{ opacity: 0.7 }}>Host</dt>
          <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
            {cname.cnameHost}
          </dd>
          <dt style={{ opacity: 0.7 }}>Target</dt>
          <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
            {cname.cnameTarget}
          </dd>
          <dt style={{ opacity: 0.7 }}>TTL</dt>
          <dd style={{ margin: 0 }}>{cname.ttlHint}</dd>
        </dl>
        <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.6, maxWidth: 560 }}>
          {cname.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>Tenant domains</h3>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              minWidth: 520,
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #cfc8bc' }}>
                <th style={{ padding: '0.5rem 0.4rem' }}>Host</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Primary</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>DNS</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>SSL</th>
                <th style={{ padding: '0.5rem 0.4rem' }} />
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const isPlatform = platformHosts.includes(domain.host);
                return (
                  <tr
                    key={domain.id}
                    style={{ borderBottom: '1px solid #e7e2d9' }}
                  >
                    <td style={{ padding: '0.55rem 0.4rem', fontFamily: 'ui-monospace, monospace' }}>
                      {domain.host}
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      {domain.isPrimary ? 'yes' : '—'}
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      {domain.verificationStatus}
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{domain.sslStatus}</td>
                    <td style={{ padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        style={{ ...button, marginRight: '0.4rem' }}
                        disabled={busy}
                        onClick={() => void onVerify(domain)}
                      >
                        Verify
                      </button>
                      {!isPlatform ? (
                        <button
                          type="button"
                          style={button}
                          disabled={busy}
                          onClick={() => void onRemove(domain)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(e) => void onAdd(e)}
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            gap: '0.65rem',
            flexWrap: 'wrap',
            alignItems: 'end',
            maxWidth: 480,
          }}
        >
          <label style={{ flex: '1 1 220px', display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Add custom domain</span>
            <input
              style={field}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="www.example.com"
              required
            />
          </label>
          <button type="submit" style={{ ...button, padding: '0.55rem 0.9rem' }} disabled={busy}>
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
