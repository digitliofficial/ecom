/** Local stub session for merchant admin — not real auth. */

export const ADMIN_STUB_COOKIE = 'ecom_admin_stub_session';
export const ADMIN_STUB_STORAGE_KEY = 'ecom_admin_stub_session';

export type StubSession = {
  email: string;
};

export function parseStubSessionValue(raw: string | undefined | null): StubSession | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const email = decoded.trim();
    if (!email || !email.includes('@')) return null;
    return { email };
  } catch {
    return null;
  }
}

/** Client-only: persist stub session (cookie + localStorage). */
export function setStubSession(email: string): void {
  const value = encodeURIComponent(email.trim());
  document.cookie = `${ADMIN_STUB_COOKIE}=${value}; path=/; SameSite=Lax; Max-Age=86400`;
  try {
    localStorage.setItem(ADMIN_STUB_STORAGE_KEY, email.trim());
  } catch {
    /* ignore quota / private mode */
  }
}

/** Client-only: clear stub session. */
export function clearStubSession(): void {
  document.cookie = `${ADMIN_STUB_COOKIE}=; path=/; SameSite=Lax; Max-Age=0`;
  try {
    localStorage.removeItem(ADMIN_STUB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Client-only: read session from cookie, fall back to localStorage. */
export function readStubSessionClient(): StubSession | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_STUB_COOKIE}=`));
  const fromCookie = parseStubSessionValue(match?.slice(ADMIN_STUB_COOKIE.length + 1));
  if (fromCookie) return fromCookie;
  try {
    return parseStubSessionValue(localStorage.getItem(ADMIN_STUB_STORAGE_KEY));
  } catch {
    return null;
  }
}
