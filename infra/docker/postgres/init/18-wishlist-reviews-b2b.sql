-- Wishlist, product reviews (moderation), B2B customer groups + price lists
-- Runs after 17-plans-metering.sql (uses Growth plan + feature_b2b entitlement).

-- ---------------------------------------------------------------------------
-- Demo tenant on Growth so local B2B wholesale seed is entitled (feature_b2b=1)
-- ---------------------------------------------------------------------------
UPDATE tenants
SET plan_id = '10000000-0000-4000-8000-000000000002'
WHERE id = '00000000-0000-4000-8000-000000000001';

UPDATE tenant_subscriptions
SET plan_id = '10000000-0000-4000-8000-000000000002',
    status = 'active',
    updated_at = now()
WHERE tenant_id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Customers: account type for B2B buyers
-- ---------------------------------------------------------------------------
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_account_type_check'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_account_type_check
      CHECK (account_type IN ('personal', 'business'));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Wishlist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wishlist_id uuid NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wishlist_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Product reviews + aggregate cache on products
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_purchase boolean NOT NULL DEFAULT false,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_reviews_product_status_idx
  ON product_reviews (tenant_id, product_id, status);

CREATE INDEX IF NOT EXISTS product_reviews_moderation_idx
  ON product_reviews (tenant_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- B2B: customer groups + price lists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_list_id, variant_id)
);

CREATE TABLE IF NOT EXISTS customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_list_id uuid REFERENCES price_lists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS customer_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, customer_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishlists_isolation ON wishlists;
CREATE POLICY wishlists_isolation ON wishlists
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS wishlist_items_isolation ON wishlist_items;
CREATE POLICY wishlist_items_isolation ON wishlist_items
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS product_reviews_isolation ON product_reviews;
CREATE POLICY product_reviews_isolation ON product_reviews
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS price_lists_isolation ON price_lists;
CREATE POLICY price_lists_isolation ON price_lists
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS price_list_items_isolation ON price_list_items;
CREATE POLICY price_list_items_isolation ON price_list_items
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS customer_groups_isolation ON customer_groups;
CREATE POLICY customer_groups_isolation ON customer_groups
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS customer_group_members_isolation ON customer_group_members;
CREATE POLICY customer_group_members_isolation ON customer_group_members
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE wishlists FORCE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items FORCE ROW LEVEL SECURITY;
ALTER TABLE product_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE price_lists FORCE ROW LEVEL SECURITY;
ALTER TABLE price_list_items FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_group_members FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  wishlists, wishlist_items, product_reviews,
  price_lists, price_list_items, customer_groups, customer_group_members
TO ecom_app;

-- ---------------------------------------------------------------------------
-- Demo seed: wholesale group + 20% off mug price list for demo customer
-- ---------------------------------------------------------------------------
INSERT INTO price_lists (id, tenant_id, name, currency)
VALUES (
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Wholesale USD',
  'USD'
)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO price_list_items (id, tenant_id, price_list_id, variant_id, unit_amount_minor, currency)
VALUES (
  '71000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  2000,
  'USD'
)
ON CONFLICT (price_list_id, variant_id) DO NOTHING;

INSERT INTO customer_groups (id, tenant_id, name, price_list_id)
VALUES (
  '72000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Wholesale',
  '70000000-0000-4000-8000-000000000001'
)
ON CONFLICT (tenant_id, name) DO UPDATE
SET price_list_id = EXCLUDED.price_list_id;

INSERT INTO customer_group_members (id, tenant_id, group_id, customer_id)
VALUES (
  '73000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001'
)
ON CONFLICT (group_id, customer_id) DO NOTHING;

UPDATE customers
SET account_type = 'business'
WHERE id = '60000000-0000-4000-8000-000000000001'
  AND tenant_id = '00000000-0000-4000-8000-000000000001';
