# ecom

Multi-tenant ecommerce SaaS monorepo (NestJS commerce core, FastAPI compute, Next.js storefront/admin).

**Phase 0 + guest checkout + merchant catalog admin** — foundations, demo tenant RLS, guest cart cookie/token, checkout → `placed` order without charging, FastAPI address stub, storefront flow, and merchant admin product CRUD for the demo tenant.

## Stack

| Layer | Tech |
|---|---|
| Workspace | pnpm + Turborepo |
| Commerce API | NestJS (`apps/api`) |
| Compute | FastAPI (`apps/compute`) |
| Storefront / Admin | Next.js App Router |
| Data | PostgreSQL 16 (RLS) + Redis 7 |

## Quick start

```bash
# Node 22 + pnpm (Corepack)
corepack enable
pnpm install

# Local data plane
docker compose up -d

# Copy env
cp .env.example .env

# If the Postgres volume predates catalog/admin SQL, re-apply idempotent init:
pnpm db:apply
# Cross-platform (Node); works in Windows PowerShell — no Git Bash required.

# Dev (all apps) or filter
pnpm dev
# pnpm --filter @ecom/api dev
# pnpm --filter @ecom/admin dev
# pnpm --filter @ecom/storefront dev
```

| Service | URL |
|---|---|
| Storefront | http://localhost:3005 |
| Admin | http://localhost:3002 |
| Platform admin | http://localhost:3003 |
| Nest API | http://localhost:3001/health |
| FastAPI compute | http://localhost:8000/health |
| Postgres | `localhost:5432` (`ecom` / `ecom`) |
| Redis | `localhost:6379` |

Demo tenant: slug `demo`, hosts `demo.localhost` / `localhost`. Isolation fixture: `other` / `other.localhost`.

App DB user for RLS: `ecom_app` / `ecom` (see `.env.example`). Owner `ecom` bypasses RLS as superuser in Compose. Init SQL under `infra/docker/postgres/init/` runs only on **first** volume create.

#### Stale local Postgres volume

Compose init scripts do not re-run on existing volumes. If Nest logs `function resolve_tenant_id_by_host(...) does not exist` or storefront shows catalog **500**:

```bash
# Preferred — idempotent upgrade (keeps volume data)
pnpm db:apply

# Or wipe local demo data and re-seed from init/ (OK for local demo only)
docker compose down -v && docker compose up -d
```

`pnpm db:apply` runs `node scripts/db-apply.mjs` (not bash), so it works in **Windows PowerShell**, cmd, macOS, and Linux. It applies every `infra/docker/postgres/init/*.sql` via `docker compose exec` when `ecom-postgres` is up, otherwise via local `psql` (`DATABASE_URL_ADMIN` or `postgresql://ecom:ecom@localhost:5432/ecom`).

**Windows PowerShell verify**

```powershell
docker compose up -d
pnpm db:apply
# Expect: "Applying init SQL via docker compose…" then "OK — schema/seed/RLS/host resolve applied."
curl.exe -sS -H "x-tenant-host: demo.localhost" http://localhost:3001/v1/catalog/products
```

Then re-check (any shell): `curl -sS -H 'x-tenant-host: demo.localhost' http://localhost:3001/v1/catalog/products`

### Auth / passwords

**No real app users yet.** Storefront is guest checkout (no login). Merchant admin uses a **stub login** (`Continue (stub)` / any non-empty email+password) that sets a cookie; API admin catalog calls send `Authorization: Bearer stub-admin` (Phase 0 stub — any non-empty Bearer works). Platform admin is a placeholder shell. Seeds create tenants/catalog only, not staff accounts. Local Postgres passwords above are the only credentials.

### Merchant catalog admin (local)

```bash
pnpm db:apply                       # ensures inventory_quantity + resolve_tenant helpers
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005 → /en
```

1. Open http://localhost:3002/login — enter any email + password → Continue (stub).
2. Go to **Products** → **New product** — set title, slug, description, variant SKU, price (minor units + currency), inventory qty.
3. Save with status `active`.
4. Refresh the storefront at http://localhost:3005/en — the new product appears in the catalog (demo tenant).

Admin API (Bearer required; host → demo tenant):

```bash
curl -sS -H 'Host: demo.localhost' -H 'Authorization: Bearer stub-admin' \
  http://localhost:3001/v1/admin/catalog/products

curl -sS -X POST -H 'Host: demo.localhost' -H 'Authorization: Bearer stub-admin' \
  -H 'Content-Type: application/json' \
  -d '{"title":"New Mug","slug":"new-mug","status":"active","variants":[{"title":"Default","sku":"MUG-NEW-01","unitAmountMinor":1800,"currency":"USD","inventoryQuantity":5}]}' \
  http://localhost:3001/v1/admin/catalog/products
```

### Guest checkout smoke

```bash
pnpm --filter @ecom/api dev          # :3001
# optional: cd apps/compute && uv run uvicorn app.main:app --port 8000
pnpm --filter @ecom/storefront dev   # :3005 → /en
```

Flow: home → Add to cart → cart → checkout (email + address) → order `placed` / `not_charged` (NoopAdapter).

## Workspace layout

See architecture docs in the Digitli Project Hub Context — apps under `apps/`, shared TS under `packages/`, Docker under `infra/docker/`.

## Scripts

- `pnpm build` / `lint` / `test` / `typecheck` — Turborepo pipelines
- `pnpm db:apply` — re-apply idempotent Postgres init SQL (Node; Windows-safe)
- Python compute: `cd apps/compute && uv sync && uv run pytest`

## Docs

Architecture and scaffold plan live in the Digitli Project Hub Context (`docs/ecommerce-saas-architecture.md`, `docs/monorepo-scaffold-plan.md`).
