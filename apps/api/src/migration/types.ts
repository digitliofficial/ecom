export type MigrationSource = 'shopify_api' | 'csv' | 'fixture';

export type MigrationEntityType =
  | 'products'
  | 'customers'
  | 'orders'
  | 'redirects';

export type MigrationRecordEntity =
  | 'product'
  | 'variant'
  | 'customer'
  | 'order'
  | 'redirect';

export type MigrationJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CreateMigrationJobInput = {
  tenantId: string;
  source: MigrationSource;
  entityTypes: MigrationEntityType[];
  shopDomain?: string;
  /** Shopify Admin API access token (custom app). Never logged. */
  accessToken?: string;
  /** Inline CSV keyed by entity type (products/customers). */
  csv?: Partial<Record<'products' | 'customers', string>>;
  /** Inline Shopify-shaped fixtures for tests / offline import. */
  fixture?: {
    products?: ShopifyProduct[];
    customers?: ShopifyCustomer[];
    orders?: ShopifyOrder[];
    redirects?: ShopifyRedirect[];
  };
};

export type MigrationJobDto = {
  id: string;
  tenantId: string;
  source: MigrationSource;
  entityTypes: MigrationEntityType[];
  status: MigrationJobStatus;
  shopDomain: string | null;
  stats: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type EntityStats = {
  imported: number;
  skipped: number;
  failed: number;
};

export type ShopifyProductVariant = {
  id: number | string;
  sku?: string | null;
  title?: string | null;
  price?: string | number | null;
  inventory_quantity?: number | null;
};

export type ShopifyProduct = {
  id: number | string;
  title: string;
  handle?: string | null;
  body_html?: string | null;
  status?: string | null;
  variants?: ShopifyProductVariant[];
};

export type ShopifyCustomer = {
  id: number | string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  tags?: string | null;
  note?: string | null;
};

export type ShopifyOrderLine = {
  variant_id?: number | string | null;
  sku?: string | null;
  title?: string | null;
  quantity?: number | null;
  price?: string | number | null;
};

export type ShopifyOrder = {
  id: number | string;
  email?: string | null;
  name?: string | null;
  currency?: string | null;
  total_price?: string | number | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  shipping_address?: Record<string, unknown> | null;
  line_items?: ShopifyOrderLine[];
  created_at?: string | null;
};

export type ShopifyRedirect = {
  id?: number | string;
  path: string;
  target: string;
};
