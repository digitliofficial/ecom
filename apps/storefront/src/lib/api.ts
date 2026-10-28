'use client';

import {
  createApiClient,
  type Cart,
  type CheckoutSessionResult,
  type Product,
  type ShippingAddress,
} from '@ecom/sdk-api';
import { readCustomerBearer } from './customer-session';

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

export async function ensureCart(): Promise<Cart> {
  const existing = await fetchCurrentCart();
  if (existing) return existing;
  const cart = await client().createCart({ locale: 'en', currency: 'USD' });
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

export async function checkout(input: {
  email: string;
  shippingAddress: ShippingAddress;
}): Promise<CheckoutSessionResult> {
  const cart = await ensureCart();
  const result = await client().createCheckoutSession({
    cartId: cart.id,
    email: input.email,
    shippingAddress: input.shippingAddress,
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
