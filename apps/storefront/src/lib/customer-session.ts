'use client';

const CUSTOMER_TOKEN_KEY = 'ecom_customer_bearer';

export function readCustomerBearer(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setCustomerBearer(token: string): void {
  try {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearCustomerBearer(): void {
  try {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
