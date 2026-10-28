import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { ReviewModerationList } from '../../components/ReviewModerationList';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function ReviewsPage() {
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
        <h2 style={{ marginTop: '1rem' }}>Reviews</h2>
        <p style={{ opacity: 0.8, maxWidth: 520 }}>
          Moderate customer product reviews. Only approved reviews appear on the
          storefront; aggregates update when you approve or reject.
        </p>
        <ReviewModerationList />
      </div>
    </AdminShell>
  );
}
