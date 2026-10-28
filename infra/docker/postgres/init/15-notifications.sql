-- Notification outbox, email deliveries, prefs, abandoned cart runs (Arch §8 / §14)

CREATE TABLE IF NOT EXISTS tenant_notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  order_placed_customer boolean NOT NULL DEFAULT true,
  order_placed_merchant boolean NOT NULL DEFAULT true,
  order_shipped_customer boolean NOT NULL DEFAULT true,
  order_cancelled_customer boolean NOT NULL DEFAULT true,
  abandoned_cart_enabled boolean NOT NULL DEFAULT false,
  -- 0 = immediate (local/dev); typical production 60–240 minutes
  abandoned_cart_idle_minutes int NOT NULL DEFAULT 60
    CHECK (abandoned_cart_idle_minutes >= 0 AND abandoned_cart_idle_minutes <= 10080),
  merchant_alert_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  template_id text NOT NULL,
  to_email text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON notification_outbox (status, scheduled_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  outbox_id uuid NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_message_id text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abandoned_cart_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  step int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'cancelled', 'failed')),
  outbox_id uuid REFERENCES notification_outbox(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cart_id, step)
);

ALTER TABLE tenant_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_cart_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_notification_settings_isolation ON tenant_notification_settings;
CREATE POLICY tenant_notification_settings_isolation ON tenant_notification_settings
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS notification_outbox_isolation ON notification_outbox;
CREATE POLICY notification_outbox_isolation ON notification_outbox
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS email_deliveries_isolation ON email_deliveries;
CREATE POLICY email_deliveries_isolation ON email_deliveries
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS abandoned_cart_runs_isolation ON abandoned_cart_runs;
CREATE POLICY abandoned_cart_runs_isolation ON abandoned_cart_runs
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE tenant_notification_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE abandoned_cart_runs FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenant_notification_settings,
  notification_outbox,
  email_deliveries,
  abandoned_cart_runs
TO ecom_app;

-- Cross-tenant workers (RLS-safe) — Nest poller as ecom_app
CREATE OR REPLACE FUNCTION claim_pending_notification_outbox(batch_size int DEFAULT 20)
RETURNS SETOF notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT o.id
    FROM notification_outbox o
    WHERE o.status = 'pending'
      AND o.scheduled_at <= now()
    ORDER BY o.scheduled_at ASC
    LIMIT GREATEST(batch_size, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_outbox o
  SET status = 'processing',
      attempts = o.attempts + 1
  FROM due
  WHERE o.id = due.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION find_abandoned_cart_candidates(limit_n int DEFAULT 50)
RETURNS TABLE (
  tenant_id uuid,
  cart_id uuid,
  email text,
  locale text,
  guest_token text,
  idle_minutes int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.tenant_id,
    c.id,
    c.email,
    COALESCE(c.locale, 'en'),
    c.guest_token,
    s.abandoned_cart_idle_minutes
  FROM carts c
  INNER JOIN tenant_notification_settings s ON s.tenant_id = c.tenant_id
  WHERE s.abandoned_cart_enabled = true
    AND c.status = 'active'
    AND c.email IS NOT NULL
    AND length(trim(c.email)) > 0
    AND EXISTS (SELECT 1 FROM cart_lines cl WHERE cl.cart_id = c.id)
    AND c.updated_at <= now() - make_interval(mins => s.abandoned_cart_idle_minutes)
    AND NOT EXISTS (
      SELECT 1
      FROM abandoned_cart_runs r
      WHERE r.cart_id = c.id
        AND r.step = 1
        AND r.status IN ('queued', 'sent')
    )
  ORDER BY c.updated_at ASC
  LIMIT GREATEST(limit_n, 1);
$$;

GRANT EXECUTE ON FUNCTION claim_pending_notification_outbox(int) TO ecom_app;
GRANT EXECUTE ON FUNCTION find_abandoned_cart_candidates(int) TO ecom_app;

-- Demo tenant: lifecycle mail on; abandoned cart on with idle 0 for local demos
INSERT INTO tenant_notification_settings (
  tenant_id,
  order_placed_customer,
  order_placed_merchant,
  order_shipped_customer,
  order_cancelled_customer,
  abandoned_cart_enabled,
  abandoned_cart_idle_minutes,
  merchant_alert_email
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  true,
  true,
  true,
  true,
  true,
  0,
  'owner@demo.localhost'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Isolation fixture: lifecycle on; abandoned cart off
INSERT INTO tenant_notification_settings (
  tenant_id,
  abandoned_cart_enabled,
  abandoned_cart_idle_minutes,
  merchant_alert_email
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  false,
  60,
  NULL
)
ON CONFLICT (tenant_id) DO NOTHING;
