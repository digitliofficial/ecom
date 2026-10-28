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
  order: {
    id: string;
    status: string;
    paymentStatus: string;
    paymentMethod: OfflinePaymentMethod | string;
    subtotalAmountMinor?: number;
    discountCode?: string | null;
    discountAmountMinor?: number;
    totalAmountMinor: number;
    currency: string;
    accessToken: string;
  };
  payment: { id: string; status: string; provider: string };
  bankTransferInstructions: BankDetails | null;
};

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  productIds: string[];
  productCount: number;
  createdAt?: string;
  updatedAt?: string;
  products?: Product[];
};

export type CollectionCreateInput = {
  title: string;
  slug?: string;
  description?: string | null;
  status?: string;
  productIds?: string[];
};

export type CollectionUpdateInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: string;
  productIds?: string[];
};

export type DiscountType = 'percentage' | 'fixed';

export type Discount = {
  id: string;
  code: string;
  title: string;
  type: DiscountType;
  value: number;
  currency: string;
  minSubtotalMinor: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DiscountCreateInput = {
  code: string;
  title: string;
  type: DiscountType;
  value: number;
  currency?: string;
  minSubtotalMinor?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  active?: boolean;
};

export type DiscountUpdateInput = {
  code?: string;
  title?: string;
  type?: DiscountType;
  value?: number;
  currency?: string;
  minSubtotalMinor?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  active?: boolean;
};

export type InventoryLocation = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LocationCreateInput = {
  name: string;
  code: string;
  isDefault?: boolean;
  active?: boolean;
};

export type LocationUpdateInput = {
  name?: string;
  code?: string;
  isDefault?: boolean;
  active?: boolean;
};

export type InventoryLevel = {
  id: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  variantId: string;
  sku: string;
  productTitle: string;
  quantity: number;
  updatedAt?: string;
};

export type SetStockInput = {
  locationId: string;
  variantId: string;
  quantity: number;
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
  discountCode?: string | null;
  discountAmountMinor?: number;
  totalAmountMinor: number;
  chargeCurrency: string;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
};

export type AdminOrderDetail = AdminOrderSummary & {
  cartId: string | null;
  checkoutSessionId: string | null;
  shippingAddress: ShippingAddress | null;
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

  listProducts(opts?: { collection?: string }): Promise<Product[]> {
    const qs = opts?.collection
      ? `?collection=${encodeURIComponent(opts.collection)}`
      : '';
    return this.get<Product[]>(`/v1/catalog/products${qs}`);
  }

  listCollections(): Promise<Collection[]> {
    return this.get<Collection[]>('/v1/catalog/collections');
  }

  getCollection(slug: string): Promise<Collection> {
    return this.get<Collection>(
      `/v1/catalog/collections/${encodeURIComponent(slug)}`,
    );
  }

  listAdminCollections(): Promise<Collection[]> {
    return this.get<Collection[]>('/v1/admin/collections');
  }

  getAdminCollection(id: string): Promise<Collection> {
    return this.get<Collection>(`/v1/admin/collections/${id}`);
  }

  createAdminCollection(body: CollectionCreateInput): Promise<Collection> {
    return this.post<Collection>('/v1/admin/collections', body);
  }

  updateAdminCollection(
    id: string,
    body: CollectionUpdateInput,
  ): Promise<Collection> {
    return this.patch<Collection>(`/v1/admin/collections/${id}`, body);
  }

  deleteAdminCollection(id: string): Promise<void> {
    return this.delete<void>(`/v1/admin/collections/${id}`);
  }

  listAdminDiscounts(): Promise<Discount[]> {
    return this.get<Discount[]>('/v1/admin/discounts');
  }

  getAdminDiscount(id: string): Promise<Discount> {
    return this.get<Discount>(`/v1/admin/discounts/${id}`);
  }

  createAdminDiscount(body: DiscountCreateInput): Promise<Discount> {
    return this.post<Discount>('/v1/admin/discounts', body);
  }

  updateAdminDiscount(
    id: string,
    body: DiscountUpdateInput,
  ): Promise<Discount> {
    return this.patch<Discount>(`/v1/admin/discounts/${id}`, body);
  }

  deleteAdminDiscount(id: string): Promise<void> {
    return this.delete<void>(`/v1/admin/discounts/${id}`);
  }

  listAdminLocations(): Promise<InventoryLocation[]> {
    return this.get<InventoryLocation[]>('/v1/admin/inventory/locations');
  }

  getAdminLocation(id: string): Promise<InventoryLocation> {
    return this.get<InventoryLocation>(`/v1/admin/inventory/locations/${id}`);
  }

  createAdminLocation(body: LocationCreateInput): Promise<InventoryLocation> {
    return this.post<InventoryLocation>('/v1/admin/inventory/locations', body);
  }

  updateAdminLocation(
    id: string,
    body: LocationUpdateInput,
  ): Promise<InventoryLocation> {
    return this.patch<InventoryLocation>(
      `/v1/admin/inventory/locations/${id}`,
      body,
    );
  }

  listAdminInventoryLevels(): Promise<InventoryLevel[]> {
    return this.get<InventoryLevel[]>('/v1/admin/inventory/levels');
  }

  setAdminInventoryLevel(body: SetStockInput): Promise<InventoryLevel> {
    return this.put<InventoryLevel>('/v1/admin/inventory/levels', body);
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

  createCheckoutSession(body: {
    cartId?: string;
    email: string;
    shippingAddress: ShippingAddress;
    paymentMethod: OfflinePaymentMethod;
    discountCode?: string;
  }): Promise<CheckoutSessionResult> {
    return this.post<CheckoutSessionResult>('/v1/checkout/sessions', body);
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
    body: { status: AdminOrderStatusUpdate },
  ): Promise<AdminOrderDetail> {
    return this.patch<AdminOrderDetail>(`/v1/admin/orders/${id}/status`, body);
  }
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
