'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@ecom/i18n-messages';
import { setStubSession } from '../lib/auth-session';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Enter any non-empty email and password (local stub).');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid-looking email (local stub).');
      return;
    }
    setError(null);
    setStubSession(trimmedEmail);
    router.replace('/');
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}
    >
      <input
        type="email"
        name="email"
        autoComplete="username"
        placeholder="staff@merchant.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: '0.6rem' }}
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password (any value)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: '0.6rem' }}
      />
      {error ? (
        <p style={{ margin: 0, color: '#9a3412', fontSize: '0.9rem' }} role="alert">
          {error}
        </p>
      ) : (
        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
          Stub only — any non-empty password works locally.
        </p>
      )}
      <button type="submit" style={{ padding: '0.65rem', cursor: 'pointer' }}>
        {t('en', 'admin.login')}
      </button>
    </form>
  );
}
