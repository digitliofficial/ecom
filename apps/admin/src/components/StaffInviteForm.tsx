'use client';

import { FormEvent, useState } from 'react';
import type { UpgradeRequiredError } from '@ecom/sdk-api';
import {
  ApiError,
  inviteStaffMember,
  listStaffMembers,
  type StaffMember,
} from '../lib/api';
import { UpgradePrompt } from './UpgradePrompt';

type StaffInviteFormProps = {
  initialStaff: StaffMember[];
};

export function StaffInviteForm({ initialStaff }: StaffInviteFormProps) {
  const [staff, setStaff] = useState(initialStaff);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeRequiredError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setUpgrade(null);
    try {
      await inviteStaffMember({
        email,
        password,
        displayName: displayName || undefined,
        role: 'staff',
      });
      setEmail('');
      setPassword('');
      setDisplayName('');
      setStaff(await listStaffMembers());
    } catch (err) {
      if (err instanceof ApiError && err.upgradeRequired) {
        setUpgrade(err.upgradeRequired);
      } else {
        setError(err instanceof Error ? err.message : 'Invite failed');
      }
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { padding: '0.55rem', width: '100%', boxSizing: 'border-box' as const };

  return (
    <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }}>
      <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
        {staff.map((s) => (
          <li key={s.id}>
            {s.email} — {s.role}
            {s.displayName ? ` (${s.displayName})` : ''}
          </li>
        ))}
      </ul>

      {upgrade ? (
        <UpgradePrompt error={upgrade} onDismiss={() => setUpgrade(null)} />
      ) : null}
      {error ? (
        <p role="alert" style={{ color: '#9f1239', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: 400 }}
      >
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Temporary password</span>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '0.55rem 0.75rem',
            cursor: busy ? 'default' : 'pointer',
            border: '1px solid #a8a29e',
            background: 'transparent',
            borderRadius: 4,
            justifySelf: 'start',
          }}
        >
          {busy ? 'Inviting…' : 'Invite staff'}
        </button>
      </form>
    </div>
  );
}
