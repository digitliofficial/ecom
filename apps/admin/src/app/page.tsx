import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../components/AdminShell';
import { ADMIN_STUB_COOKIE, parseStubSessionValue } from '../lib/auth-session';

export default async function AdminHome() {
  const jar = await cookies();
  const session = parseStubSessionValue(jar.get(ADMIN_STUB_COOKIE)?.value);
  const email = session?.email ?? 'staff@merchant.com';

  return (
    <AdminShell email={email}>
      <p style={{ marginTop: '1.5rem', maxWidth: 480 }}>
        Signed in (stub) as demo tenant staff. Manage catalog under Products;
        Localization remains a settings shell.
      </p>
      <ul style={{ marginTop: '1.25rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
        <li>
          <Link href="/products">Products</Link> — list / create / edit catalog
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
