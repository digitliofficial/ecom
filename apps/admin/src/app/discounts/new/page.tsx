import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../../components/AdminShell';
import { DiscountForm } from '../../../components/DiscountForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../../lib/auth-session';

export default async function NewDiscountPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ margin: '0 0 0.5rem' }}>
          <Link href="/discounts">← Discounts</Link>
        </p>
        <h2 style={{ margin: 0 }}>New discount</h2>
        <DiscountForm mode="create" />
      </div>
    </AdminShell>
  );
}
