'use client';

import Link from 'next/link';
import type { UpgradeRequiredError } from '@ecom/sdk-api';

type UpgradePromptProps = {
  error: UpgradeRequiredError;
  onDismiss?: () => void;
};

export function UpgradePrompt({ error, onDismiss }: UpgradePromptProps) {
  return (
    <div
      role="alert"
      style={{
        border: '1px solid #b45309',
        background: '#fffbeb',
        color: '#78350f',
        padding: '0.85rem 1rem',
        borderRadius: 4,
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      <strong style={{ fontWeight: 600 }}>Upgrade required</strong>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>{error.message}</p>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>
        {error.metric}: {error.usage}/{error.limit} on {error.planCode}
        {error.suggestedPlanCode ? ` → try ${error.suggestedPlanCode}` : ''}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Link
          href="/plans"
          style={{
            fontWeight: 600,
            color: '#92400e',
            textDecoration: 'underline',
          }}
        >
          Compare plans
        </Link>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#92400e',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
