-- Enable RLS on tenant tables; policy uses app.tenant_id session GUC
-- Idempotent: safe to re-run via `pnpm db:apply` on existing volumes.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

-- tenants: allow row when id matches session tenant
DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_isolation ON tenants
  USING (id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_domains_isolation ON tenant_domains;
CREATE POLICY tenant_domains_isolation ON tenant_domains
  USING (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS carts_isolation ON carts;
CREATE POLICY carts_isolation ON carts
  USING (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS cart_lines_isolation ON cart_lines;
CREATE POLICY cart_lines_isolation ON cart_lines
  USING (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS checkout_sessions_isolation ON checkout_sessions;
CREATE POLICY checkout_sessions_isolation ON checkout_sessions
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Force RLS for table owners too when using ecom_app
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;
ALTER TABLE cart_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions FORCE ROW LEVEL SECURITY;
