import { createHash, randomBytes } from 'node:crypto';

export const GUEST_CART_COOKIE = 'ecom_guest_cart';
export const GUEST_CART_HEADER = 'x-cart-token';

export function createGuestToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readGuestToken(req: {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}): string | null {
  const header = req.headers[GUEST_CART_HEADER];
  if (typeof header === 'string' && header.length > 0) return header;
  if (Array.isArray(header) && header[0]) return header[0];
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const match = cookieHeader
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${GUEST_CART_COOKIE}=`));
    if (match) {
      return decodeURIComponent(match.slice(GUEST_CART_COOKIE.length + 1));
    }
  }
  return req.cookies?.[GUEST_CART_COOKIE] ?? null;
}

export function guestCartCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 30;
  return `${GUEST_CART_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
