'use client';

export const DISPLAY_CURRENCY_COOKIE = 'ecom_display_currency';
const STORAGE_KEY = 'ecom_display_currency';

export function readDisplayCurrency(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${DISPLAY_CURRENCY_COOKIE}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

export function writeDisplayCurrency(currency: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, currency.toUpperCase());
}

export function clearDisplayCurrency() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
