-- Privacy: cookie consent + GDPR DSAR (export/delete) + merchant privacy settings

CREATE TABLE IF NOT EXISTS tenant_privacy_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  dpa_acknowledged boolean NOT NULL DEFAULT false,
  dpa_acknowledged_at timestamptz,
  retention_days int NOT NULL DEFAULT 730 CHECK (retention_days >= 30 AND retention_days <= 3650),
  privacy_contact_email text,
  cookie_banner_enabled boolean NOT NULL DEFAULT true,
  cookie_banner_layout text NOT NULL DEFAULT 'bottom'
    CHECK (cookie_banner_layout IN ('bottom', 'modal')),
  analytics_category_enabled boolean NOT NULL DEFAULT true,
  marketing_category_enabled boolean NOT NULL DEFAULT true,
  privacy_policy_url text,
  cookie_policy_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_key text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  necessary boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'banner'
    CHECK (source IN ('banner', 'settings', 'import', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_tenant_subject_idx
  ON consent_events (tenant_id, subject_key, created_at DESC);

CREATE TABLE IF NOT EXISTS dsar_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  subject_email text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subject_kind text NOT NULL DEFAULT 'customer'
    CHECK (subject_kind IN ('customer', 'guest')),
  actor_kind text NOT NULL DEFAULT 'subject'
    CHECK (actor_kind IN ('subject', 'staff', 'system')),
  actor_id uuid,
  confirm_token_hash text,
  artifact jsonb,
  artifact_expires_at timestamptz,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dsar_requests_tenant_created_idx
  ON dsar_requests (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dsar_requests_tenant_email_idx
  ON dsar_requests (tenant_id, lower(subject_email));

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

ALTER TABLE tenant_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_privacy_settings_isolation ON tenant_privacy_settings;
CREATE POLICY tenant_privacy_settings_isolation ON tenant_privacy_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS consent_events_isolation ON consent_events;
CREATE POLICY consent_events_isolation ON consent_events
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS dsar_requests_isolation ON dsar_requests;
CREATE POLICY dsar_requests_isolation ON dsar_requests
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_privacy_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_events FORCE ROW LEVEL SECURITY;
ALTER TABLE dsar_requests FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenant_privacy_settings, consent_events, dsar_requests TO ecom_app;

-- Demo tenant: banner on, both optional categories, privacy contact set
INSERT INTO tenant_privacy_settings (
  tenant_id,
  dpa_acknowledged,
  dpa_acknowledged_at,
  retention_days,
  privacy_contact_email,
  cookie_banner_enabled,
  cookie_banner_layout,
  analytics_category_enabled,
  marketing_category_enabled,
  privacy_policy_url,
  cookie_policy_url
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  true,
  now(),
  730,
  'privacy@demo.localhost',
  true,
  'bottom',
  true,
  true,
  '/en/privacy',
  '/en/privacy#cookies'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Isolation fixture: banner enabled, marketing off
INSERT INTO tenant_privacy_settings (
  tenant_id,
  dpa_acknowledged,
  retention_days,
  privacy_contact_email,
  cookie_banner_enabled,
  cookie_banner_layout,
  analytics_category_enabled,
  marketing_category_enabled
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  false,
  365,
  NULL,
  true,
  'bottom',
  true,
  false
)
ON CONFLICT (tenant_id) DO NOTHING;
