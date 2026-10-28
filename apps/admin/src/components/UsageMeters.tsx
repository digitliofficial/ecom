'use client';

import Link from 'next/link';
import type { SoftLimitWarning, UsageMeter } from '@ecom/sdk-api';

type UsageMetersProps = {
  meters: UsageMeter[];
  softWarnings?: SoftLimitWarning[];
  planName: string;
  planCode: string;
};

function formatCap(meter: UsageMeter): string {
  if (meter.unlimited) return 'Unlimited';
  return String(meter.limit);
}

export function UsageMeters({
  meters,
  softWarnings = [],
  planName,
  planCode,
}: UsageMetersProps) {
  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Plan usage</h2>
          <p style={{ margin: '0.35rem 0 0', opacity: 0.75, fontSize: '0.9rem' }}>
            {planName} ({planCode})
          </p>
        </div>
        <Link href="/plans">Manage plan</Link>
      </div>

      {softWarnings.length > 0 ? (
        <div
          role="status"
          style={{
            border: '1px solid #a8a29e',
            background: '#f5f5f4',
            padding: '0.75rem 1rem',
            borderRadius: 4,
          }}
        >
          {softWarnings.map((w) => (
            <p key={w.metric} style={{ margin: 0, fontSize: '0.9rem' }}>
              {w.message}{' '}
              <Link href="/plans">Upgrade</Link>
            </p>
          ))}
        </div>
      ) : null}

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        {meters.map((meter) => {
          const pct =
            meter.unlimited || meter.limit == null || meter.limit === 0
              ? meter.usage > 0
                ? 5
                : 0
              : Math.min(100, Math.round((meter.usage / meter.limit) * 100));
          const warn = meter.atLimit || meter.overSoftLimit;
          return (
            <li key={meter.metric}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span>
                  {meter.label}{' '}
                  <span style={{ opacity: 0.65 }}>
                    ({meter.enforcement})
                  </span>
                </span>
                <span>
                  {meter.usage} / {formatCap(meter)}
                  {warn ? (
                    <Link href="/plans" style={{ marginLeft: '0.5rem' }}>
                      Upgrade
                    </Link>
                  ) : null}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: '#e7e5e4',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: warn ? '#b45309' : '#44403c',
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
