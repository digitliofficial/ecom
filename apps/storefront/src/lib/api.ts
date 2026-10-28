'use client';

import {
  createApiClient,
  type Cart,
  type CheckoutSessionResult,
  type CmsBootstrap,
  type OfflinePaymentMethod,
  type Policy,
  type PolicyKind,
  type Product,
  type ProductReview,
  type ShippingAddress,
  type StorefrontLocalization,
  type StorefrontPaymentMethod,
  type StorefrontShippingMethod,
  type Wishlist,
} from '@ecom/sdk-api';
import { readCustomerBearer } from './customer-session';
import { readDisplayCurrency } from './display-currency';

const CART_TOKEN_KEY = 'ecom_guest_cart';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function getTenantHost(): string {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
      ? 'demo.localhost'
      : window.location.hostname;
  }
  return 'demo.localhost';
}

export function readCartToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(CART_TOKEN_KEY) ?? undefined;
}

export function writeCartToken(token: string) {
  localStorage.setItem(CART_TOKEN_KEY, token);
}

export function clearCartToken() {
  localStorage.removeItem(CART_TOKEN_KEY);
}

function client() {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getHost: getTenantHost,
    getCartToken: readCartToken,
    getToken: () => readCustomerBearer(),
    credentials: 'include',
  });
}

export async function listProducts(): Promise<Product[]> {
  return client().listProducts();
}

export async function getWishlist(): Promise<Wishlist> {
  return client().getWishlist();
}

export async function addWishlistItem(variantId: string): Promise<Wishlist> {
  return client().addWishlistItem({ variantId });
}

export async function removeWishlistItem(variantId: string): Promise<Wishlist> {
  return client().removeWishlistItem(variantId);
}

export async function listProductReviews(
  productId: string,
): Promise<ProductReview[]> {
  return client().listProductReviews(productId);
}

export async function createProductReview(
  productId: string,
  body: { rating: number; title?: string; body: string; locale?: string },
): Promise<ProductReview> {
  return client().createProductReview(productId, body);
}

export async function fetchCurrentCart(): Promise<Cart | null> {
  const token = readCartToken();
  if (!token) return null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Forwarded-Host': getTenantHost(),
    'X-Cart-Token': token,
  };
  const bearer = readCustomerBearer();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${getApiBaseUrl()}/v1/carts/current`, {
    headers,
    credentials: 'include',
  });
  if (res.status === 404) {
    clearCartToken();
    return null;
  }
  if (!res.ok) throw new Error(`cart current failed: ${res.status}`);
  const cart = (await res.json()) as Cart;
  writeCartToken(cart.guestToken);
  return cart;
}

export async function getStorefrontLocalization(): Promise<StorefrontLocalization> {
  return client().getStorefrontLocalization();
}

export async function ensureCart(opts?: {
  locale?: string;
  currency?: string;
}): Promise<Cart> {
  const existing = await fetchCurrentCart();
  if (existing) return existing;
  let locale = opts?.locale;
  let currency = opts?.currency ?? readDisplayCurrency();
  if (!locale || !currency) {
    try {
      const loc = await getStorefrontLocalization();
      locale ??= loc.defaultLocale;
      currency ??= loc.defaultCurrency;
    } catch {
      locale ??= 'en';
      currency ??= 'USD';
    }
  }
  const cart = await client().createCart({ locale, currency });
  writeCartToken(cart.guestToken);
  return cart;
}

export async function addToCart(
  variantId: string,
  quantity = 1,
): Promise<Cart> {
  const cart = await ensureCart();
  const updated = await client().addLine(cart.id, { variantId, quantity });
  writeCartToken(updated.guestToken);
  return updated;
}

export async function updateCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const updated = await client().updateLine(cartId, lineId, { quantity });
  writeCartToken(updated.guestToken);
  return updated;
}

export async function removeCartLine(
  cartId: string,
  lineId: string,
): Promise<Cart> {
  const updated = await client().removeLine(cartId, lineId);
  writeCartToken(updated.guestToken);
  return updated;
}

export async function listPaymentMethods(): Promise<StorefrontPaymentMethod[]> {
  return client().listPaymentMethods();
}

export async function listShippingMethods(
  paymentMethod?: OfflinePaymentMethod,
): Promise<StorefrontShippingMethod[]> {
  return client().listShippingMethods(paymentMethod);
}


export async function getCmsBootstrap(locale = 'en'): Promise<CmsBootstrap> {
  return client().getCmsBootstrap(locale);
}

export async function getCmsPolicy(
  kind: PolicyKind,
  locale = 'en',
): Promise<Policy> {
  return client().getCmsPolicy(kind, locale);
}

export async function checkout(input: {
  email: string;
  shippingAddress: ShippingAddress;
  paymentMethod: OfflinePaymentMethod;
  shippingMethodId: string;
}): Promise<CheckoutSessionResult> {
  const cart = await ensureCart();
  const result = await client().createCheckoutSession({
    cartId: cart.id,
    email: input.email,
    shippingAddress: input.shippingAddress,
    paymentMethod: input.paymentMethod,
    shippingMethodId: input.shippingMethodId,
  });
  clearCartToken();
  return result;
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}
