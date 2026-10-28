/** Shared message catalogs — Phase 0 sample */

export type MessageCatalog = Record<string, string>;

export const en: MessageCatalog = {
  'cart.title': 'Your cart',
  'cart.empty': 'Cart is empty.',
  'checkout.title': 'Checkout',
  'checkout.email': 'Email',
  'checkout.place': 'Place order',
  'checkout.placed': 'Order placed',
  'catalog.add': 'Add to cart',
  'admin.login': 'Sign in',
  'common.loading': 'Loading…',
};

/** Urdu sample catalog for multi-language demos */
export const ur: MessageCatalog = {
  'cart.title': 'آپ کی ٹوکری',
  'cart.empty': 'ٹوکری خالی ہے۔',
  'checkout.title': 'چیک آؤٹ',
  'checkout.email': 'ای میل',
  'checkout.place': 'آرڈر کریں',
  'checkout.placed': 'آرڈر ہو گیا',
  'catalog.add': 'ٹوکری میں شامل کریں',
  'admin.login': 'سائن ان',
  'common.loading': 'لوڈ ہو رہا ہے…',
};

export const catalogs: Record<string, MessageCatalog> = { en, ur };

export function t(locale: string, key: string): string {
  return catalogs[locale]?.[key] ?? catalogs.en?.[key] ?? key;
}
