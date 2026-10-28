const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

const PLATFORM_KEY =
  process.env.PLATFORM_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_PLATFORM_API_KEY?.trim() ||
  'ecom-local-platform-key-change-me';

export type MigrationJob = {
  id: string;
  tenantId: string;
  source: string;
  entityTypes: string[];
  status: string;
  shopDomain: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

async function platformFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}/v1/platform/migration${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Platform-Key': PLATFORM_KEY,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export function listMigrationJobs(tenantId?: string): Promise<MigrationJob[]> {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return platformFetch<MigrationJob[]>(`/jobs${q}`);
}

export function createMigrationJob(body: unknown): Promise<MigrationJob> {
  return platformFetch<MigrationJob>('/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function runMigrationJob(id: string): Promise<MigrationJob> {
  return platformFetch<MigrationJob>(`/jobs/${id}/run`, { method: 'POST' });
}
