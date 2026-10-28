/** Thin typed client for Nest API */

export type SdkApiOptions = {
  baseUrl: string;
  getToken?: () => string | undefined;
  getHost?: () => string | undefined;
  getCartToken?: () => string | undefined;
  /** Send cookies (httpOnly session). Default false. */
  credentials?: RequestCredentials;
};

export type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type CartLine = {
  id: string;
  variantId: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
  title?: string;
};

export type Cart = {
  id: string;
  tenantId: string;
  status: string;
  guestToken: string;
  customerId?: string | null;
  email: string | null;
  lines: CartLine[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity: number;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  variants: ProductVariant[];
};

export type VariantInput = {
  id?: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency?: string;
  inventoryQuantity?: number;
};

export type ProductCreateInput = {
  title: string;
  slug: string;
  description?: string | null;
  status?: string;
  variants: VariantInput[];
};

export type ProductUpdateInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: string;
  variants?: VariantInput[];
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  tenantId: string;
  kind: 'staff' | 'customer';
  role: string;
};

export type AuthResult = {
  user: AuthUser;
  token: string;
};

export type OfflinePaymentMethod = 'cod' | 'bank_transfer';

export type BankDetails = {
  accountName: string;
  accountNumber: string;
  bankName: string;
};

export type StorefrontPaymentMethod =
  | { id: 'cod'; label: string }
  | { id: 'bank_transfer'; label: string; bankDetails: BankDetails };

export type TenantPaymentSettings = {
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  stripeEnabled: boolean;
  updatedAt?: string;
};

export type PaymentSettingsUpdate = {
  codEnabled?: boolean;
  bankTransferEnabled?: boolean;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  stripeEnabled?: boolean;
};

export type StorefrontShippingMethod = {
  id: string;
  name: string;
  priceAmountMinor: number;
  currency: string;
  codCompatible: boolean;
  adapter: string;
};

