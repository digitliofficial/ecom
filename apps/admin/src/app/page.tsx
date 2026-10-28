import { cookies } from 'next/headers';
import Link from 'next/link';
import type { TenantBillingSnapshot } from '@ecom/sdk-api';
import { AdminShell } from '../components/AdminShell';
import { UsageMeters } from '../components/UsageMeters';
import {
  STAFF_SESSION_COOKIE,
  readStaffEmailFromCookie,
} from '../lib/auth-session';
import { getApiBaseUrl, getTenantHost } from '../lib/api';

async function fetchUsage(
  token: string | undefined,
): Promise<TenantBillingSnapshot | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/admin/billing/usage`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Forwarded-Host': getTenantHost(),
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as TenantBillingSnapshot;
  } catch {
    return null;
  }
}

export default async function AdminHome() {
  const jar = await cookies();
  const token = jar.get(STAFF_SESSION_COOKIE)?.value;
  const email =
    readStaffEmailFromCookie(token) ?? 'owner@demo.localhost';
  const usage = await fetchUsage(token);

  return (
    <AdminShell email={email}>
      <p style={{ marginTop: '1.5rem', maxWidth: 560 }}>
        Signed in as demo tenant staff. Manage catalog, orders (split
        fulfillments), offline payments, shipping methods, custom domains,
        analytics ingest, CMS (menus / SEO / theme / policies), privacy
        (cookie consent + DSAR), notifications (lifecycle + abandoned cart),
        localization (multi-language / multi-currency), and plan metering.
      </p>
      <ul style={{ marginTop: '1.25rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
        <li>
          <Link href="/products">Products</Link> — list / create / edit catalog
        </li>
        <li>
          <Link href="/orders">Orders</Link> — list / detail / fulfill · ship · cancel
        </li>
        <li>
          <Link href="/payments">Payments</Link> — COD + bank transfer settings
        </li>
        <li>
          <Link href="/shipping">Shipping</Link> — flat-rate methods + COD flag
        </li>
        <li>
          <Link href="/domains">Domains</Link> — CNAME instructions + tenant domain table
        </li>
        <li>
          <Link href="/analytics">Analytics</Link> — event totals dashboard stub
        </li>
        <li>
          <Link href="/cms">CMS</Link> — menus, SEO, theme pack, policy pages
        </li>
        <li>
          <Link href="/privacy">Privacy</Link> — cookie banner, DPA, DSAR inbox
        </li>
        <li>
          <Link href="/notifications">Notifications</Link> — email prefs + abandoned cart
        </li>
        <li>
          <Link href="/localization">Localization</Link> — multi-language &amp;
          multi-currency (plan-capped)
        </li>
        <li>
          <Link href="/staff">Staff</Link> — seats (plan-capped)
        </li>
        <li>
          <Link href="/plans">Plans</Link> — usage meters, compare tiers, Stripe Billing stub
        </li>
      </ul>

      {usage ? (
        <div style={{ marginTop: '2rem', maxWidth: 520 }}>
          <UsageMeters
            meters={usage.meters}
            softWarnings={usage.softWarnings}
            planName={usage.plan.name}
            planCode={usage.plan.code}
          />
        </div>
      ) : null}

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
