import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { AnalyticsDashboardStub } from '../../components/AnalyticsDashboardStub';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function AnalyticsPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Analytics</h2>
        <AnalyticsDashboardStub />
      </div>
    </AdminShell>
  );
}
