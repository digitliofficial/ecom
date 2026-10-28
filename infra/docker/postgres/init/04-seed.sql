-- Demo tenant + domain

INSERT INTO plans (id, code, name)
VALUES ('10000000-0000-4000-8000-000000000001', 'starter', 'Starter')
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_entitlements (plan_id, key, value)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'max_products', '100'),
  ('10000000-0000-4000-8000-000000000001', 'max_locales', '1')
ON CONFLICT (plan_id, key) DO NOTHING;

INSERT INTO tenants (id, slug, status, plan_id, data_region)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'demo',
  'active',
  '10000000-0000-4000-8000-000000000001',
  'us'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_domains (tenant_id, host, is_primary)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'demo.localhost',
  true
)
ON CONFLICT (host) DO NOTHING;
