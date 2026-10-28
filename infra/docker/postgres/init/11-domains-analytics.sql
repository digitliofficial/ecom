-- Custom domains (verification + SSL status) + first-party analytics events

ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_status text NOT NULL DEFAULT 'pending';

-- Backfill known local/platform hosts as verified (demo + isolation fixtures)
UPDATE tenant_domains
SET
  verification_status = 'verified',
  verified_at = COALESCE(verified_at, now()),
  ssl_status = 'active'
WHERE host IN ('demo.localhost', 'localhost', 'other.localhost')
  AND verification_status = 'pending';

-- Tighten RLS so inserts/updates stay tenant-scoped
DROP POLICY IF EXISTS tenant_domains_isolation ON tenant_domains;
CREATE POLICY tenant_domains_isolation ON tenant_domains
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  path text,
  session_id text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_tenant_occurred_idx
  ON analytics_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_tenant_name_idx
  ON analytics_events (tenant_id, event_name);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_events_isolation ON analytics_events;
CREATE POLICY analytics_events_isolation ON analytics_events
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE analytics_events FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE analytics_events TO ecom_app;
