import { cookies } from 'next/headers';
import Link from 'next/link';
import type { StaffMember } from '@ecom/sdk-api';
import { AdminShell } from '../../components/AdminShell';
import { StaffInviteForm } from '../../components/StaffInviteForm';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';
import { getApiBaseUrl, getTenantHost } from '../../lib/api';

async function fetchStaff(token: string | undefined): Promise<StaffMember[]> {
  if (!token) return [];
  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/admin/billing/staff`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Forwarded-Host': getTenantHost(),
      },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return (await res.json()) as StaffMember[];
  } catch {
    return [];
  }
}

export default async function StaffPage() {
  const jar = await cookies();
  const token = jar.get(STAFF_SESSION_COOKIE)?.value;
  const email =
    readStaffEmailFromCookie(token) ?? 'owner@demo.localhost';
  const staff = await fetchStaff(token);

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem', maxWidth: 640 }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/">← Dashboard</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Staff seats</h2>
        <p style={{ opacity: 0.8 }}>
          Seat count is hard-capped by your plan. Hitting the limit shows an
          upgrade prompt — see <Link href="/plans">Plans</Link>.
        </p>
        <StaffInviteForm initialStaff={staff} />
      </div>
    </AdminShell>
  );
}
