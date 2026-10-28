import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { CollectionList } from '../../components/CollectionList';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function CollectionsPage() {
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
          <h2 style={{ margin: 0 }}>Collections</h2>
          <Link href="/collections/new">New collection</Link>
        </div>
        <p style={{ marginTop: '0.75rem', opacity: 0.8, maxWidth: 520 }}>
          Manual collections for storefront filtering. Assign products, then
          browse at /en?collection=slug or /en/collections/slug.
        </p>
        <CollectionList />
      </div>
    </AdminShell>
  );
}
