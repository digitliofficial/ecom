'use client';

import {
  useEffect,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
} from 'react';
import type { AuthUser } from '@ecom/sdk-api';
import {
  customerLogin,
  customerLogout,
  customerRegister,
  fetchCustomerMe,
} from '../lib/auth';

const field: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 4,
  border: '1px solid #3a4a5c',
  background: '#1a2430',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

export function AccountAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchCustomerMe().then((me) => {
      if (!cancelled) setUser(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');
    const displayName = String(fd.get('displayName') ?? '') || undefined;
    startTransition(async () => {
      try {
        const next =
          mode === 'register'
            ? await customerRegister({ email, password, displayName })
            : await customerLogin({ email, password });
        setUser(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auth failed');
      }
    });
  }

  if (user) {
    return (
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>{user.email}</span>
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await customerLogout();
              setUser(null);
            });
          }}
          style={{
            background: 'transparent',
            border: '1px solid #3a4a5c',
            color: 'inherit',
            padding: '0.25rem 0.55rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <details style={{ fontSize: '0.9rem' }}>
      <summary style={{ cursor: 'pointer', opacity: 0.85 }}>
        Account login / register
      </summary>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'grid',
          gap: '0.5rem',
          marginTop: '0.75rem',
          maxWidth: 280,
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              background: mode === 'login' ? '#3d8bfd' : 'transparent',
              color: 'inherit',
              border: '1px solid #3a4a5c',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              background: mode === 'register' ? '#3d8bfd' : 'transparent',
              color: 'inherit',
              border: '1px solid #3a4a5c',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>
        {mode === 'register' ? (
          <input
            name="displayName"
            placeholder="Name (optional)"
            style={field}
          />
        ) : null}
        <input
          name="email"
          type="email"
          required
          placeholder="customer@demo.localhost"
          style={field}
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password"
          style={field}
        />
        {error ? (
          <p style={{ margin: 0, color: '#ff8e8e', fontSize: '0.8rem' }}>{error}</p>
        ) : (
          <p style={{ margin: 0, opacity: 0.65, fontSize: '0.75rem' }}>
            Demo: customer@demo.localhost / DemoCustomer123!
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            background: '#3d8bfd',
            color: '#fff',
            border: 'none',
            padding: '0.5rem',
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? '…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </details>
  );
}
