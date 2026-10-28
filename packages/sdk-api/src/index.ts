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
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
