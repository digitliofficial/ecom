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
    totalAmountMinor: number;
    currency: string;
    accessToken: string;
  };
  payment: { id: string; status: string; provider: string };
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

  createCheckoutSession(body: {
    cartId?: string;
    email: string;
    shippingAddress: ShippingAddress;
  }): Promise<CheckoutSessionResult> {
    return this.post<CheckoutSessionResult>('/v1/checkout/sessions', body);
  }
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
