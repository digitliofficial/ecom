/** Shared domain types */

export type Money = {
  amountMinor: bigint | number;
  currency: string;
};

export type TenantStatus = 'active' | 'suspended' | 'provisioning';

export type Tenant = {
  id: string;
  slug: string;
  status: TenantStatus;
  planId?: string | null;
  dataRegion?: string | null;
};

export type TenantDomain = {
  id: string;
  tenantId: string;
  host: string;
  isPrimary: boolean;
};

export type CartStatus = 'active' | 'converted' | 'abandoned';

export type Cart = {
  id: string;
  tenantId: string;
  status: CartStatus;
  guestToken?: string | null;
  locale?: string | null;
  displayCurrency?: string | null;
  chargeCurrency?: string | null;
  email?: string | null;
};

export type CartLine = {
  id: string;
  cartId: string;
  tenantId: string;
  variantId: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
};

export type CheckoutSession = {
  id: string;
  tenantId: string;
  cartId: string;
  guestEmail?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  addressValidated?: boolean | null;
  addressProvider?: string | null;
  normalizedAddress?: Record<string, unknown> | null;
};

export type OrderStatus = 'pending' | 'placed' | 'cancelled' | 'fulfilled' | 'partially_fulfilled';

export type Order = {
  id: string;
  tenantId: string;
  cartId?: string | null;
  checkoutSessionId?: string | null;
  status: OrderStatus;
  paymentStatus: string;
  guestEmail?: string | null;
  totalAmountMinor: number;
  chargeCurrency: string;
};

export type ProductStatus = 'active' | 'draft' | 'archived';

export type Product = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  status?: ProductStatus | string;
};

export type ProductVariant = {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  title: string;
  unitAmountMinor: number;
  currency: string;
  inventoryQuantity?: number;
};
