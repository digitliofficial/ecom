-- Real auth: platform users + tenant memberships + customers; link carts/orders

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_isolation ON memberships;
CREATE POLICY memberships_isolation ON memberships
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS customers_isolation ON customers;
CREATE POLICY customers_isolation ON customers
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, memberships, customers TO ecom_app;

-- Demo merchant owner: owner@demo.localhost / DemoOwner123!
-- bcrypt cost 10 (generated for local demo seed)
INSERT INTO users (id, email, password_hash, display_name)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  'owner@demo.localhost',
  '$2b$10$vUPBV0Hm4iAMOXOoZjhJAujPuMf0wPAQIbp/0iyGsHRGZWR2f89W2',
  'Demo Owner'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name;

INSERT INTO memberships (id, tenant_id, user_id, role)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'owner'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Optional demo customer: customer@demo.localhost / DemoCustomer123!
INSERT INTO customers (id, tenant_id, email, password_hash, display_name, email_verified_at)
VALUES (
  '60000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'customer@demo.localhost',
  '$2b$10$bWYbnuX.XU5T3Uu06NAdLeydn6gscciYhYAZ2/Vesf.tO93Q0OCGS',
  'Demo Customer',
  now()
)
ON CONFLICT (tenant_id, email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    email_verified_at = COALESCE(customers.email_verified_at, EXCLUDED.email_verified_at);
