import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { DomainsPanel } from '../../components/DomainsPanel';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function DomainsPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/">← Dashboard</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Domains</h2>
        <p style={{ opacity: 0.8, maxWidth: 560 }}>
          Map custom hostnames to this tenant. Follow the CNAME steps, then
          Verify. Platform preview hosts stay seeded for local demos.
        </p>
        <DomainsPanel />
      </div>
    </AdminShell>
  );
}
