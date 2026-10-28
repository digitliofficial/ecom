import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { ADMIN_STUB_COOKIE, parseStubSessionValue } from '../../lib/auth-session';

export default async function LocalizationPage() {
  const jar = await cookies();
  const session = parseStubSessionValue(jar.get(ADMIN_STUB_COOKIE)?.value);
  const email = session?.email ?? 'staff@merchant.com';

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
