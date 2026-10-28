import { cookies } from 'next/headers';
import Link from 'next/link';
import { AdminShell } from '../../components/AdminShell';
import { PlansPanel } from '../../components/PlansPanel';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../../lib/auth-session';
import { getApiBaseUrl, getTenantHost } from '../../lib/api';
import type { PlanView, TenantBillingSnapshot } from '@ecom/sdk-api';

async function fetchBilling(token: string | undefined): Promise<{
  usage: TenantBillingSnapshot | null;
  plans: PlanView[];
  error: string | null;
}> {
  if (!token) {
    return { usage: null, plans: [], error: 'Not signed in' };
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Forwarded-Host': getTenantHost(),
  };
  const base = getApiBaseUrl();
  try {
    const [usageRes, plansRes] = await Promise.all([
      fetch(`${base}/v1/admin/billing/usage`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${base}/v1/admin/billing/plans`, {
        headers,
        cache: 'no-store',
      }),
    ]);
    if (!usageRes.ok || !plansRes.ok) {
      return {
        usage: null,
        plans: [],
        error: `Billing API ${usageRes.status}/${plansRes.status}`,
      };
    }
    return {
      usage: (await usageRes.json()) as TenantBillingSnapshot,
      plans: (await plansRes.json()) as PlanView[],
      error: null,
    };
  } catch (err) {
    return {
      usage: null,
      plans: [],
      error: err instanceof Error ? err.message : 'Failed to load billing',
    };
  }
}

export default async function PlansPage() {
  const jar = await cookies();
  const token = jar.get(STAFF_SESSION_COOKIE)?.value;
  const email =
    readStaffEmailFromCookie(token) ?? 'owner@demo.localhost';
  const { usage, plans, error } = await fetchBilling(token);

  return (
    <AdminShell email={email}>
      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ marginTop: 0 }}>
          <Link href="/">← Dashboard</Link>
        </p>
        <h2 style={{ marginTop: '1rem' }}>Plans &amp; usage</h2>
        {error || !usage ? (
          <p role="alert" style={{ color: '#9f1239' }}>
            {error ?? 'Unable to load plan usage. Is the API running?'}
          </p>
        ) : (
          <PlansPanel initialUsage={usage} plans={plans} />
        )}
      </div>
    </AdminShell>
  );
}
