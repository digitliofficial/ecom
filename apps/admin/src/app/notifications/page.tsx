import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { NotificationSettingsForm } from '../../components/NotificationSettingsForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function NotificationsPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Notifications</h2>
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          Order lifecycle emails and abandoned-cart reminders. Locally the Nest
          API uses the <code>console</code> EmailProvider — watch the API
          terminal for <code>EMAIL (console provider)</code> blocks. Optional
          Resend via <code>RESEND_API_KEY</code>.
        </p>
        <NotificationSettingsForm />
      </div>
    </AdminShell>
  );
}
