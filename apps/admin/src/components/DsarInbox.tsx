'use client';

import { useEffect, useState } from 'react';
import type { DsarRequestDetail, DsarRequestSummary } from '@ecom/sdk-api';
import { getAdminDsar, listAdminDsar } from '../lib/api';

export function DsarInbox() {
  const [rows, setRows] = useState<DsarRequestSummary[]>([]);
  const [selected, setSelected] = useState<DsarRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAdminDsar()
      .then((data) => {
        if (!cancelled) setRows(data);
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

  async function openRow(id: string) {
    setError(null);
    try {
      const detail = await getAdminDsar(id);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }

  if (loading) {
    return <p style={{ marginTop: '1rem', opacity: 0.75 }}>Loading DSAR inbox…</p>;
  }

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {error ? (
        <p style={{ color: '#9a3412' }} role="alert">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ opacity: 0.75 }}>No DSAR requests yet.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9rem',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #cfc8bc' }}>
              <th style={{ padding: '0.4rem 0.35rem' }}>Type</th>
              <th style={{ padding: '0.4rem 0.35rem' }}>Status</th>
              <th style={{ padding: '0.4rem 0.35rem' }}>Subject</th>
              <th style={{ padding: '0.4rem 0.35rem' }}>Kind</th>
              <th style={{ padding: '0.4rem 0.35rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={{ borderBottom: '1px solid #e7e5e4', cursor: 'pointer' }}
                onClick={() => void openRow(r.id)}
              >
                <td style={{ padding: '0.45rem 0.35rem' }}>{r.requestType}</td>
                <td style={{ padding: '0.45rem 0.35rem' }}>{r.status}</td>
                <td style={{ padding: '0.45rem 0.35rem' }}>{r.subjectEmail}</td>
                <td style={{ padding: '0.45rem 0.35rem' }}>{r.subjectKind}</td>
                <td style={{ padding: '0.45rem 0.35rem' }}>
                  {new Date(r.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected ? (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1rem',
            border: '1px solid #cfc8bc',
            borderRadius: 4,
            fontSize: '0.85rem',
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>{selected.requestType}</strong> · {selected.status} ·{' '}
            {selected.subjectEmail}
          </p>
          {selected.errorMessage ? (
            <p style={{ color: '#9a3412' }}>{selected.errorMessage}</p>
          ) : null}
          {selected.artifact ? (
            <pre
              style={{
                overflow: 'auto',
                maxHeight: 280,
                background: '#f5f5f4',
                padding: '0.65rem',
                margin: 0,
              }}
            >
              {JSON.stringify(selected.artifact, null, 2)}
            </pre>
          ) : (
            <p style={{ opacity: 0.75, marginBottom: 0 }}>No artifact on file.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
