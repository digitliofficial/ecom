-- Shopify → platform migration jobs, idempotent records, SEO redirects

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'platform';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('shopify_api', 'csv', 'fixture')),
  entity_types text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  shop_domain text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid REFERENCES migration_jobs(id) ON DELETE SET NULL,
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'product', 'variant', 'customer', 'order', 'redirect'
    )),
  external_id text NOT NULL,
  internal_id uuid,
  checksum text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'imported', 'skipped', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, external_id)
);

CREATE TABLE IF NOT EXISTS url_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_path text NOT NULL,
  to_path text NOT NULL,
  status_code int NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, from_path)
);

CREATE INDEX IF NOT EXISTS migration_jobs_tenant_created_idx
  ON migration_jobs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS migration_records_job_idx
  ON migration_records (job_id);

CREATE INDEX IF NOT EXISTS url_redirects_tenant_from_idx
  ON url_redirects (tenant_id, from_path);

ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS migration_jobs_isolation ON migration_jobs;
CREATE POLICY migration_jobs_isolation ON migration_jobs
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS migration_records_isolation ON migration_records;
CREATE POLICY migration_records_isolation ON migration_records
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS url_redirects_isolation ON url_redirects;
CREATE POLICY url_redirects_isolation ON url_redirects
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE migration_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE migration_records FORCE ROW LEVEL SECURITY;
ALTER TABLE url_redirects FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE migration_jobs, migration_records, url_redirects TO ecom_app;

-- Platform-ops helpers (bypass RLS for tenant discovery only).
CREATE OR REPLACE FUNCTION list_tenant_ids_for_platform()
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id FROM tenants t ORDER BY t.created_at;
$$;

REVOKE ALL ON FUNCTION list_tenant_ids_for_platform() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_tenant_ids_for_platform() TO ecom_app;

CREATE OR REPLACE FUNCTION resolve_tenant_id_by_ref(p_ref text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id
  FROM tenants t
  WHERE t.id::text = p_ref OR lower(t.slug) = lower(p_ref)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_tenant_id_by_ref(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant_id_by_ref(text) TO ecom_app;
