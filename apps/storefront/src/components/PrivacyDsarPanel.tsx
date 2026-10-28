'use client';

import {
  useEffect,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
} from 'react';
import type { AuthUser, DsarRequestDetail, DsarRequestSummary } from '@ecom/sdk-api';
import { createApiClient } from '@ecom/sdk-api';
import { getApiBaseUrl, getTenantHost, readCartToken } from '../lib/api';
import { fetchCustomerMe } from '../lib/auth';
import { readCustomerBearer } from '../lib/customer-session';

const field: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 4,
  border: '1px solid #3a4a5c',
  background: '#1a2430',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const btn: CSSProperties = {
  background: '#3d8bfd',
  color: '#fff',
  border: 'none',
  padding: '0.55rem 0.9rem',
  cursor: 'pointer',
};

function client() {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getHost: getTenantHost,
    getCartToken: readCartToken,
    getToken: () => readCustomerBearer(),
    credentials: 'include',
  });
}

function downloadArtifact(detail: DsarRequestDetail) {
  if (!detail.artifact) return;
  const blob = new Blob([JSON.stringify(detail.artifact, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ecom-dsar-${detail.requestType}-${detail.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PrivacyDsarPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [requests, setRequests] = useState<DsarRequestSummary[]>([]);
  const [last, setLast] = useState<DsarRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh(me: AuthUser | null) {
    if (!me) {
      setRequests([]);
      return;
    }
    client()
      .listCustomerDsar()
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(() => {
    let cancelled = false;
    fetchCustomerMe().then((me) => {
      if (cancelled) return;
      setUser(me);
      refresh(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onExport() {
    startTransition(async () => {
      setError(null);
      try {
        const detail = await client().createCustomerExport();
        setLast(detail);
        refresh(user);
        if (detail.hasArtifact) downloadArtifact(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
      }
    });
  }

  function onDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    startTransition(async () => {
      setError(null);
      try {
        const detail = await client().createCustomerDelete({ password });
        setLast(detail);
        setUser(null);
        setRequests([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  function onGuest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const orderAccessToken = String(fd.get('orderAccessToken') ?? '');
    const requestType = String(fd.get('requestType') ?? 'export') as
      | 'export'
      | 'delete';
    startTransition(async () => {
      setError(null);
      try {
        const detail = await client().createGuestDsar({
          requestType,
          email,
          orderAccessToken,
        });
        setLast(detail);
        if (detail.requestType === 'export' && detail.hasArtifact) {
          downloadArtifact(detail);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Guest DSAR failed');
      }
    });
  }

  return (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: 560 }}>
      {user ? (
        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Your account data</h2>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>
            Signed in as {user.email}. Export returns a JSON package (profile,
            orders, consents). Delete anonymizes PII after password confirmation;
            order totals are retained for tax/legal.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" style={btn} disabled={pending} onClick={onExport}>
              {pending ? '…' : 'Export my data'}
            </button>
          </div>
          <form
            onSubmit={onDelete}
            style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}
          >
            <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
              Confirm password to delete / anonymize
              <input
                name="password"
                type="password"
                required
                minLength={8}
                style={field}
                placeholder="Account password"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              style={{
                ...btn,
                background: '#9a3412',
                justifySelf: 'start',
              }}
            >
              Delete my personal data
            </button>
          </form>
          {requests.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', opacity: 0.85 }}>
              {requests.map((r) => (
                <li key={r.id}>
                  {r.requestType} · {r.status} · {new Date(r.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Guest order privacy</h2>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>
            Use the email and order access token from your checkout confirmation
            to export or anonymize guest order PII. Sign in above for account
            requests.
          </p>
          <form onSubmit={onGuest} style={{ display: 'grid', gap: '0.55rem' }}>
            <select name="requestType" defaultValue="export" style={field}>
              <option value="export">Export</option>
              <option value="delete">Delete / anonymize</option>
            </select>
            <input
              name="email"
              type="email"
              required
              placeholder="guest@example.com"
              style={field}
            />
            <input
              name="orderAccessToken"
              required
              placeholder="Order access token"
              style={field}
            />
            <button type="submit" disabled={pending} style={{ ...btn, justifySelf: 'start' }}>
              {pending ? '…' : 'Submit request'}
            </button>
          </form>
        </section>
      )}

      {error ? (
        <p style={{ margin: 0, color: '#ff8e8e', fontSize: '0.9rem' }} role="alert">
          {error}
        </p>
      ) : null}

      {last ? (
        <section
          style={{
            padding: '0.85rem 1rem',
            border: '1px solid #3a4a5c',
            fontSize: '0.85rem',
            opacity: 0.9,
          }}
        >
          <p style={{ margin: '0 0 0.35rem' }}>
            Last request: <strong>{last.requestType}</strong> · {last.status}
          </p>
          {last.hasArtifact && last.requestType === 'export' ? (
            <button
              type="button"
              style={btnGhostSmall}
              onClick={() => downloadArtifact(last)}
            >
              Download JSON again
            </button>
          ) : null}
          {last.requestType === 'delete' && last.status === 'completed' ? (
            <p style={{ margin: '0.35rem 0 0' }}>
              Personal data anonymized. Financial order records retained.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

const btnGhostSmall: CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: '1px solid #3a4a5c',
  padding: '0.35rem 0.65rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
