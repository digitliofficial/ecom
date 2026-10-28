/** Minor-units helpers + currency exponents */

const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  PKR: 2,
  JPY: 0,
  KWD: 3,
};

export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  return CURRENCY_EXPONENTS[code] ?? 2;
}

export function toMinorUnits(major: number, currency: string): number {
  const exp = currencyExponent(currency);
  return Math.round(major * 10 ** exp);
}

export function fromMinorUnits(minor: number, currency: string): number {
  const exp = currencyExponent(currency);
  return minor / 10 ** exp;
}

export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  const major = fromMinorUnits(minor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(major);
  } catch {
    return `${major.toFixed(currencyExponent(currency))} ${currency.toUpperCase()}`;
  }
}

export { CURRENCY_EXPONENTS };
