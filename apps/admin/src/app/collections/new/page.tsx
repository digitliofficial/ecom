import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../../components/AdminShell';
import { CollectionForm } from '../../../components/CollectionForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../../lib/auth-session';

export default async function NewCollectionPage() {
  const jar = await cookies();
  const email =
    readStaffEmailFromCookie(jar.get(STAFF_SESSION_COOKIE)?.value) ??
    'owner@demo.localhost';

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ margin: '0 0 0.5rem' }}>
          <Link href="/collections">← Collections</Link>
        </p>
        <h2 style={{ margin: 0 }}>New collection</h2>
        <CollectionForm mode="create" />
      </div>
    </AdminShell>
  );
}
