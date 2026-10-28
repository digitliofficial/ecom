import { cookies } from 'next/headers';
import { AdminShell } from '../../components/AdminShell';
import { OrderList } from '../../components/OrderList';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function OrdersPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <p style={{ marginTop: '0.75rem', opacity: 0.8, maxWidth: 520 }}>
          Demo tenant orders from storefront guest (and account) checkout.
          Open an order to fulfill, mark shipped, or cancel.
        </p>
        <OrderList />
      </div>
    </AdminShell>
  );
}
