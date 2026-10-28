/** Merchant admin session helpers — JWT lives in httpOnly cookie from Nest. */

export const STAFF_SESSION_COOKIE = 'ecom_staff_session';
export const STAFF_TOKEN_STORAGE_KEY = 'ecom_staff_bearer';

/** Client-only: remember bearer for API calls (mirrors httpOnly cookie for same origin quirks). */
export function setStaffBearer(token: string): void {
  try {
    localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearStaffBearer(): void {
  try {
    localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readStaffBearer(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(STAFF_TOKEN_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Decode JWT payload without verifying (UI display only; API verifies). */
export function readStaffEmailFromCookie(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  try {
    const token = decodeURIComponent(raw);
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { email?: string; kind?: string };
    if (payload.kind && payload.kind !== 'staff') return null;
    const email = payload.email?.trim();
    return email?.includes('@') ? email : null;
  } catch {
    return null;
  }
}

export function hasStaffSessionCookie(
  raw: string | undefined | null,
): boolean {
  return Boolean(raw && raw.split('.').length >= 3);
}
