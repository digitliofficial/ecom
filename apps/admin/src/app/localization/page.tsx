import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function LocalizationPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/">← Dashboard</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Localization</h2>
        <p>Settings shell — default locale/currency, multi-lang / multi-currency toggles (Phase 1).</p>
        <ul>
          <li>Default locale: en</li>
          <li>Default currency: USD (charge)</li>
          <li>Multi-language: off</li>
          <li>Multi-currency (display): off</li>
        </ul>
      </div>
    </AdminShell>
  );
}
