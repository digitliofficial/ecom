'use client';

import {
  createApiClient,
  type AdminOrderDetail,
  type AdminOrderStatusUpdate,
  type AdminOrderSummary,
  type AuthResult,
  type AuthUser,
  type Collection,
  type CollectionCreateInput,
  type CollectionUpdateInput,
  type Discount,
  type DiscountCreateInput,
  type DiscountUpdateInput,
  type InventoryLevel,
  type InventoryLocation,
  type LocationCreateInput,
  type LocationUpdateInput,
  type PaymentSettingsUpdate,
  type Product,
  type ProductCreateInput,
  type ProductUpdateInput,
  type SetStockInput,
  type TenantPaymentSettings,
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

export async function getAdminPaymentSettings(): Promise<TenantPaymentSettings> {
  return client().getAdminPaymentSettings();
}

export async function updateAdminPaymentSettings(
  body: PaymentSettingsUpdate,
): Promise<TenantPaymentSettings> {
  return client().updateAdminPaymentSettings(body);
}

export async function listAdminCollections(): Promise<Collection[]> {
  return client().listAdminCollections();
}

export async function getAdminCollection(id: string): Promise<Collection> {
  return client().getAdminCollection(id);
}

export async function createAdminCollection(
  body: CollectionCreateInput,
): Promise<Collection> {
  return client().createAdminCollection(body);
}

export async function updateAdminCollection(
  id: string,
  body: CollectionUpdateInput,
): Promise<Collection> {
  return client().updateAdminCollection(id, body);
}

export async function deleteAdminCollection(id: string): Promise<void> {
  return client().deleteAdminCollection(id);
}

export async function listAdminDiscounts(): Promise<Discount[]> {
  return client().listAdminDiscounts();
}

export async function getAdminDiscount(id: string): Promise<Discount> {
  return client().getAdminDiscount(id);
}

export async function createAdminDiscount(
  body: DiscountCreateInput,
): Promise<Discount> {
  return client().createAdminDiscount(body);
}

export async function updateAdminDiscount(
  id: string,
  body: DiscountUpdateInput,
): Promise<Discount> {
  return client().updateAdminDiscount(id, body);
}

export async function deleteAdminDiscount(id: string): Promise<void> {
  return client().deleteAdminDiscount(id);
}

export async function listAdminLocations(): Promise<InventoryLocation[]> {
  return client().listAdminLocations();
}

export async function createAdminLocation(
  body: LocationCreateInput,
): Promise<InventoryLocation> {
  return client().createAdminLocation(body);
}

export async function updateAdminLocation(
  id: string,
  body: LocationUpdateInput,
): Promise<InventoryLocation> {
  return client().updateAdminLocation(id, body);
}

export async function listAdminInventoryLevels(): Promise<InventoryLevel[]> {
  return client().listAdminInventoryLevels();
}

export async function setAdminInventoryLevel(
  body: SetStockInput,
): Promise<InventoryLevel> {
  return client().setAdminInventoryLevel(body);
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
