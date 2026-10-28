'use server';

import {
  createMigrationJob,
  listMigrationJobs,
  runMigrationJob,
  type MigrationJob,
} from '../lib/api';

export async function fetchJobs(tenantId?: string): Promise<MigrationJob[]> {
  return listMigrationJobs(tenantId || undefined);
}

export async function createAndOptionallyRun(form: {
  tenantId: string;
  source: 'shopify_api' | 'csv' | 'fixture';
  entityTypes: string[];
  shopDomain?: string;
  accessToken?: string;
  csvProducts?: string;
  csvCustomers?: string;
  fixtureJson?: string;
  runNow: boolean;
}): Promise<{ job: MigrationJob; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      tenantId: form.tenantId.trim(),
      source: form.source,
      entityTypes: form.entityTypes,
    };
    if (form.shopDomain?.trim()) body.shopDomain = form.shopDomain.trim();
    if (form.accessToken?.trim()) body.accessToken = form.accessToken.trim();
    if (form.source === 'csv') {
      body.csv = {
        ...(form.csvProducts?.trim()
          ? { products: form.csvProducts }
          : {}),
        ...(form.csvCustomers?.trim()
          ? { customers: form.csvCustomers }
          : {}),
      };
    }
    if (form.source === 'fixture' && form.fixtureJson?.trim()) {
      body.fixture = JSON.parse(form.fixtureJson);
    }

    let job = await createMigrationJob(body);
    if (form.runNow) {
      job = await runMigrationJob(job.id);
    }
    return { job };
  } catch (err) {
    return {
      job: {
        id: '',
        tenantId: form.tenantId,
        source: form.source,
        entityTypes: form.entityTypes,
        status: 'failed',
        shopDomain: form.shopDomain ?? null,
        stats: {},
        error: err instanceof Error ? err.message : String(err),
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runJobAction(jobId: string): Promise<MigrationJob> {
  return runMigrationJob(jobId);
}
