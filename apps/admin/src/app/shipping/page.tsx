import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { ShippingMethodsForm } from '../../components/ShippingMethodsForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function ShippingPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Shipping</h2>
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          Configure flat-rate shipping methods for checkout. Mark methods
          COD-compatible when cash-on-delivery shoppers may use them. Live
          Pakistan / local courier APIs plug in later via CourierPort (
          <code>local_pk_*</code> adapters).
        </p>
        <ShippingMethodsForm />
      </div>
    </AdminShell>
  );
}
