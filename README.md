# ecom

Multi-tenant ecommerce SaaS monorepo (NestJS commerce core, FastAPI compute, Next.js storefront/admin).

**Phase 0 + guest/account checkout + merchant catalog/orders admin + real auth** — foundations, demo tenant RLS, guest cart cookie/token, checkout → `placed` order without charging, FastAPI address stub, storefront flow, merchant admin product CRUD + order fulfill/ship/cancel, and email/password sessions (JWT httpOnly cookies) for merchant staff and customers.

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

# If the Postgres volume predates catalog/admin/auth SQL, re-apply idempotent init:
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
# Expect: "Applying init SQL via docker compose…" then "OK — schema/seed/RLS/host resolve/catalog admin/auth applied."
curl.exe -sS -H "x-tenant-host: demo.localhost" http://localhost:3001/v1/catalog/products
```

Then re-check (any shell): `curl -sS -H 'x-tenant-host: demo.localhost' http://localhost:3001/v1/catalog/products`

### Auth / demo credentials

Passwords are bcrypt-hashed in Nest. Sessions are JWT in httpOnly cookies (`ecom_staff_session` / `ecom_customer_session`); Bearer tokens from login responses also work for API clients.

| Actor | Email | Password |
|---|---|---|
| Merchant owner (demo tenant) | `owner@demo.localhost` | `DemoOwner123!` |
| Customer (optional demo) | `customer@demo.localhost` | `DemoCustomer123!` |
| Postgres app role | `ecom_app` | `ecom` |
| Postgres owner | `ecom` | `ecom` |

Set `JWT_SECRET` in `.env` (see `.env.example`). Empty local secret falls back to a fixed dev value — change before any shared deploy.

```bash
# Staff login → cookie + token
curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login

# Customer login
curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"customer@demo.localhost","password":"DemoCustomer123!"}' \
  http://localhost:3001/v1/auth/customer/login
```

Admin middleware requires the staff session cookie. Storefront keeps **guest checkout**; header **Account login / register** uses the customer path and links the current guest cart on login/register.

### Merchant catalog admin (local)

```bash
pnpm db:apply                       # ensures inventory + auth seed
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005 → /en
```

1. Open http://localhost:3002/login — sign in as `owner@demo.localhost` / `DemoOwner123!`.
2. Go to **Products** → **New product** — set title, slug, description, variant SKU, price (minor units + currency), inventory qty.
3. Save with status `active`.
4. Refresh the storefront at http://localhost:3005/en — the new product appears in the catalog (demo tenant).

Admin API (staff JWT required; host → demo tenant):

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/catalog/products

curl -sS -X POST -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"New Mug","slug":"new-mug","status":"active","variants":[{"title":"Default","sku":"MUG-NEW-01","unitAmountMinor":1800,"currency":"USD","inventoryQuantity":5}]}' \
  http://localhost:3001/v1/admin/catalog/products
```

### Guest / account checkout smoke

```bash
pnpm --filter @ecom/api dev          # :3001
# optional: cd apps/compute && uv run uvicorn app.main:app --port 8000
pnpm --filter @ecom/storefront dev   # :3005 → /en
```

Flow: home → Add to cart → cart → checkout (email + address) → order `placed` / `not_charged` (NoopAdapter). Optional: sign in as `customer@demo.localhost` first (guest cart attaches to the account). Placed orders show up under merchant **Orders** admin (below).

### Merchant orders admin (local)

```bash
pnpm db:apply                       # ensures auth + orders schema
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005 → /en
```

1. On the storefront, complete a guest checkout (any email + address) so an order is `placed`.
2. Open http://localhost:3002/login — sign in as `owner@demo.localhost` / `DemoOwner123!`.
3. Go to **Orders** — the guest order appears for the demo tenant (newest first).
4. Open the order → **Fulfill**, **Mark shipped**, or **Cancel** (`placed`/`pending` → terminal status). Fulfill and ship also set line `qty_fulfilled = qty_ordered`.

Admin API (staff JWT required; host → demo tenant):

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/orders

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>

curl -sS -X PATCH -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"fulfilled"}' \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>/status
```

Allowed status updates from `placed` (or `pending`): `fulfilled`, `shipped`, `cancelled`.

## Workspace layout

See architecture docs in the Digitli Project Hub Context — apps under `apps/`, shared TS under `packages/`, Docker under `infra/docker/`.

## Scripts

- `pnpm build` / `lint` / `test` / `typecheck` — Turborepo pipelines
- `pnpm db:apply` — re-apply idempotent Postgres init SQL (Node; Windows-safe)
- Python compute: `cd apps/compute && uv sync && uv run pytest`

## Docs

Architecture and scaffold plan live in the Digitli Project Hub Context (`docs/ecommerce-saas-architecture.md`, `docs/monorepo-scaffold-plan.md`).
