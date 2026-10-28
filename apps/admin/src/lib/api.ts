'use client';

import {
  createApiClient,
  type AdminOrderDetail,
  type AdminOrderStatusUpdate,
  type AdminOrderSummary,
  type AnalyticsSummary,
  type AuthResult,
  type AuthUser,
  type CreateAdminFulfillmentInput,
  type DomainsConfig,
  type LocalizationSettingsUpdate,
  type PaymentSettingsUpdate,
  type Product,
  type ProductCreateInput,
  type ProductUpdateInput,
  type ShippingMethod,
  type ShippingMethodCreate,
  type ShippingMethodUpdate,
  type TenantDomain,
  type TenantLocalizationSettings,
  type TenantPaymentSettings,
  type UpdateAdminFulfillmentInput,
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
  tracking?: { trackingNumber?: string | null; trackingCarrier?: string | null },
): Promise<AdminOrderDetail> {
  return client().updateAdminOrderStatus(id, {
    status,
    trackingNumber: tracking?.trackingNumber,
    trackingCarrier: tracking?.trackingCarrier,
  });
}

export async function listAdminShippingMethods(): Promise<ShippingMethod[]> {
  return client().listAdminShippingMethods();
}

export async function createAdminShippingMethod(
  body: ShippingMethodCreate,
): Promise<ShippingMethod> {
  return client().createAdminShippingMethod(body);
}

export async function updateAdminShippingMethod(
  id: string,
  body: ShippingMethodUpdate,
): Promise<ShippingMethod> {
  return client().updateAdminShippingMethod(id, body);
}

export async function createAdminFulfillment(
  orderId: string,
  body: CreateAdminFulfillmentInput,
): Promise<AdminOrderDetail> {
  return client().createAdminFulfillment(orderId, body);
}

export async function updateAdminFulfillment(
  orderId: string,
  fulfillmentId: string,
  body: UpdateAdminFulfillmentInput,
): Promise<AdminOrderDetail> {
  return client().updateAdminFulfillment(orderId, fulfillmentId, body);
}

export async function getAdminPaymentSettings(): Promise<TenantPaymentSettings> {
  return client().getAdminPaymentSettings();
}

export async function updateAdminPaymentSettings(
  body: PaymentSettingsUpdate,
): Promise<TenantPaymentSettings> {
  return client().updateAdminPaymentSettings(body);
}

export async function getAdminDomains(): Promise<DomainsConfig> {
  return client().getAdminDomains();
}

export async function addAdminDomain(body: {
  host: string;
  isPrimary?: boolean;
}): Promise<TenantDomain> {
  return client().addAdminDomain(body);
}

export async function verifyAdminDomain(id: string): Promise<TenantDomain> {
  return client().verifyAdminDomain(id);
}

export async function removeAdminDomain(id: string): Promise<void> {
  return client().removeAdminDomain(id);
}

export async function getAdminAnalyticsSummary(): Promise<AnalyticsSummary> {
  return client().getAdminAnalyticsSummary();
}

export async function getAdminLocalizationSettings(): Promise<TenantLocalizationSettings> {
  return client().getAdminLocalizationSettings();
}

export async function updateAdminLocalizationSettings(
  body: LocalizationSettingsUpdate,
): Promise<TenantLocalizationSettings> {
  return client().updateAdminLocalizationSettings(body);
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
