import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../components/AdminShell';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../lib/auth-session';

export default async function AdminHome() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <p style={{ marginTop: '1.5rem', maxWidth: 520 }}>
        Signed in as demo tenant staff. Manage catalog, collections, coupons,
        multi-location inventory, orders, and offline payments.
      </p>
      <ul style={{ marginTop: '1.25rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
        <li>
          <Link href="/products">Products</Link> — list / create / edit catalog
        </li>
        <li>
          <Link href="/collections">Collections</Link> — group products for the storefront
        </li>
        <li>
          <Link href="/discounts">Discounts</Link> — percentage / fixed coupons
        </li>
        <li>
          <Link href="/inventory">Inventory</Link> — locations + stock per variant
        </li>
        <li>
          <Link href="/orders">Orders</Link> — list / detail / fulfill · ship · cancel
        </li>
        <li>
          <Link href="/payments">Payments</Link> — COD + bank transfer settings
        </li>
        <li>
          <Link href="/localization">Localization</Link> — locale &amp; currency shell
        </li>
      </ul>
      <div style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid #cfc8bc' }}>
        <label style={{ display: 'grid', gap: '0.4rem', maxWidth: 280 }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Tenant switcher (stub)</span>
          <select defaultValue="demo" style={{ padding: '0.5rem' }}>
            <option value="demo">demo</option>
          </select>
        </label>
      </div>
    </AdminShell>
  );
}
