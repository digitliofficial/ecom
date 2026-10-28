-- Guest checkout vertical slice: catalog, guest tokens, orders, isolation tenant

ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS guest_token text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_guest_token_key'
  ) THEN
    ALTER TABLE carts ADD CONSTRAINT carts_guest_token_key UNIQUE (guest_token);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  title text NOT NULL,
  unit_amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES carts(id) ON DELETE SET NULL,
  checkout_session_id uuid REFERENCES checkout_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'not_charged',
  guest_email text,
  shipping_address jsonb,
  charge_currency text NOT NULL DEFAULT 'USD',
  total_amount_minor bigint NOT NULL DEFAULT 0,
  access_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL,
  title text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  qty_ordered int NOT NULL DEFAULT 0,
  qty_fulfilled int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_isolation ON products;
CREATE POLICY products_isolation ON products
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS product_variants_isolation ON product_variants;
CREATE POLICY product_variants_isolation ON product_variants
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS orders_isolation ON orders;
CREATE POLICY orders_isolation ON orders
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS order_lines_isolation ON order_lines;
CREATE POLICY order_lines_isolation ON order_lines
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Tighten existing policies with WITH CHECK
DROP POLICY IF EXISTS carts_isolation ON carts;
CREATE POLICY carts_isolation ON carts
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS cart_lines_isolation ON cart_lines;
CREATE POLICY cart_lines_isolation ON cart_lines
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS checkout_sessions_isolation ON checkout_sessions;
CREATE POLICY checkout_sessions_isolation ON checkout_sessions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_lines FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE products, product_variants, orders, order_lines TO ecom_app;

-- Host → tenant without needing RLS context (used by Nest tenancy middleware)
CREATE OR REPLACE FUNCTION resolve_tenant_id_by_host(p_host text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id
  FROM tenant_domains
  WHERE lower(host) = lower(split_part(p_host, ':', 1))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION resolve_tenant_id_by_host(text) TO ecom_app;

-- Isolation tenant (for cross-tenant tests)
INSERT INTO tenants (id, slug, status, plan_id, data_region)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'other',
  'active',
  '10000000-0000-4000-8000-000000000001',
  'us'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_domains (tenant_id, host, is_primary)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'other.localhost',
  true
)
ON CONFLICT (host) DO NOTHING;

-- Demo catalog for demo tenant
INSERT INTO products (id, tenant_id, slug, title, description, status)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'demo-mug',
  'Demo Mug',
  'Ceramic mug for the guest checkout vertical slice.',
  'active'
)
ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO product_variants (id, tenant_id, product_id, sku, title, unit_amount_minor, currency)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'MUG-DEMO-01',
  'Default',
  2500,
  'USD'
)
ON CONFLICT (tenant_id, sku) DO NOTHING;

-- Other tenant has its own product (isolation fixture)
INSERT INTO products (id, tenant_id, slug, title, description, status)
VALUES (
  '20000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  'other-shirt',
  'Other Shirt',
  'Only visible to other tenant.',
  'active'
)
ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO product_variants (id, tenant_id, product_id, sku, title, unit_amount_minor, currency)
VALUES (
  '30000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'SHIRT-OTHER-01',
  'Default',
  4000,
  'USD'
)
ON CONFLICT (tenant_id, sku) DO NOTHING;
