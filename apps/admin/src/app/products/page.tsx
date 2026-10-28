import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { ProductList } from '../../components/ProductList';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function ProductsPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>Products</h2>
          <Link href="/products/new">New product</Link>
        </div>
        <p style={{ marginTop: '0.75rem', opacity: 0.8, maxWidth: 520 }}>
          Merchant catalog for the demo tenant. Active products appear on the
          storefront after create.
        </p>
        <ProductList />
      </div>
    </AdminShell>
  );
}
