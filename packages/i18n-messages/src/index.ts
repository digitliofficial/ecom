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

export const catalogs: Record<string, MessageCatalog> = { en };

export function t(locale: string, key: string): string {
  return catalogs[locale]?.[key] ?? catalogs.en?.[key] ?? key;
}
