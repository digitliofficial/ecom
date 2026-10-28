'use client';

import {
  createApiClient,
  type Product,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@ecom/sdk-api';
import { readStubSessionClient } from './auth-session';

/** Stub bearer for StaffAuthGuard — any non-empty token works in Phase 0. */
export const ADMIN_STUB_BEARER = 'stub-admin';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/** Demo tenant for local stub session (hosts map in seed). */
export function getTenantHost(): string {
  return 'demo.localhost';
}

function client() {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getHost: getTenantHost,
    getToken: () => {
      const session = readStubSessionClient();
      return session ? ADMIN_STUB_BEARER : undefined;
    },
  });
}

export async function listAdminProducts(): Promise<Product[]> {
  return client().listAdminProducts();
}

export async function getAdminProduct(id: string): Promise<Product> {
  return client().getAdminProduct(id);
}

export async function createAdminProduct(
  body: ProductCreateInput,
): Promise<Product> {
  return client().createAdminProduct(body);
}

export async function updateAdminProduct(
  id: string,
  body: ProductUpdateInput,
): Promise<Product> {
  return client().updateAdminProduct(id, body);
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
