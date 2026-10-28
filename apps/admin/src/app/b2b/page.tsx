import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { B2bAdminPanel } from '../../components/B2bAdminPanel';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function B2bPage() {
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
        <h2 style={{ marginTop: '1rem' }}>B2B</h2>
        <p style={{ opacity: 0.8, maxWidth: 540 }}>
          Customer groups and price lists (plan-gated). Group members see list
          prices on the catalog and when adding to cart. Demo seed links the
          wholesale group to the demo customer.
        </p>
        <B2bAdminPanel />
      </div>
    </AdminShell>
  );
}
