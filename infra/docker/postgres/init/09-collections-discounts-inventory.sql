-- Collections, coupon discounts, multi-location inventory (EC-21 MVP)

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS collection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_id)
);

CREATE INDEX IF NOT EXISTS collection_products_product_idx
  ON collection_products (tenant_id, product_id);

-- ---------------------------------------------------------------------------
-- Discounts (percentage / fixed coupons)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  -- percentage: 1–100; fixed: amount in minor units
  value numeric NOT NULL CHECK (value > 0),
  currency text NOT NULL DEFAULT 'USD',
  min_subtotal_minor bigint NOT NULL DEFAULT 0 CHECK (min_subtotal_minor >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count int NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_code text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount_minor bigint NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_type text;

-- ---------------------------------------------------------------------------
-- Locations + per-variant stock levels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- At most one default location per tenant
CREATE UNIQUE INDEX IF NOT EXISTS locations_one_default_per_tenant
  ON locations (tenant_id)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, variant_id)
);

CREATE INDEX IF NOT EXISTS inventory_levels_variant_idx
  ON inventory_levels (tenant_id, variant_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collections_isolation ON collections;
CREATE POLICY collections_isolation ON collections
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS collection_products_isolation ON collection_products;
CREATE POLICY collection_products_isolation ON collection_products
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS discounts_isolation ON discounts;
CREATE POLICY discounts_isolation ON discounts
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS locations_isolation ON locations;
CREATE POLICY locations_isolation ON locations
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS inventory_levels_isolation ON inventory_levels;
CREATE POLICY inventory_levels_isolation ON inventory_levels
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE collections FORCE ROW LEVEL SECURITY;
ALTER TABLE collection_products FORCE ROW LEVEL SECURITY;
ALTER TABLE discounts FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  collections, collection_products, discounts, locations, inventory_levels
  TO ecom_app;

-- ---------------------------------------------------------------------------
-- Seed: demo default location + backfill levels from inventory_quantity
-- ---------------------------------------------------------------------------

INSERT INTO locations (id, tenant_id, name, code, is_default, active)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Main warehouse',
  'MAIN',
  true,
  true
)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO locations (id, tenant_id, name, code, is_default, active)
VALUES (
  '40000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  'Other warehouse',
  'MAIN',
  true,
  true
)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Backfill inventory_levels from product_variants.inventory_quantity (once)
INSERT INTO inventory_levels (tenant_id, location_id, variant_id, quantity)
SELECT v.tenant_id, loc.id, v.id, COALESCE(v.inventory_quantity, 0)
FROM product_variants v
JOIN locations loc
  ON loc.tenant_id = v.tenant_id AND loc.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_levels il
  WHERE il.location_id = loc.id AND il.variant_id = v.id
);

-- Demo collection
INSERT INTO collections (id, tenant_id, slug, title, description, status)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'featured',
  'Featured',
  'Demo featured collection for storefront filter.',
  'active'
)
ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO collection_products (tenant_id, collection_id, product_id, position)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  0
)
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Demo coupons
INSERT INTO discounts (
  id, tenant_id, code, title, type, value, currency,
  min_subtotal_minor, active
)
VALUES (
  '60000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'SAVE10',
  '10% off',
  'percentage',
  10,
  'USD',
  0,
  true
)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO discounts (
  id, tenant_id, code, title, type, value, currency,
  min_subtotal_minor, active
)
VALUES (
  '60000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'FLAT5',
  '$5 off',
  'fixed',
  500,
  'USD',
  0,
  true
)
ON CONFLICT (tenant_id, code) DO NOTHING;
