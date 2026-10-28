-- Offline payment methods (COD + bank transfer) per tenant

CREATE TABLE IF NOT EXISTS tenant_payment_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cod_enabled boolean NOT NULL DEFAULT false,
  bank_transfer_enabled boolean NOT NULL DEFAULT false,
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  stripe_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE tenant_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_payment_settings_isolation ON tenant_payment_settings;
CREATE POLICY tenant_payment_settings_isolation ON tenant_payment_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_payment_settings FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_payment_settings TO ecom_app;

-- Demo tenant: COD + bank transfer on; Stripe off (Pakistan-first offline methods)
INSERT INTO tenant_payment_settings (
  tenant_id,
  cod_enabled,
  bank_transfer_enabled,
  bank_account_name,
  bank_account_number,
  bank_name,
  stripe_enabled
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  true,
  true,
  'Demo Merchant PK',
  'PK36SCBL0000001123456702',
  'Demo Bank Pakistan',
  false
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Isolation fixture: COD only (no bank details)
INSERT INTO tenant_payment_settings (
  tenant_id,
  cod_enabled,
  bank_transfer_enabled,
  stripe_enabled
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  true,
  false,
  false
)
ON CONFLICT (tenant_id) DO NOTHING;
