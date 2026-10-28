-- Phase 0 bootstrap: extensions + app role helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- App role for Nest/FastAPI (same password as compose for local)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ecom_app') THEN
    CREATE ROLE ecom_app LOGIN PASSWORD 'ecom';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE ecom TO ecom_app;
