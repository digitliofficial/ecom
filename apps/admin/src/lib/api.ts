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
  type CustomerGroup,
  type Menu,
  type MenuHandle,
  type MenuUpdateInput,
  type DomainsConfig,
  type DsarRequestDetail,
  type DsarRequestSummary,
  type LocalizationSettingsUpdate,
  type NotificationSettingsUpdate,
  type PaymentSettingsUpdate,
  type PlanView,
  type PriceList,
  type PrivacySettingsUpdate,
  type Product,
  type ProductCreateInput,
  type ProductReview,
  type ProductUpdateInput,
  type ReviewStatus,
  type SoftLimitWarning,
  type StaffMember,
  type StripeBillingStubResult,
  type TenantBillingSnapshot,
  type TenantLocale,
  type ShippingMethod,
  type ShippingMethodCreate,
  type ShippingMethodUpdate,
  type TenantDomain,
  type TenantLocalizationSettings,
  type Policy,
  type PolicyKind,
  type PolicyUpdateInput,
  type SeoSettings,
  type SeoSettingsUpdate,
  type TenantNotificationSettings,
  type TenantPaymentSettings,
  type TenantPrivacySettings,
  type ThemeSettings,
  type ThemeSettingsUpdate,
  type ThemeTokens,
  type UpdateAdminFulfillmentInput,
} from '@ecom/sdk-api';
import {
  clearStaffBearer,
  readStaffBearer,
  setStaffBearer,
} from './auth-session';

export type {
  PlanView,
  SoftLimitWarning,
  StaffMember,
  StripeBillingStubResult,
  TenantBillingSnapshot,
  TenantLocale,
};

export { ApiError } from '@ecom/sdk-api';

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

export async function getAdminNotificationSettings(): Promise<TenantNotificationSettings> {
  return client().getAdminNotificationSettings();
}

export async function updateAdminNotificationSettings(
  body: NotificationSettingsUpdate,
): Promise<TenantNotificationSettings> {
  return client().updateAdminNotificationSettings(body);
}

export async function processAdminNotifications(): Promise<{
  abandonedQueued: number;
  emailsSent: number;
}> {
  return client().processAdminNotifications();
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

export async function getAdminPrivacySettings(): Promise<TenantPrivacySettings> {
  return client().getAdminPrivacySettings();
}

export async function updateAdminPrivacySettings(
  body: PrivacySettingsUpdate,
): Promise<TenantPrivacySettings> {
  return client().updateAdminPrivacySettings(body);
}

export async function listAdminDsar(): Promise<DsarRequestSummary[]> {
  return client().listAdminDsar();
}

export async function getAdminDsar(id: string): Promise<DsarRequestDetail> {
  return client().getAdminDsar(id);
}


export async function listThemePacks(): Promise<ThemeTokens[]> {
  return client().listThemePacks();
}

export async function getAdminTheme(): Promise<ThemeSettings> {
  return client().getAdminTheme();
}

export async function updateAdminTheme(
  body: ThemeSettingsUpdate,
): Promise<ThemeSettings> {
  return client().updateAdminTheme(body);
}

export async function getAdminSeo(locale = 'en'): Promise<SeoSettings> {
  return client().getAdminSeo(locale);
}

export async function updateAdminSeo(
  body: SeoSettingsUpdate,
): Promise<SeoSettings> {
  return client().updateAdminSeo(body);
}

export async function getAdminMenu(
  handle: MenuHandle,
  locale = 'en',
): Promise<Menu> {
  return client().getAdminMenu(handle, locale);
}

export async function replaceAdminMenu(
  handle: MenuHandle,
  body: MenuUpdateInput,
): Promise<Menu> {
  return client().replaceAdminMenu(handle, body);
}

export async function listAdminPolicies(locale = 'en'): Promise<Policy[]> {
  return client().listAdminPolicies(locale);
}

export async function updateAdminPolicy(
  kind: PolicyKind,
  body: PolicyUpdateInput,
): Promise<Policy> {
  return client().updateAdminPolicy(kind, body);
}


export async function getBillingUsage(): Promise<TenantBillingSnapshot> {
  return client().getBillingUsage();
}

export async function listBillingPlans(): Promise<PlanView[]> {
  return client().listBillingPlans();
}

export async function changeBillingPlan(
  planCode: string,
): Promise<TenantBillingSnapshot> {
  return client().changeBillingPlan({ planCode });
}

export async function createStripeBillingCheckout(input: {
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeBillingStubResult> {
  return client().createStripeBillingCheckout(input);
}

export async function createStripeBillingPortal(
  returnUrl: string,
): Promise<StripeBillingStubResult> {
  return client().createStripeBillingPortal({ returnUrl });
}

export async function listStaffMembers(): Promise<StaffMember[]> {
  return client().listStaffMembers();
}

export async function inviteStaffMember(input: {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}): Promise<Omit<StaffMember, 'createdAt'>> {
  return client().inviteStaffMember(input);
}

export async function listTenantLocales(): Promise<TenantLocale[]> {
  return client().listTenantLocales();
}

export async function enableTenantLocale(locale: string): Promise<TenantLocale> {
  return client().enableTenantLocale({ locale });
}

export async function disableTenantLocale(
  locale: string,
): Promise<{ ok: boolean }> {
  return client().disableTenantLocale(locale);
}

export async function listAdminReviews(
  status?: ReviewStatus,
): Promise<ProductReview[]> {
  return client().listAdminReviews(status);
}

export async function moderateAdminReview(
  id: string,
  status: ReviewStatus,
): Promise<ProductReview> {
  return client().moderateAdminReview(id, { status });
}

export async function listAdminPriceLists(): Promise<PriceList[]> {
  return client().listAdminPriceLists();
}

export async function createAdminPriceList(body: {
  name: string;
  currency?: string;
  items?: {
    variantId: string;
    unitAmountMinor: number;
    currency?: string;
  }[];
}): Promise<PriceList> {
  return client().createAdminPriceList(body);
}

export async function updateAdminPriceList(
  id: string,
  body: {
    name?: string;
    currency?: string;
    items?: {
      variantId: string;
      unitAmountMinor: number;
      currency?: string;
    }[];
  },
): Promise<PriceList> {
  return client().updateAdminPriceList(id, body);
}

export async function listAdminCustomerGroups(): Promise<CustomerGroup[]> {
  return client().listAdminCustomerGroups();
}

export async function createAdminCustomerGroup(body: {
  name: string;
  priceListId?: string | null;
  customerIds?: string[];
}): Promise<CustomerGroup> {
  return client().createAdminCustomerGroup(body);
}

export async function updateAdminCustomerGroup(
  id: string,
  body: {
    name?: string;
    priceListId?: string | null;
    customerIds?: string[];
  },
): Promise<CustomerGroup> {
  return client().updateAdminCustomerGroup(id, body);
}

export async function addAdminCustomerGroupMember(
  groupId: string,
  customerId: string,
): Promise<CustomerGroup> {
  return client().addAdminCustomerGroupMember(groupId, { customerId });
}

export async function removeAdminCustomerGroupMember(
  groupId: string,
  customerId: string,
): Promise<CustomerGroup> {
  return client().removeAdminCustomerGroupMember(groupId, customerId);
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
