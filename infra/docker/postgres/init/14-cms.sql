-- CMS: theme selection, SEO, menus, policy page defaults

CREATE TABLE IF NOT EXISTS tenant_theme_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  theme_pack_id text NOT NULL DEFAULT 'default',
  token_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_seo_settings (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en',
  site_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  og_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, locale)
);

CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  handle text NOT NULL,
  title text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, handle),
  CHECK (handle IN ('header', 'footer'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  label text NOT NULL,
  href text NOT NULL,
  position int NOT NULL DEFAULT 0,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_items_menu_position_idx
  ON menu_items (menu_id, position);

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, locale),
  CHECK (kind IN ('privacy', 'refund', 'terms', 'shipping', 'cookie'))
);

ALTER TABLE tenant_theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_theme_settings_isolation ON tenant_theme_settings;
CREATE POLICY tenant_theme_settings_isolation ON tenant_theme_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_seo_settings_isolation ON tenant_seo_settings;
CREATE POLICY tenant_seo_settings_isolation ON tenant_seo_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS menus_isolation ON menus;
CREATE POLICY menus_isolation ON menus
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS menu_items_isolation ON menu_items;
CREATE POLICY menu_items_isolation ON menu_items
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS policies_isolation ON policies;
CREATE POLICY policies_isolation ON policies
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_theme_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_seo_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE menus FORCE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE policies FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_theme_settings TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_seo_settings TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE menus TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE menu_items TO ecom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE policies TO ecom_app;

-- Demo tenant CMS defaults
INSERT INTO tenant_theme_settings (tenant_id, theme_pack_id)
VALUES ('00000000-0000-4000-8000-000000000001', 'default')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_seo_settings (tenant_id, locale, site_title, meta_description)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'en',
  'ecom · demo',
  'Demo multi-tenant storefront — guest checkout, COD, and bank transfer.'
)
ON CONFLICT (tenant_id, locale) DO NOTHING;

INSERT INTO menus (id, tenant_id, handle, title)
VALUES
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'header', 'Header'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'footer', 'Footer')
ON CONFLICT (tenant_id, handle) DO NOTHING;

-- Seed header/footer items only when the menu is empty (idempotent re-apply)
INSERT INTO menu_items (tenant_id, menu_id, label, href, position, locale)
SELECT t.tenant_id, m.id, t.label, t.href, t.position, NULL
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 'header', 'Home', '/en', 0),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'header', 'Cart', '/en/cart', 1),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'footer', 'Privacy', '/en/policies/privacy', 0),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'footer', 'Terms', '/en/policies/terms', 1),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'footer', 'Refund', '/en/policies/refund', 2),
    ('00000000-0000-4000-8000-000000000001'::uuid, 'footer', 'Shipping', '/en/policies/shipping', 3)
) AS t(tenant_id, handle, label, href, position)
JOIN menus m ON m.tenant_id = t.tenant_id AND m.handle = t.handle
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.menu_id = m.id
);

INSERT INTO policies (id, tenant_id, kind, locale, title, body)
VALUES
  (
    '42000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'privacy',
    'en',
    'Privacy policy',
    E'This demo store collects only what is needed to fulfill orders (email, shipping address, and payment method choice).\n\nWe do not sell personal data. Contact the merchant to request export or deletion (DSAR).'
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'refund',
    'en',
    'Refund policy',
    E'Refunds are handled by the merchant for unused items within 14 days of delivery.\n\nCOD orders: refunds are settled after the courier return is confirmed. Bank transfer orders: refunds go back to the same account used for payment.'
  ),
  (
    '42000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'terms',
    'en',
    'Terms of service',
    E'By placing an order you agree to provide accurate contact and shipping details.\n\nPrices and availability may change. Offline payments (COD / bank transfer) remain pending until the merchant confirms receipt.'
  ),
  (
    '42000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'shipping',
    'en',
    'Shipping policy',
    E'Demo shipping is merchant-configured. Typical local delivery is 2–5 business days after payment confirmation.\n\nYou will receive tracking when the order is marked shipped.'
  ),
  (
    '42000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'cookie',
    'en',
    'Cookie policy',
    E'We use essential cookies for guest cart and account sessions.\n\nAnalytics cookies are gated by consent when the merchant enables them.'
  )
ON CONFLICT (tenant_id, kind, locale) DO NOTHING;

-- Isolation fixture: minimal CMS (different theme + SEO title)
INSERT INTO tenant_theme_settings (tenant_id, theme_pack_id)
VALUES ('00000000-0000-4000-8000-000000000002', 'daylight')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_seo_settings (tenant_id, locale, site_title, meta_description)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'en',
  'Other store',
  'Isolation fixture tenant — not the demo catalog.'
)
ON CONFLICT (tenant_id, locale) DO NOTHING;

INSERT INTO menus (id, tenant_id, handle, title)
VALUES
  ('40000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'header', 'Header'),
  ('40000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002', 'footer', 'Footer')
ON CONFLICT (tenant_id, handle) DO NOTHING;

INSERT INTO menu_items (tenant_id, menu_id, label, href, position, locale)
SELECT t.tenant_id, m.id, t.label, t.href, t.position, NULL
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000002'::uuid, 'header', 'Home', '/en', 0),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'footer', 'Privacy', '/en/policies/privacy', 0)
) AS t(tenant_id, handle, label, href, position)
JOIN menus m ON m.tenant_id = t.tenant_id AND m.handle = t.handle
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi WHERE mi.menu_id = m.id
);

INSERT INTO policies (id, tenant_id, kind, locale, title, body)
VALUES (
  '42000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000002',
  'privacy',
  'en',
  'Other privacy',
  'Isolation fixture privacy policy.'
)
ON CONFLICT (tenant_id, kind, locale) DO NOTHING;