export type ShippingMethod = StorefrontShippingMethod & {
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ShippingMethodCreate = {
  name: string;
  priceAmountMinor: number;
  currency?: string;
  codCompatible?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  adapter?: string;
};

export type ShippingMethodUpdate = Partial<ShippingMethodCreate>;

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';
export type DomainSslStatus = 'pending' | 'active' | 'error';

export type TenantDomain = {
  id: string;
  host: string;
  isPrimary: boolean;
  verificationStatus: DomainVerificationStatus;
  verifiedAt: string | null;
  sslStatus: DomainSslStatus;
  createdAt: string;
};

export type CnameInstructions = {
  cnameHost: string;
  cnameTarget: string;
  ttlHint: string;
  notes: string[];
};

export type DomainsConfig = {
  domains: TenantDomain[];
  cname: CnameInstructions;
  platformHosts: string[];
};

export type AnalyticsEventInput = {
  eventName: string;
  path?: string | null;
  sessionId?: string | null;
  properties?: Record<string, unknown> | null;
  occurredAt?: string | null;
};

export type AnalyticsEvent = {
  id: string;
  eventName: string;
  path: string | null;
  sessionId: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
};

export type AnalyticsSummary = {
  totalEvents: number;
  byEventName: Array<{ eventName: string; count: number }>;
  recent: AnalyticsEvent[];
  stub: true;
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
  fxRounding: string;
  fxDisclaimer: string | null;
  updatedAt?: string;
};

export type LocalizationSettingsUpdate = {
  defaultLocale?: string;
  defaultCurrency?: string;
  multiLanguage?: boolean;
  multiCurrency?: boolean;
  enabledLocales?: string[];
  enabledCurrencies?: string[];
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
  fxDisclaimer: string | null;
};

export type CookieBannerLayout = 'bottom' | 'modal';

export type StorefrontPrivacyConfig = {
  cookieBannerEnabled: boolean;
  cookieBannerLayout: CookieBannerLayout;
  analyticsCategoryEnabled: boolean;
  marketingCategoryEnabled: boolean;
  privacyPolicyUrl: string | null;
  cookiePolicyUrl: string | null;
  privacyContactEmail: string | null;
};

export type TenantPrivacySettings = StorefrontPrivacyConfig & {
  dpaAcknowledged: boolean;
  dpaAcknowledgedAt: string | null;
  retentionDays: number;
  updatedAt?: string;
};

export type PrivacySettingsUpdate = {
  dpaAcknowledged?: boolean;
  retentionDays?: number;
  privacyContactEmail?: string | null;
  cookieBannerEnabled?: boolean;
  cookieBannerLayout?: CookieBannerLayout;
  analyticsCategoryEnabled?: boolean;
  marketingCategoryEnabled?: boolean;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
};

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentEvent = {
  id: string;
  subjectKey: string;
  categories: ConsentCategories;
  source: string;
  createdAt: string;
};

export type DsarRequestType = 'export' | 'delete';

export type DsarRequestSummary = {
  id: string;
  requestType: DsarRequestType;
  status: string;
  subjectEmail: string;
  subjectKind: 'customer' | 'guest';
  customerId: string | null;
  actorKind: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  artifactExpiresAt: string | null;
  hasArtifact: boolean;
  errorMessage: string | null;
};

export type DsarRequestDetail = DsarRequestSummary & {
  artifact: Record<string, unknown> | null;
};

export type CheckoutSessionResult = {
  id: string;
  cartId: string;
  guestEmail: string;
  shippingAddress: ShippingAddress;
  addressValidation: {
    mode: string;
    valid: boolean;
    warnings: string[];
    normalized: ShippingAddress;
    provider: string;
  };
  shipping: {
    methodId: string;
    methodName: string;
    amountMinor: number;
    currency: string;
    adapter: string;
  };
  order: {
    id: string;
    status: string;
    paymentStatus: string;
    paymentMethod: OfflinePaymentMethod | string;
    subtotalAmountMinor: number;
    shippingAmountMinor: number;
    totalAmountMinor: number;
    currency: string;
    accessToken: string;
  };
  payment: { id: string; status: string; provider: string };
  bankTransferInstructions: BankDetails | null;
};

export type AdminOrderStatus =
  | 'pending'
  | 'placed'
  | 'cancelled'
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'shipped';

export type AdminOrderStatusUpdate = 'fulfilled' | 'shipped' | 'cancelled';

export type AdminOrderLine = {
  id: string;
  variantId: string;
  title: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  qtyRefunded: number;
};

export type AdminFulfillmentStatus =
  | 'pending'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type AdminFulfillmentLine = {
  id: string;
  orderLineId: string;
  qty: number;
  title: string;
};

export type AdminFulfillment = {
  id: string;
  status: AdminFulfillmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: AdminFulfillmentLine[];
};

export type CreateAdminFulfillmentInput = {
  lines: { orderLineId: string; qty: number }[];
  trackingNumber?: string | null;
  carrier?: string | null;
  markShipped?: boolean;
};

export type UpdateAdminFulfillmentInput = {
  trackingNumber?: string | null;
  carrier?: string | null;
  status?: AdminFulfillmentStatus;
};

export type AdminOrderSummary = {
  id: string;
  status: AdminOrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  guestEmail: string | null;
  customerId: string | null;
  totalAmountMinor: number;
  shippingAmountMinor: number;
  chargeCurrency: string;
  shippingMethodName: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
};

export type AdminOrderDetail = AdminOrderSummary & {
  cartId: string | null;
  checkoutSessionId: string | null;
  shippingAddress: ShippingAddress | null;
  shippingMethodId: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  lines: AdminOrderLine[];
  fulfillments: AdminFulfillment[];
};

export class ApiClient {
  constructor(private readonly opts: SdkApiOptions) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extra,
    };
    const token = this.opts.getToken?.();
    const host = this.opts.getHost?.();
    const cartToken = this.opts.getCartToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (host) headers['X-Forwarded-Host'] = host;
    if (cartToken) headers['X-Cart-Token'] = cartToken;
    return headers;
  }

  private credentials(): RequestCredentials | undefined {
    return this.opts.credentials;
  }

  private async parse<T>(res: Response, method: string, path: string): Promise<T> {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.opts.baseUrl}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return res.json() as Promise<{ status: string }>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      headers: this.headers(),
      credentials: this.credentials(),
    });
    return this.parse<T>(res, 'GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      credentials: this.credentials(),
    });
    return this.parse<T>(res, 'POST', path);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      credentials: this.credentials(),
    });
    return this.parse<T>(res, 'PATCH', path);
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
      credentials: this.credentials(),
    });
    return this.parse<T>(res, 'DELETE', path);
  }

  me(): Promise<AuthUser> {
    return this.get<AuthUser>('/v1/auth/me');
  }

  staffLogin(body: { email: string; password: string }): Promise<AuthResult> {
    return this.post<AuthResult>('/v1/auth/staff/login', body);
  }

  staffLogout(): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/v1/auth/staff/logout', {});
  }

  customerRegister(body: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthResult> {
    return this.post<AuthResult>('/v1/auth/customer/register', body);
  }

  customerLogin(body: {
    email: string;
    password: string;
  }): Promise<AuthResult> {
    return this.post<AuthResult>('/v1/auth/customer/login', body);
  }

  customerLogout(): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>('/v1/auth/customer/logout', {});
  }

  listProducts(): Promise<Product[]> {
    return this.get<Product[]>('/v1/catalog/products');
  }

  listAdminProducts(): Promise<Product[]> {
    return this.get<Product[]>('/v1/admin/catalog/products');
  }

  getAdminProduct(id: string): Promise<Product> {
    return this.get<Product>(`/v1/admin/catalog/products/${id}`);
  }

  createAdminProduct(body: ProductCreateInput): Promise<Product> {
    return this.post<Product>('/v1/admin/catalog/products', body);
  }

  updateAdminProduct(id: string, body: ProductUpdateInput): Promise<Product> {
    return this.patch<Product>(`/v1/admin/catalog/products/${id}`, body);
  }

  createCart(body?: { locale?: string; currency?: string }): Promise<Cart> {
    return this.post<Cart>('/v1/carts', body ?? {});
  }

  getCart(cartId: string): Promise<Cart> {
    return this.get<Cart>(`/v1/carts/${cartId}`);
  }

  addLine(
    cartId: string,
    body: { variantId: string; quantity: number },
  ): Promise<Cart> {
    return this.post<Cart>(`/v1/carts/${cartId}/lines`, body);
  }

  updateLine(
    cartId: string,
    lineId: string,
    body: { quantity: number },
  ): Promise<Cart> {
    return this.patch<Cart>(`/v1/carts/${cartId}/lines/${lineId}`, body);
  }

  removeLine(cartId: string, lineId: string): Promise<Cart> {
    return this.delete<Cart>(`/v1/carts/${cartId}/lines/${lineId}`);
  }

  listPaymentMethods(): Promise<StorefrontPaymentMethod[]> {
    return this.get<StorefrontPaymentMethod[]>('/v1/payments/methods');
  }

  listShippingMethods(paymentMethod?: string): Promise<StorefrontShippingMethod[]> {
    const q = paymentMethod
      ? `?paymentMethod=${encodeURIComponent(paymentMethod)}`
      : '';
    return this.get<StorefrontShippingMethod[]>(`/v1/shipping/methods${q}`);
  }

  createCheckoutSession(body: {
    cartId?: string;
    email: string;
    shippingAddress: ShippingAddress;
    paymentMethod: OfflinePaymentMethod;
    shippingMethodId: string;
  }): Promise<CheckoutSessionResult> {
    return this.post<CheckoutSessionResult>('/v1/checkout/sessions', body);
  }

  listAdminShippingMethods(): Promise<ShippingMethod[]> {
    return this.get<ShippingMethod[]>('/v1/admin/shipping/methods');
  }

  createAdminShippingMethod(body: ShippingMethodCreate): Promise<ShippingMethod> {
    return this.post<ShippingMethod>('/v1/admin/shipping/methods', body);
  }

  updateAdminShippingMethod(
    id: string,
    body: ShippingMethodUpdate,
  ): Promise<ShippingMethod> {
    return this.patch<ShippingMethod>(`/v1/admin/shipping/methods/${id}`, body);
  }

  getAdminPaymentSettings(): Promise<TenantPaymentSettings> {
    return this.get<TenantPaymentSettings>('/v1/admin/payments/settings');
  }

  updateAdminPaymentSettings(
    body: PaymentSettingsUpdate,
  ): Promise<TenantPaymentSettings> {
    return this.patch<TenantPaymentSettings>(
      '/v1/admin/payments/settings',
      body,
    );
  }

  getStorefrontLocalization(): Promise<StorefrontLocalization> {
    return this.get<StorefrontLocalization>('/v1/localization');
  }

  getAdminLocalizationSettings(): Promise<TenantLocalizationSettings> {
    return this.get<TenantLocalizationSettings>(
      '/v1/admin/localization/settings',
    );
  }

  updateAdminLocalizationSettings(
    body: LocalizationSettingsUpdate,
  ): Promise<TenantLocalizationSettings> {
    return this.patch<TenantLocalizationSettings>(
      '/v1/admin/localization/settings',
      body,
    );
  }

  listAdminOrders(): Promise<AdminOrderSummary[]> {
    return this.get<AdminOrderSummary[]>('/v1/admin/orders');
  }

  getAdminOrder(id: string): Promise<AdminOrderDetail> {
    return this.get<AdminOrderDetail>(`/v1/admin/orders/${id}`);
  }

  updateAdminOrderStatus(
    id: string,
    body: {
      status: AdminOrderStatusUpdate;
      trackingNumber?: string | null;
      trackingCarrier?: string | null;
    },
  ): Promise<AdminOrderDetail> {
    return this.patch<AdminOrderDetail>(`/v1/admin/orders/${id}/status`, body);
  }

  createAdminFulfillment(
    orderId: string,
    body: CreateAdminFulfillmentInput,
  ): Promise<AdminOrderDetail> {
    return this.post<AdminOrderDetail>(
      `/v1/admin/orders/${orderId}/fulfillments`,
      body,
    );
  }

  updateAdminFulfillment(
    orderId: string,
    fulfillmentId: string,
    body: UpdateAdminFulfillmentInput,
  ): Promise<AdminOrderDetail> {
    return this.patch<AdminOrderDetail>(
      `/v1/admin/orders/${orderId}/fulfillments/${fulfillmentId}`,
      body,
    );
  }

  getAdminDomains(): Promise<DomainsConfig> {
    return this.get<DomainsConfig>('/v1/admin/domains');
  }

  getCnameInstructions(): Promise<CnameInstructions> {
    return this.get<CnameInstructions>('/v1/admin/domains/cname-instructions');
  }

  addAdminDomain(body: {
    host: string;
    isPrimary?: boolean;
  }): Promise<TenantDomain> {
    return this.post<TenantDomain>('/v1/admin/domains', body);
  }

  verifyAdminDomain(id: string): Promise<TenantDomain> {
    return this.post<TenantDomain>(`/v1/admin/domains/${id}/verify`, {});
  }

  removeAdminDomain(id: string): Promise<void> {
    return this.delete<void>(`/v1/admin/domains/${id}`);
  }

  ingestAnalyticsEvent(body: AnalyticsEventInput): Promise<AnalyticsEvent> {
    return this.post<AnalyticsEvent>('/v1/analytics/events', body);
  }

  getAdminAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.get<AnalyticsSummary>('/v1/admin/analytics/summary');
  }

  getPrivacyConfig(): Promise<StorefrontPrivacyConfig> {
    return this.get<StorefrontPrivacyConfig>('/v1/privacy/config');
  }

  recordConsent(body: {
    subjectKey: string;
    analytics?: boolean;
    marketing?: boolean;
    source?: string;
  }): Promise<ConsentEvent> {
    return this.post<ConsentEvent>('/v1/privacy/consent', body);
  }

  createGuestDsar(body: {
    requestType: DsarRequestType;
    email: string;
    orderAccessToken: string;
  }): Promise<DsarRequestDetail> {
    return this.post<DsarRequestDetail>('/v1/privacy/dsar/guest', body);
  }

  listCustomerDsar(): Promise<DsarRequestSummary[]> {
    return this.get<DsarRequestSummary[]>('/v1/privacy/account/dsar');
  }

  getCustomerDsar(id: string): Promise<DsarRequestDetail> {
    return this.get<DsarRequestDetail>(`/v1/privacy/account/dsar/${id}`);
  }

  createCustomerExport(): Promise<DsarRequestDetail> {
    return this.post<DsarRequestDetail>('/v1/privacy/account/dsar/export', {});
  }

  createCustomerDelete(body: { password: string }): Promise<DsarRequestDetail> {
    return this.post<DsarRequestDetail>(
      '/v1/privacy/account/dsar/delete',
      body,
    );
  }

  getAdminPrivacySettings(): Promise<TenantPrivacySettings> {
    return this.get<TenantPrivacySettings>('/v1/admin/privacy/settings');
  }

  updateAdminPrivacySettings(
    body: PrivacySettingsUpdate,
  ): Promise<TenantPrivacySettings> {
    return this.patch<TenantPrivacySettings>(
      '/v1/admin/privacy/settings',
      body,
    );
  }

  listAdminDsar(): Promise<DsarRequestSummary[]> {
    return this.get<DsarRequestSummary[]>('/v1/admin/privacy/dsar');
  }

  getAdminDsar(id: string): Promise<DsarRequestDetail> {
    return this.get<DsarRequestDetail>(`/v1/admin/privacy/dsar/${id}`);
  }
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
