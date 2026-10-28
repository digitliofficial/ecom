-- SaaS plan metering: tiers, entitlements, subscriptions, usage
-- (tenant_locales already created in 12-localization.sql)

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period text NOT NULL DEFAULT 'lifetime',
  value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric, period)
);

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_subscriptions_isolation ON tenant_subscriptions;
CREATE POLICY tenant_subscriptions_isolation ON tenant_subscriptions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS usage_counters_isolation ON usage_counters;
CREATE POLICY usage_counters_isolation ON usage_counters
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenant_subscriptions, usage_counters TO ecom_app;

-- Plans (Shopify-like illustrative tiers)
INSERT INTO plans (id, code, name, description, sort_order)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'starter',
    'Starter',
    'For new stores — hard caps on products, staff, and languages.',
    10
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'growth',
    'Growth',
    'Scale catalog and team with higher hard limits.',
    20
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'advanced',
    'Advanced',
    'Highest caps for multi-language merchants.',
    30
  )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- Entitlements: -1 = unlimited (soft fair-use). Soft metrics use soft_ prefix.
-- Runs after 12-localization so starter max_locales is restored to architecture (1).
INSERT INTO plan_entitlements (plan_id, key, value)
VALUES
  -- Starter
  ('10000000-0000-4000-8000-000000000001', 'max_products', '100'),
  ('10000000-0000-4000-8000-000000000001', 'max_staff', '2'),
  ('10000000-0000-4000-8000-000000000001', 'max_locales', '1'),
  ('10000000-0000-4000-8000-000000000001', 'max_currencies', '5'),
  ('10000000-0000-4000-8000-000000000001', 'soft_max_orders_month', '50'),
  ('10000000-0000-4000-8000-000000000001', 'feature_b2b', '0'),
  -- Growth
  ('10000000-0000-4000-8000-000000000002', 'max_products', '2000'),
  ('10000000-0000-4000-8000-000000000002', 'max_staff', '10'),
  ('10000000-0000-4000-8000-000000000002', 'max_locales', '3'),
  ('10000000-0000-4000-8000-000000000002', 'max_currencies', '5'),
  ('10000000-0000-4000-8000-000000000002', 'soft_max_orders_month', '500'),
  ('10000000-0000-4000-8000-000000000002', 'feature_b2b', '1'),
  -- Advanced
  ('10000000-0000-4000-8000-000000000003', 'max_products', '-1'),
  ('10000000-0000-4000-8000-000000000003', 'max_staff', '25'),
  ('10000000-0000-4000-8000-000000000003', 'max_locales', '10'),
  ('10000000-0000-4000-8000-000000000003', 'max_currencies', '10'),
  ('10000000-0000-4000-8000-000000000003', 'soft_max_orders_month', '5000'),
  ('10000000-0000-4000-8000-000000000003', 'feature_b2b', '1')
ON CONFLICT (plan_id, key) DO UPDATE
SET value = EXCLUDED.value;

-- Demo tenant subscription (Starter, no Stripe yet)
INSERT INTO tenant_subscriptions (
  id, tenant_id, plan_id, status, current_period_start, current_period_end
)
VALUES (
  '11000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'active',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month'
)
ON CONFLICT (tenant_id) DO NOTHING;
