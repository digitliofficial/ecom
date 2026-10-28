/** Thin typed client for Nest API */

export type SdkApiOptions = {
  baseUrl: string;
  getToken?: () => string | undefined;
  getHost?: () => string | undefined;
  getCartToken?: () => string | undefined;
  /** Platform ops key for /v1/platform/* (migration). */
  getPlatformKey?: () => string | undefined;
  /** Send cookies (httpOnly session). Default false. */
  credentials?: RequestCredentials;
};

export type MigrationSource = 'shopify_api' | 'csv' | 'fixture';

export type MigrationEntityType =
  | 'products'
  | 'customers'
  | 'orders'
  | 'redirects';

export type MigrationJob = {
  id: string;
  tenantId: string;
  source: MigrationSource;
  entityTypes: MigrationEntityType[];
  status: string;
  shopDomain: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type CreateMigrationJobInput = {
  tenantId: string;
  source: MigrationSource;
  entityTypes: MigrationEntityType[];
  shopDomain?: string;
  accessToken?: string;
  csv?: Partial<Record<'products' | 'customers', string>>;
  fixture?: Record<string, unknown>;
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
  priceSource?: 'retail' | 'price_list';
  compareAtAmountMinor?: number;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  ratingAvg?: number;
  ratingCount?: number;
  variants: ProductVariant[];
};

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type ProductReview = {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title: string | null;
  body: string;
  locale: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  authorDisplayName: string | null;
  createdAt: string;
  moderatedAt: string | null;
};

export type ProductRatingSummary = {
  productId: string;
  ratingAvg: number;
  ratingCount: number;
};

export type WishlistItem = {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity: number;
  priceSource: 'retail' | 'price_list';
  createdAt: string;
};

export type Wishlist = {
  id: string;
  customerId: string;
  items: WishlistItem[];
};

export type PriceListItem = {
  id: string;
  variantId: string;
  unitAmountMinor: number;
  currency: string;
  sku?: string;
  variantTitle?: string;
};

export type PriceList = {
  id: string;
  name: string;
  currency: string;
  items: PriceListItem[];
};

export type CustomerGroupMember = {
  customerId: string;
  email: string;
  displayName: string | null;
};

export type CustomerGroup = {
  id: string;
  name: string;
  priceListId: string | null;
  memberCount: number;
  members: CustomerGroupMember[];
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

export type TenantNotificationSettings = {
  orderPlacedCustomer: boolean;
  orderPlacedMerchant: boolean;
  orderShippedCustomer: boolean;
  orderCancelledCustomer: boolean;
  abandonedCartEnabled: boolean;
  abandonedCartIdleMinutes: number;
  merchantAlertEmail: string | null;
  updatedAt?: string;
};

export type NotificationSettingsUpdate = {
  orderPlacedCustomer?: boolean;
  orderPlacedMerchant?: boolean;
  orderShippedCustomer?: boolean;
  orderCancelledCustomer?: boolean;
  abandonedCartEnabled?: boolean;
  abandonedCartIdleMinutes?: number;
  merchantAlertEmail?: string | null;
};

export type NotificationProcessResult = {
  abandonedQueued: number;
  emailsSent: number;
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

export type ThemeTokens = {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    border: string;
  };
  fonts: {
    display: string;
    body: string;
  };
};

export type ThemeSettings = {
  themePackId: string;
  tokenOverrides: ThemeTokenOverrides;
  resolved: ThemeTokens;
  updatedAt?: string;
};

export type ThemeSettingsUpdate = {
  themePackId?: string;
  tokenOverrides?: ThemeTokenOverrides | null;
};

export type SeoSettings = {
  locale: string;
  siteTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  updatedAt?: string;
};

export type SeoSettingsUpdate = {
  locale?: string;
  siteTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string | null;
};

export type MenuItem = {
  id?: string;
  label: string;
  href: string;
  position: number;
  locale: string | null;
};

export type Menu = {
  handle: MenuHandle;
  title: string;
  items: MenuItem[];
  updatedAt?: string;
};

export type MenuUpdateInput = {
  title?: string;
  items: Array<{
    label: string;
    href: string;
    position?: number;
    locale?: string | null;
  }>;
};

export type Policy = {
  kind: PolicyKind;
  locale: string;
  title: string;
  body: string;
  updatedAt?: string;
};

export type PolicyUpdateInput = {
  locale?: string;
  title?: string;
  body?: string;
};

export type CmsBootstrap = {
  locale: string;
  theme: ThemeSettings;
  seo: SeoSettings;
  menus: { header: Menu; footer: Menu };
  policies: Array<Pick<Policy, 'kind' | 'title' | 'locale'>>;
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

export type PlanView = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  entitlements: Record<string, string>;
};

export type UsageMeter = {
  metric: 'products' | 'staff' | 'locales' | 'orders_month';
  label: string;
  usage: number;
  limit: number | null;
  unlimited: boolean;
  enforcement: 'hard' | 'soft';
  atLimit: boolean;
  overSoftLimit: boolean;
};

export type SoftLimitWarning = {
  metric: 'orders_month';
  message: string;
  usage: number;
  limit: number;
};

export type TenantBillingSnapshot = {
  plan: PlanView;
  subscription: {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  meters: UsageMeter[];
  softWarnings: SoftLimitWarning[];
  features: { b2b: boolean };
  stripeBillingConfigured: boolean;
};

export type StaffMember = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
};

export type TenantLocale = {
  id: string;
  locale: string;
  enabled: boolean;
  isDefault: boolean;
};

export type UpgradeRequiredError = {
  statusCode: 402;
  code: 'upgrade_required';
  message: string;
  metric: string;
  limit: number;
  usage: number;
  planCode: string;
  suggestedPlanCode: string | null;
};

export type StripeBillingStubResult = {
  id?: string;
  url: string;
  status: 'stub' | 'created';
  provider: 'stripe_billing';
  planCode?: string;
  message: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(method: string, path: string, status: number, body: unknown) {
    const detail =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof (body as { message: unknown }).message === 'string'
        ? (body as { message: string }).message
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);
    super(`${method} ${path} failed: ${status} ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get upgradeRequired(): UpgradeRequiredError | null {
    if (
      typeof this.body === 'object' &&
      this.body !== null &&
      (this.body as { code?: string }).code === 'upgrade_required'
    ) {
      return this.body as UpgradeRequiredError;
    }
    return null;
  }
}

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
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : text;
      } catch {
        /* keep raw text */
      }
      throw new ApiError(method, path, res.status, body);
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

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      credentials: this.credentials(),
    });
    return this.parse<T>(res, 'PUT', path);
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

  getAdminNotificationSettings(): Promise<TenantNotificationSettings> {
    return this.get<TenantNotificationSettings>(
      '/v1/admin/notifications/settings',
    );
  }

  updateAdminNotificationSettings(
    body: NotificationSettingsUpdate,
  ): Promise<TenantNotificationSettings> {
    return this.patch<TenantNotificationSettings>(
      '/v1/admin/notifications/settings',
      body,
    );
  }

  processAdminNotifications(): Promise<NotificationProcessResult> {
    return this.post<NotificationProcessResult>(
      '/v1/admin/notifications/process',
      {},
    );
  }

  setCartEmail(cartId: string, body: { email: string }): Promise<Cart> {
    return this.patch<Cart>(`/v1/carts/${cartId}/email`, body);
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

  getCmsBootstrap(locale = 'en'): Promise<CmsBootstrap> {
    return this.get<CmsBootstrap>(
      `/v1/cms/bootstrap?locale=${encodeURIComponent(locale)}`,
    );
  }

  getCmsPolicy(kind: PolicyKind, locale = 'en'): Promise<Policy> {
    return this.get<Policy>(
      `/v1/cms/policies/${encodeURIComponent(kind)}?locale=${encodeURIComponent(locale)}`,
    );
  }

  listThemePacks(): Promise<ThemeTokens[]> {
    return this.get<ThemeTokens[]>('/v1/admin/cms/theme-packs');
  }

  getAdminTheme(): Promise<ThemeSettings> {
    return this.get<ThemeSettings>('/v1/admin/cms/theme');
  }

  updateAdminTheme(body: ThemeSettingsUpdate): Promise<ThemeSettings> {
    return this.patch<ThemeSettings>('/v1/admin/cms/theme', body);
  }

  getAdminSeo(locale = 'en'): Promise<SeoSettings> {
    return this.get<SeoSettings>(
      `/v1/admin/cms/seo?locale=${encodeURIComponent(locale)}`,
    );
  }

  updateAdminSeo(body: SeoSettingsUpdate): Promise<SeoSettings> {
    return this.patch<SeoSettings>('/v1/admin/cms/seo', body);
  }

  getAdminMenu(handle: MenuHandle, locale = 'en'): Promise<Menu> {
    return this.get<Menu>(
      `/v1/admin/cms/menus/${encodeURIComponent(handle)}?locale=${encodeURIComponent(locale)}`,
    );
  }

  replaceAdminMenu(handle: MenuHandle, body: MenuUpdateInput): Promise<Menu> {
    return this.put<Menu>(
      `/v1/admin/cms/menus/${encodeURIComponent(handle)}`,
      body,
    );
  }

  listAdminPolicies(locale = 'en'): Promise<Policy[]> {
    return this.get<Policy[]>(
      `/v1/admin/cms/policies?locale=${encodeURIComponent(locale)}`,
    );
  }

  getAdminPolicy(kind: PolicyKind, locale = 'en'): Promise<Policy> {
    return this.get<Policy>(
      `/v1/admin/cms/policies/${encodeURIComponent(kind)}?locale=${encodeURIComponent(locale)}`,
    );
  }

  updateAdminPolicy(
    kind: PolicyKind,
    body: PolicyUpdateInput,
  ): Promise<Policy> {
    return this.patch<Policy>(
      `/v1/admin/cms/policies/${encodeURIComponent(kind)}`,
      body,
    );
  }

  listMigrationJobs(tenantId?: string): Promise<MigrationJob[]> {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.platformGet<MigrationJob[]>(`/v1/platform/migration/jobs${q}`);
  }

  createMigrationJob(body: CreateMigrationJobInput): Promise<MigrationJob> {
    return this.platformPost<MigrationJob>('/v1/platform/migration/jobs', body);
  }

  getMigrationJob(id: string): Promise<MigrationJob> {
    return this.platformGet<MigrationJob>(
      `/v1/platform/migration/jobs/${id}`,
    );
  }

  runMigrationJob(id: string): Promise<MigrationJob> {
    return this.platformPost<MigrationJob>(
      `/v1/platform/migration/jobs/${id}/run`,
      {},
    );
  }

  private platformHeaders(): Record<string, string> {
    const headers = this.headers({ 'Content-Type': 'application/json' });
    const key =
      this.opts.getPlatformKey?.() ?? 'ecom-local-platform-key-change-me';
    headers['X-Platform-Key'] = key;
    return headers;
  }

  private async platformGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      headers: this.platformHeaders(),
    });
    return this.parse<T>(res, 'GET', path);
  }

  private async platformPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'POST',
      headers: this.platformHeaders(),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, 'POST', path);
  }
  getBillingUsage(): Promise<TenantBillingSnapshot> {
    return this.get<TenantBillingSnapshot>('/v1/admin/billing/usage');
  }

  listBillingPlans(): Promise<PlanView[]> {
    return this.get<PlanView[]>('/v1/admin/billing/plans');
  }

  changeBillingPlan(body: { planCode: string }): Promise<TenantBillingSnapshot> {
    return this.post<TenantBillingSnapshot>('/v1/admin/billing/change-plan', body);
  }

  createStripeBillingCheckout(body: {
    planCode: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<StripeBillingStubResult> {
    return this.post<StripeBillingStubResult>(
      '/v1/admin/billing/stripe/checkout',
      body,
    );
  }

  createStripeBillingPortal(body: {
    returnUrl: string;
  }): Promise<StripeBillingStubResult> {
    return this.post<StripeBillingStubResult>(
      '/v1/admin/billing/stripe/portal',
      body,
    );
  }

  listStaffMembers(): Promise<StaffMember[]> {
    return this.get<StaffMember[]>('/v1/admin/billing/staff');
  }

  inviteStaffMember(body: {
    email: string;
    password: string;
    displayName?: string;
    role?: string;
  }): Promise<Omit<StaffMember, 'createdAt'>> {
    return this.post('/v1/admin/billing/staff', body);
  }

  listTenantLocales(): Promise<TenantLocale[]> {
    return this.get<TenantLocale[]>('/v1/admin/billing/locales');
  }

  enableTenantLocale(body: { locale: string }): Promise<TenantLocale> {
    return this.post<TenantLocale>('/v1/admin/billing/locales', body);
  }

  disableTenantLocale(locale: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(
      `/v1/admin/billing/locales/${encodeURIComponent(locale)}`,
    );
  }

}

  getWishlist(): Promise<Wishlist> {
    return this.get<Wishlist>('/v1/wishlist');
  }

  addWishlistItem(body: { variantId: string }): Promise<Wishlist> {
    return this.post<Wishlist>('/v1/wishlist/items', body);
  }

  removeWishlistItem(variantId: string): Promise<Wishlist> {
    return this.delete<Wishlist>(`/v1/wishlist/items/${variantId}`);
  }

  listProductReviews(productId: string): Promise<ProductReview[]> {
    return this.get<ProductReview[]>(
      `/v1/catalog/products/${productId}/reviews`,
    );
  }

  getProductRating(productId: string): Promise<ProductRatingSummary> {
    return this.get<ProductRatingSummary>(
      `/v1/catalog/products/${productId}/rating`,
    );
  }

  createProductReview(
    productId: string,
    body: { rating: number; title?: string; body: string; locale?: string },
  ): Promise<ProductReview> {
    return this.post<ProductReview>(
      `/v1/catalog/products/${productId}/reviews`,
      body,
    );
  }

  listAdminReviews(status?: ReviewStatus): Promise<ProductReview[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.get<ProductReview[]>(`/v1/admin/reviews${q}`);
  }

  moderateAdminReview(
    id: string,
    body: { status: ReviewStatus },
  ): Promise<ProductReview> {
    return this.patch<ProductReview>(`/v1/admin/reviews/${id}`, body);
  }

  listAdminPriceLists(): Promise<PriceList[]> {
    return this.get<PriceList[]>('/v1/admin/b2b/price-lists');
  }

  createAdminPriceList(body: {
    name: string;
    currency?: string;
    items?: {
      variantId: string;
      unitAmountMinor: number;
      currency?: string;
    }[];
  }): Promise<PriceList> {
    return this.post<PriceList>('/v1/admin/b2b/price-lists', body);
  }

  updateAdminPriceList(
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
    return this.patch<PriceList>(`/v1/admin/b2b/price-lists/${id}`, body);
  }

  listAdminCustomerGroups(): Promise<CustomerGroup[]> {
    return this.get<CustomerGroup[]>('/v1/admin/b2b/customer-groups');
  }

  createAdminCustomerGroup(body: {
    name: string;
    priceListId?: string | null;
    customerIds?: string[];
  }): Promise<CustomerGroup> {
    return this.post<CustomerGroup>('/v1/admin/b2b/customer-groups', body);
  }

  updateAdminCustomerGroup(
    id: string,
    body: {
      name?: string;
      priceListId?: string | null;
      customerIds?: string[];
    },
  ): Promise<CustomerGroup> {
    return this.patch<CustomerGroup>(
      `/v1/admin/b2b/customer-groups/${id}`,
      body,
    );
  }

  addAdminCustomerGroupMember(
    groupId: string,
    body: { customerId: string },
  ): Promise<CustomerGroup> {
    return this.post<CustomerGroup>(
      `/v1/admin/b2b/customer-groups/${groupId}/members`,
      body,
    );
  }

  removeAdminCustomerGroupMember(
    groupId: string,
    customerId: string,
  ): Promise<CustomerGroup> {
    return this.delete<CustomerGroup>(
      `/v1/admin/b2b/customer-groups/${groupId}/members/${customerId}`,
    );
  }
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
