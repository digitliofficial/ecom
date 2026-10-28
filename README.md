# ecom

Multi-tenant ecommerce SaaS monorepo (NestJS commerce core, FastAPI compute, Next.js storefront/admin).

**Phase 0 + guest checkout slice** — foundations, demo tenant RLS, guest cart cookie/token, checkout → `placed` order without charging, FastAPI address stub, storefront flow.

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

# If the Postgres volume predates guest-checkout init (catalog 500 /
# missing resolve_tenant_id_by_host), upgrade schema+seed without wiping:
pnpm db:apply
# Cross-platform (Node); works in Windows PowerShell — no Git Bash required.

# Dev (all apps) or filter
pnpm dev
# pnpm --filter @ecom/api dev
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

Demo tenant: slug `demo`, hosts `demo.localhost` / `localhost`. Isolation fixture: `other` / `other.localhost`. Storefront sends `X-Forwarded-Host: demo.localhost` (or use `x-tenant-host`).

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

**Merchant admin (`:3002`) — local stub only.** Open `/login`, enter any non-empty email + password (no seed accounts). Submit sets a client cookie + `localStorage` flag (`ecom_admin_stub_session`) and redirects to the signed-in shell at `/`. Sign out clears the stub session. This is not real authentication.

Storefront is guest checkout (no login). Platform admin remains a placeholder shell. API `AuthService` accepts any non-empty Bearer token as a Phase 0 stub (returns `stub-user` / `staff`) — not real JWT verification. Seeds create tenants/catalog only, not staff accounts. Local Postgres passwords above are the only DB credentials.

### Guest checkout smoke

```bash
pnpm --filter @ecom/api dev          # :3001
# optional: cd apps/compute && uv run uvicorn app.main:app --port 8000
pnpm --filter @ecom/storefront dev   # :3005 → /en
```

Flow: home → Add to cart → cart → checkout (email + address) → order `placed` / `not_charged` (NoopAdapter).

## Workspace layout

See [architecture](docs will live in Project Context) — apps under `apps/`, shared TS under `packages/`, Docker under `infra/docker/`.

## Scripts

- `pnpm build` / `lint` / `test` / `typecheck` — Turborepo pipelines
- `pnpm db:apply` — re-apply idempotent Postgres init SQL (Node; Windows-safe)
- Python compute: `cd apps/compute && uv sync && uv run pytest`

## Docs

Architecture and scaffold plan live in the Digitli Project Hub Context (`docs/ecommerce-saas-architecture.md`, `docs/monorepo-scaffold-plan.md`).
