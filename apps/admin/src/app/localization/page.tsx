import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { LocalizationSettingsForm } from '../../components/LocalizationSettingsForm';
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
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          Set the store default locale and charge currency. Turn on multi-language
          or multi-currency to enable additional options; the storefront shows
          switchers when more than one is enabled.
        </p>
        <LocalizationSettingsForm />
      </div>
    </AdminShell>
  );
}
