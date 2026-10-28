import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { CmsSettingsForm } from '../../components/CmsSettingsForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function CmsPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 720 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/">← Dashboard</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>CMS</h2>
        <p style={{ opacity: 0.8, maxWidth: 560 }}>
          Theme pack, SEO defaults, header/footer menus, and policy page copy for
          this tenant. Storefront reads the same settings via{' '}
          <code>/v1/cms/bootstrap</code>.
        </p>
        <CmsSettingsForm />
      </div>
    </AdminShell>
  );
}
