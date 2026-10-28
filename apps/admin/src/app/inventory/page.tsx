import { cookies } from 'next/headers';
import { AdminShell } from '../../components/AdminShell';
import { InventoryManager } from '../../components/InventoryManager';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function InventoryPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <p style={{ marginTop: '0.75rem', opacity: 0.8, maxWidth: 540 }}>
          Multi-location stock. Checkout decrements from the default location
          first, then other active locations. Variant{' '}
          <code>inventoryQuantity</code> stays the sum across locations.
        </p>
        <InventoryManager />
      </div>
    </AdminShell>
  );
}
