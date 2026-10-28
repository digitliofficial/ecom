-- Tenant localization: defaults, multi-lang / multi-currency toggles, enabled lists

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  default_locale text NOT NULL DEFAULT 'en',
  default_currency text NOT NULL DEFAULT 'USD',
  multi_language boolean NOT NULL DEFAULT false,
  multi_currency boolean NOT NULL DEFAULT false,
  fx_rounding text NOT NULL DEFAULT 'half_up',
  fx_disclaimer text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_settings_default_locale_chk CHECK (default_locale ~ '^[a-z]{2}(-[A-Za-z]{2})?$'),
  CONSTRAINT tenant_settings_default_currency_chk CHECK (default_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT tenant_settings_fx_rounding_chk CHECK (fx_rounding IN ('half_up', 'half_even', 'floor', 'ceil'))
);

CREATE TABLE IF NOT EXISTS tenant_locales (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  locale text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, locale),
  CONSTRAINT tenant_locales_locale_chk CHECK (locale ~ '^[a-z]{2}(-[A-Za-z]{2})?$')
);

CREATE TABLE IF NOT EXISTS tenant_currencies (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  currency text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, currency),
  CONSTRAINT tenant_currencies_currency_chk CHECK (currency ~ '^[A-Z]{3}$')
);

-- Optional display FX (MVP browsing conversion; charge currency stays store default)
CREATE TABLE IF NOT EXISTS fx_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric(18, 8) NOT NULL,
  as_of timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency),
  CONSTRAINT fx_rates_base_chk CHECK (base_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT fx_rates_quote_chk CHECK (quote_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT fx_rates_rate_chk CHECK (rate > 0)
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_settings_isolation ON tenant_settings;
CREATE POLICY tenant_settings_isolation ON tenant_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_locales_isolation ON tenant_locales;
CREATE POLICY tenant_locales_isolation ON tenant_locales
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_currencies_isolation ON tenant_currencies;
CREATE POLICY tenant_currencies_isolation ON tenant_currencies
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_locales FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_currencies FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_settings TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_locales TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_currencies TO ecom_app;
GRANT SELECT ON TABLE fx_rates TO ecom_app;

-- Plan caps: allow demo multi enablement (starter was seeded at max_locales=1)
INSERT INTO plan_entitlements (plan_id, key, value)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'max_locales', '5'),
  ('10000000-0000-4000-8000-000000000001', 'max_currencies', '5')
ON CONFLICT (plan_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Demo tenant defaults: en + USD, multi off
INSERT INTO tenant_settings (
  tenant_id,
  default_locale,
  default_currency,
  multi_language,
  multi_currency,
  fx_rounding,
  fx_disclaimer
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'en',
  'USD',
  false,
  false,
  'half_up',
  'Display prices are converted for browsing; you are charged in the store currency.'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_locales (tenant_id, locale, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'en', true)
ON CONFLICT (tenant_id, locale) DO NOTHING;

INSERT INTO tenant_currencies (tenant_id, currency, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'USD', true)
ON CONFLICT (tenant_id, currency) DO NOTHING;

-- Isolation fixture tenant
INSERT INTO tenant_settings (
  tenant_id,
  default_locale,
  default_currency,
  multi_language,
  multi_currency
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'en',
  'USD',
  false,
  false
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_locales (tenant_id, locale, enabled)
VALUES ('00000000-0000-4000-8000-000000000002', 'en', true)
ON CONFLICT (tenant_id, locale) DO NOTHING;

INSERT INTO tenant_currencies (tenant_id, currency, enabled)
VALUES ('00000000-0000-4000-8000-000000000002', 'USD', true)
ON CONFLICT (tenant_id, currency) DO NOTHING;

-- Static display FX (USD base) for MVP browsing conversion
INSERT INTO fx_rates (base_currency, quote_currency, rate)
VALUES
  ('USD', 'USD', 1),
  ('USD', 'PKR', 278),
  ('USD', 'EUR', 0.92),
  ('USD', 'GBP', 0.79),
  ('USD', 'AED', 3.67)
ON CONFLICT (base_currency, quote_currency) DO NOTHING;
