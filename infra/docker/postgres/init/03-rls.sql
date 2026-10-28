-- Enable RLS on tenant tables; policy uses app.tenant_id session GUC

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

-- tenants: allow row when id matches session tenant
CREATE POLICY tenants_isolation ON tenants
  USING (id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_domains_isolation ON tenant_domains
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY carts_isolation ON carts
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY cart_lines_isolation ON cart_lines
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY checkout_sessions_isolation ON checkout_sessions
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Force RLS for table owners too when using ecom_app
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;
ALTER TABLE cart_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions FORCE ROW LEVEL SECURITY;
