import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../../components/AdminShell';
import { ProductForm } from '../../../components/ProductForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../../lib/auth-session';

export default async function NewProductPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/products">← Products</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>New product</h2>
        <ProductForm mode="create" />
      </div>
    </AdminShell>
  );
}
