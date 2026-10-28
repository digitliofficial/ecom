import type { CmsBootstrap, Policy, PolicyKind } from '@ecom/sdk-api';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function getTenantHost(): string {
  return process.env.STOREFRONT_TENANT_HOST ?? 'demo.localhost';
}

async function cmsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Forwarded-Host': getTenantHost(),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CMS ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCmsBootstrap(locale: string): Promise<CmsBootstrap | null> {
  try {
    return await cmsFetch<CmsBootstrap>(
      `/v1/cms/bootstrap?locale=${encodeURIComponent(locale)}`,
    );
  } catch {
    return null;
  }
}

export async function fetchCmsPolicy(
  kind: PolicyKind,
  locale: string,
): Promise<Policy | null> {
  try {
    return await cmsFetch<Policy>(
      `/v1/cms/policies/${encodeURIComponent(kind)}?locale=${encodeURIComponent(locale)}`,
    );
  } catch {
    return null;
  }
}

export const POLICY_KINDS: PolicyKind[] = [
  'privacy',
  'refund',
  'terms',
  'shipping',
  'cookie',
];

export function isPolicyKind(value: string): value is PolicyKind {
  return (POLICY_KINDS as string[]).includes(value);
}
