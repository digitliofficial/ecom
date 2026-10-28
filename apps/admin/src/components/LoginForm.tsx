'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@ecom/i18n-messages';
import { staffLogin } from '../lib/api';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@demo.localhost');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    if (!trimmedEmail || !trimmedPassword) {
      setError('Enter email and password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await staffLogin(trimmedEmail, trimmedPassword);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending(false);
    }
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
        placeholder="owner@demo.localhost"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: '0.6rem' }}
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password"
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
          Demo: owner@demo.localhost / DemoOwner123!
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        style={{ padding: '0.65rem', cursor: pending ? 'wait' : 'pointer' }}
      >
        {pending ? 'Signing in…' : t('en', 'admin.login')}
      </button>
    </form>
  );
}
