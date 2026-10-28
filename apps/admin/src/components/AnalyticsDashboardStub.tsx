'use client';

import { useEffect, useState } from 'react';
import type { AnalyticsSummary } from '@ecom/sdk-api';
import { getAdminAnalyticsSummary } from '../lib/api';

export function AnalyticsDashboardStub() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAdminAnalyticsSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
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

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading analytics…</p>;
  }

  if (!summary) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load analytics ({error ?? 'unknown'}). Ingest events via{' '}
        <code>POST /v1/analytics/events</code> after <code>pnpm db:apply</code>.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1.5rem' }}>
      <p style={{ opacity: 0.8, maxWidth: 520, margin: 0 }}>
        First-party event ingest stub. Totals below refresh on page load — charts,
        funnels, and consent gating come later.
      </p>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Total events</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{summary.totalEvents}</div>
        </div>
        {summary.byEventName.map((row) => (
          <div key={row.eventName}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{row.eventName}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>{row.count}</div>
          </div>
        ))}
      </div>

      <section>
        <h3 style={{ marginTop: 0 }}>Recent (last 20)</h3>
        {summary.recent.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No events yet.</p>
        ) : (
          <ul style={{ paddingLeft: '1.1rem', lineHeight: 1.65, fontSize: '0.9rem' }}>
            {summary.recent.map((ev) => (
              <li key={ev.id}>
                <code>{ev.eventName}</code>
                {ev.path ? (
                  <>
                    {' '}
                    · <span style={{ opacity: 0.8 }}>{ev.path}</span>
                  </>
                ) : null}{' '}
                · <span style={{ opacity: 0.65 }}>{ev.occurredAt}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
