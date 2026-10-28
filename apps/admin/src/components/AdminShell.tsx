'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { staffLogout } from '../lib/api';

type AdminShellProps = {
  email: string;
  children: ReactNode;
};

export function AdminShell({ email, children }: AdminShellProps) {
  const router = useRouter();

  async function signOut() {
    await staffLogout();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 800 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>ecom admin</h1>
        <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.95rem', alignItems: 'center' }}>
          <Link href="/">Dashboard</Link>
          <Link href="/products">Products</Link>
          <Link href="/localization">Localization</Link>
          <span style={{ opacity: 0.75, fontSize: '0.85rem' }}>{email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              border: '1px solid #a8a29e',
              background: 'transparent',
              borderRadius: 4,
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
