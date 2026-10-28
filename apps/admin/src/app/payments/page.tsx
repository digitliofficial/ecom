import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { PaymentSettingsForm } from '../../components/PaymentSettingsForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function PaymentsPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Payments</h2>
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          Enable offline checkout methods for this tenant. COD and bank transfer
          are the defaults for local Pakistan-first demos; Stripe stays optional
          and off.
        </p>
        <PaymentSettingsForm />
      </div>
    </AdminShell>
  );
}
