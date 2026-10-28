-- Shipping methods (manual flat-rate) + order shipment/tracking snapshot

CREATE TABLE IF NOT EXISTS shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_amount_minor bigint NOT NULL DEFAULT 0 CHECK (price_amount_minor >= 0),
  currency text NOT NULL DEFAULT 'USD',
  cod_compatible boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  -- CourierPort adapter key: manual | aggregator_stub | (later: easypost, shippo, local_pk_*)
  adapter text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_methods_tenant_enabled_idx
  ON shipping_methods (tenant_id, enabled, sort_order);

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipping_method_id uuid REFERENCES shipping_methods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  tracking_carrier text,
  label_url text,
  adapter text NOT NULL DEFAULT 'manual',
  rate_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  shipped_at timestamptz
);

CREATE INDEX IF NOT EXISTS shipments_order_idx ON shipments (tenant_id, order_id);

CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  provider_event_id text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_events_shipment_idx
  ON tracking_events (tenant_id, shipment_id, occurred_at);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_method_id uuid REFERENCES shipping_methods(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_method_name text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_amount_minor bigint NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_carrier text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_methods_isolation ON shipping_methods;
CREATE POLICY shipping_methods_isolation ON shipping_methods
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS shipments_isolation ON shipments;
CREATE POLICY shipments_isolation ON shipments
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tracking_events_isolation ON tracking_events;
CREATE POLICY tracking_events_isolation ON tracking_events
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE shipping_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE tracking_events FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shipping_methods, shipments, tracking_events TO ecom_app;

-- Demo tenant: flat-rate Standard + Express (manual adapter)
INSERT INTO shipping_methods (
  id, tenant_id, name, price_amount_minor, currency, cod_compatible, enabled, sort_order, adapter
)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Standard shipping',
    500,
    'USD',
    true,
    true,
    10,
    'manual'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Express shipping',
    1500,
    'USD',
    true,
    true,
    20,
    'manual'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'Aggregator stub (demo)',
    800,
    'USD',
    false,
    true,
    30,
    'aggregator_stub'
  )
ON CONFLICT (id) DO NOTHING;

-- Isolation fixture: one flat rate, COD-compatible
INSERT INTO shipping_methods (
  id, tenant_id, name, price_amount_minor, currency, cod_compatible, enabled, sort_order, adapter
)
VALUES (
  '40000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000002',
  'Flat rate',
  300,
  'USD',
  true,
  true,
  10,
  'manual'
)
ON CONFLICT (id) DO NOTHING;
