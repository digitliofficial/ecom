import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { DiscountList } from '../../components/DiscountList';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';

export default async function DiscountsPage() {
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
          <h2 style={{ margin: 0 }}>Discounts</h2>
          <Link href="/discounts/new">New discount</Link>
        </div>
        <p style={{ marginTop: '0.75rem', opacity: 0.8, maxWidth: 520 }}>
          Percentage or fixed-amount coupons applied at checkout. Demo seeds:{' '}
          <code>SAVE10</code>, <code>FLAT5</code>.
        </p>
        <DiscountList />
      </div>
    </AdminShell>
  );
}
