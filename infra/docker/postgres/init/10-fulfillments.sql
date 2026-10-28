-- Partial / split fulfillments: multiple shipments per order with per-line qty + tracking
-- (09-shipping.sql owns shipping_methods / shipments / order tracking snapshot columns)

ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS qty_refunded int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_lines_qty_refunded_nonneg'
  ) THEN
    ALTER TABLE order_lines
      ADD CONSTRAINT order_lines_qty_refunded_nonneg CHECK (qty_refunded >= 0);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  carrier text,
  shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fulfillments_status_check CHECK (
    status IN ('pending', 'shipped', 'delivered', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS fulfillment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  qty int NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, order_line_id)
);

CREATE INDEX IF NOT EXISTS fulfillments_order_id_idx ON fulfillments (order_id);
CREATE INDEX IF NOT EXISTS fulfillment_lines_fulfillment_id_idx ON fulfillment_lines (fulfillment_id);
CREATE INDEX IF NOT EXISTS fulfillment_lines_order_line_id_idx ON fulfillment_lines (order_line_id);

ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fulfillments_isolation ON fulfillments;
CREATE POLICY fulfillments_isolation ON fulfillments
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS fulfillment_lines_isolation ON fulfillment_lines;
CREATE POLICY fulfillment_lines_isolation ON fulfillment_lines
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE fulfillments FORCE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_lines FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE fulfillments, fulfillment_lines TO ecom_app;
