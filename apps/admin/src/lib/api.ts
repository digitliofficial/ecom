'use client';

import {
  createApiClient,
  type AdminOrderDetail,
  type AdminOrderStatusUpdate,
  type AdminOrderSummary,
  type AuthResult,
  type AuthUser,
  type Product,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@ecom/sdk-api';
import {
  clearStaffBearer,
  readStaffBearer,
  setStaffBearer,
} from './auth-session';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/** Demo tenant for local session (hosts map in seed). */
export function getTenantHost(): string {
  return 'demo.localhost';
}

function client() {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getHost: getTenantHost,
    getToken: () => readStaffBearer(),
    credentials: 'include',
  });
}

export async function staffLogin(
  email: string,
  password: string,
): Promise<AuthResult> {
  const result = await client().staffLogin({ email, password });
  setStaffBearer(result.token);
  return result;
}

export async function staffLogout(): Promise<void> {
  try {
    await client().staffLogout();
  } finally {
    clearStaffBearer();
  }
}

export async function fetchStaffMe(): Promise<AuthUser> {
  return client().me();
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

export async function listAdminOrders(): Promise<AdminOrderSummary[]> {
  return client().listAdminOrders();
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  return client().getAdminOrder(id);
}

export async function updateAdminOrderStatus(
  id: string,
  status: AdminOrderStatusUpdate,
): Promise<AdminOrderDetail> {
  return client().updateAdminOrderStatus(id, { status });
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
