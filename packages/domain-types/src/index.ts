/** Shared domain types — Phase 0 stubs */

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
