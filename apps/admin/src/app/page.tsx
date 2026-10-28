import { cookies } from 'next/headers';
import { AdminShell } from '../components/AdminShell';
import { ADMIN_STUB_COOKIE, parseStubSessionValue } from '../lib/auth-session';

export default async function AdminHome() {
  const jar = await cookies();
  const session = parseStubSessionValue(jar.get(ADMIN_STUB_COOKIE)?.value);
  const email = session?.email ?? 'staff@merchant.com';

  return (
    <AdminShell email={email}>
      <p style={{ marginTop: '1.5rem', maxWidth: 480 }}>
        Signed in (stub). Tenant switcher and Localization settings shell below.
      </p>
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
