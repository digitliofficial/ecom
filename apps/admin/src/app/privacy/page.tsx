import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { DsarInbox } from '../../components/DsarInbox';
import { PrivacySettingsForm } from '../../components/PrivacySettingsForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function PrivacyPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Privacy</h2>
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          DPA acknowledgment, retention defaults, cookie banner categories, and
          the DSAR inbox for export/delete requests from customers and guests.
        </p>
        <PrivacySettingsForm />

        <h3 style={{ marginTop: '2.5rem' }}>DSAR inbox</h3>
        <p style={{ opacity: 0.8, maxWidth: 520, marginTop: 0 }}>
          Newest requests first. Click a row to inspect the export artifact or
          delete summary.
        </p>
        <DsarInbox />
      </div>
    </AdminShell>
  );
}
