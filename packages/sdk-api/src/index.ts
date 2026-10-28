/** Thin typed client for Nest API */

export type SdkApiOptions = {
  baseUrl: string;
  getToken?: () => string | undefined;
  getHost?: () => string | undefined;
  getCartToken?: () => string | undefined;
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
  email: string | null;
  lines: CartLine[];
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    unitAmountMinor: number;
    currency: string;
  }>;
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

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.opts.baseUrl}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return res.json() as Promise<{ status: string }>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  listProducts(): Promise<Product[]> {
    return this.get<Product[]>('/v1/catalog/products');
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
