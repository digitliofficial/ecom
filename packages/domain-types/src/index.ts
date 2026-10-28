/** Shared domain types */

export type Money = {
  amountMinor: bigint | number;
  currency: string;
};

export type TenantStatus = 'active' | 'suspended' | 'provisioning';

export type Tenant = {
  id: string;
  slug: string;
  status: TenantStatus;
  planId?: string | null;
  dataRegion?: string | null;
};

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';
export type DomainSslStatus = 'pending' | 'active' | 'error';

export type TenantDomain = {
  id: string;
  tenantId: string;
  host: string;
  isPrimary: boolean;
  verificationStatus?: DomainVerificationStatus;
  verifiedAt?: string | null;
  sslStatus?: DomainSslStatus;
};

export type AnalyticsEventName =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'custom';

export type AnalyticsEvent = {
  id: string;
  tenantId: string;
  eventName: AnalyticsEventName | string;
  path?: string | null;
  sessionId?: string | null;
  properties?: Record<string, unknown>;
  occurredAt: string;
};

export type CartStatus = 'active' | 'converted' | 'abandoned';

export type Cart = {
  id: string;
  tenantId: string;
  status: CartStatus;
  guestToken?: string | null;
  locale?: string | null;
  displayCurrency?: string | null;
  chargeCurrency?: string | null;
  email?: string | null;
};

export type CartLine = {
  id: string;
  cartId: string;
  tenantId: string;
  variantId: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
};

export type CheckoutSession = {
  id: string;
  tenantId: string;
  cartId: string;
  guestEmail?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  addressValidated?: boolean | null;
  addressProvider?: string | null;
  normalizedAddress?: Record<string, unknown> | null;
};

export type OrderStatus =
  | 'pending'
  | 'placed'
  | 'cancelled'
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'shipped';

export type OrderLine = {
  id: string;
  variantId: string;
  title: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  qtyRefunded?: number;
};

export type FulfillmentStatus =
  | 'pending'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type FulfillmentLine = {
  id: string;
  orderLineId: string;
  qty: number;
  title?: string;
};

export type Fulfillment = {
  id: string;
  status: FulfillmentStatus;
  trackingNumber?: string | null;
  carrier?: string | null;
  shippedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines: FulfillmentLine[];
};

export type OfflinePaymentMethod = 'cod' | 'bank_transfer';

export type ShippingMethod = {
  id: string;
  tenantId?: string;
  name: string;
  priceAmountMinor: number;
  currency: string;
  codCompatible: boolean;
  enabled?: boolean;
  sortOrder?: number;
  adapter?: string;
};

export type Order = {
  id: string;
  tenantId: string;
  cartId?: string | null;
  checkoutSessionId?: string | null;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod?: OfflinePaymentMethod | string | null;
  guestEmail?: string | null;
  customerId?: string | null;
  totalAmountMinor: number;
  shippingAmountMinor?: number;
  chargeCurrency: string;
  shippingMethodId?: string | null;
  shippingMethodName?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: OrderLine[];
  fulfillments?: Fulfillment[];
};

export type TenantPaymentSettings = {
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  stripeEnabled: boolean;
};

export type TenantLocalizationSettings = {
  defaultLocale: string;
  defaultCurrency: string;
  multiLanguage: boolean;
  multiCurrency: boolean;
  enabledLocales: string[];
  enabledCurrencies: string[];
  availableLocales: string[];
  availableCurrencies: string[];
  maxLocales: number;
  maxCurrencies: number;
  fxRounding?: string;
  fxDisclaimer?: string | null;
};

export type StorefrontLocalization = {
  defaultLocale: string;
  defaultCurrency: string;
  multiLanguage: boolean;
  multiCurrency: boolean;
  locales: string[];
  currencies: string[];
  fxDisclaimer?: string | null;
};

export type CookieBannerLayout = 'bottom' | 'modal';

export type TenantPrivacySettings = {
  dpaAcknowledged: boolean;
  retentionDays: number;
  privacyContactEmail?: string | null;
  cookieBannerEnabled: boolean;
  cookieBannerLayout: CookieBannerLayout;
  analyticsCategoryEnabled: boolean;
  marketingCategoryEnabled: boolean;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
};

export type DsarRequestType = 'export' | 'delete';

export type DsarRequest = {
  id: string;
  tenantId: string;
  requestType: DsarRequestType;
  status: string;
  subjectEmail: string;
  customerId?: string | null;
};


export type PolicyKind =
  | 'privacy'
  | 'refund'
  | 'terms'
  | 'shipping'
  | 'cookie';

export type MenuHandle = 'header' | 'footer';

export type ThemeTokenOverrides = Partial<{
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  border: string;
  displayFont: string;
  bodyFont: string;
}>;

export type ProductStatus = 'active' | 'draft' | 'archived';

export type Product = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  status?: ProductStatus | string;
};

export type ProductVariant = {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity?: number;
};
