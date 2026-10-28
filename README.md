# ecom

Multi-tenant ecommerce SaaS monorepo (NestJS commerce core, FastAPI compute, Next.js storefront/admin).

**Phase 0 + guest/account checkout + merchant catalog/orders admin + real auth + offline payments + shipping/couriers MVP + partial fulfillments + custom domains + analytics ingest** — foundations, demo tenant RLS, guest cart cookie/token, checkout → `placed` order with **COD** (`pending_cod`) or **bank transfer** (`pending_transfer`) plus a selected **shipping method** (flat-rate cost on the total), FastAPI address + **CourierPort** stubs, storefront flow, merchant admin product CRUD + **split shipments** (line qty + tracking) + payment + shipping settings + **Domains** (CNAME instructions + table) + **Analytics** dashboard stub, platform-admin ops stub, and email/password sessions (JWT httpOnly cookies) for merchant staff and customers. Stripe/Noop stay optional and **disabled by default**. Pakistan/local courier adapters are documented extension points (not live yet).

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

# If the Postgres volume predates catalog/admin/auth/payments/shipping SQL, re-apply idempotent init:
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
# Expect: "Applying init SQL via docker compose…" then "OK — …/shipping/fulfillments/domains+analytics applied."
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
pnpm db:apply                        # ensures payment settings seed
pnpm --filter @ecom/api dev          # :3001
# optional: cd apps/compute && uv run uvicorn app.main:app --port 8000
pnpm --filter @ecom/storefront dev   # :3005 → /en
```

Flow: home → Add to cart → cart → checkout (email + address + **payment method** + **shipping method**) → order `placed` with `pending_cod` (COD) or `pending_transfer` (bank transfer + instructions); shipping cost is included in `totalAmountMinor`. Optional: sign in as `customer@demo.localhost` first (guest cart attaches to the account). Placed orders show up under merchant **Orders** admin (below).

```bash
# Enabled payment + shipping methods for demo tenant
curl -sS -H 'Host: demo.localhost' http://localhost:3001/v1/payments/methods
curl -sS -H 'Host: demo.localhost' 'http://localhost:3001/v1/shipping/methods?paymentMethod=cod'
```

### Offline payments — COD + bank transfer (local)

Pakistan-first offline methods via the `PaymentProvider` port (`CodAdapter` / `BankTransferAdapter`). Stripe Connect stub remains in the package but is **not** offered at checkout unless a tenant flips `stripeEnabled` (still not charged — stub only).

```bash
pnpm db:apply                       # 08-payment-methods.sql
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005
```

1. Open http://localhost:3002/login — `owner@demo.localhost` / `DemoOwner123!`.
2. Go to **Payments** — toggle COD and/or bank transfer; set account name, IBAN/account #, bank name.
3. On the storefront checkout, pick **Cash on delivery** or **Bank transfer**.
4. COD → order `payment_status=pending_cod`. Bank transfer → `pending_transfer` and transfer instructions on the confirmation screen.

Admin API:

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/payments/settings

curl -sS -X PATCH -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"codEnabled":true,"bankTransferEnabled":true,"bankAccountName":"Demo Merchant PK","bankAccountNumber":"PK36SCBL0000001123456702","bankName":"Demo Bank Pakistan","stripeEnabled":false}' \
  http://localhost:3001/v1/admin/payments/settings
```

Checkout (guest cart token from `POST /v1/carts`):

```bash
curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -H "X-Cart-Token: $GUEST_TOKEN" \
  -d '{"cartId":"'"$CART_ID"'","email":"guest@example.com","paymentMethod":"cod","shippingMethodId":"40000000-0000-4000-8000-000000000001","shippingAddress":{"line1":"12 Clifton","city":"Karachi","country":"PK"}}' \
  http://localhost:3001/v1/checkout/sessions
```

### Shipping / couriers MVP (local)

Manual flat-rate methods in Nest (SoT) + FastAPI **CourierPort** stubs (`manual`, `aggregator_stub`). Pakistan / local carriers later: implement `local_pk_*` in `apps/compute/app/couriers/` and set `shipping_methods.adapter` — same quote/book/track surface.

```bash
pnpm db:apply                       # 09-shipping.sql
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005
# optional CourierPort: cd apps/compute && uv run uvicorn app.main:app --port 8000
```

1. Admin → **Shipping** — add/edit flat-rate methods (name, price minor units, COD-compatible, adapter).
2. Storefront checkout — pick a shipping method (COD hides non-COD-compatible rates); cost is added to the order total.
3. Admin → **Orders** → open order → enter tracking (optional) → **Fulfill** / **Mark shipped**.

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/shipping/methods

curl -sS -X POST -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Same-day","priceAmountMinor":1200,"currency":"USD","codCompatible":true,"adapter":"manual"}' \
  http://localhost:3001/v1/admin/shipping/methods

# FastAPI CourierPort stubs
curl -sS -X POST http://localhost:8000/v1/shipping/rates \
  -H 'Content-Type: application/json' \
  -d '{"adapter":"aggregator_stub","to":{"line1":"1 St","city":"Karachi","country":"PK"}}'
```

Demo seed methods: Standard (`500`), Express (`1500`), Aggregator stub (`800`, not COD-compatible).

### Localization — multi-language + multi-currency (local)

Merchant admin toggles for defaults, multi-language / multi-currency, and enabled
locale/currency lists. Storefront shows language and currency switchers when
multi is on and more than one option is enabled. Charge currency stays the store
default (MVP); display currency is cookie-backed for browsing.

```bash
pnpm db:apply                       # 12-localization.sql
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/storefront dev  # :3005 → /en
```

1. Open http://localhost:3002/login — `owner@demo.localhost` / `DemoOwner123!`.
2. Go to **Localization** — set defaults; enable multi-language / multi-currency; tick extra locales (e.g. `ur`) and currencies (e.g. `PKR`).
3. Open http://localhost:3005/en — language and currency switchers appear in the header when &gt;1 option is enabled.

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/localization/settings

curl -sS -X PATCH -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"multiLanguage":true,"enabledLocales":["en","ur"],"multiCurrency":true,"enabledCurrencies":["USD","PKR"]}' \
  http://localhost:3001/v1/admin/localization/settings

curl -sS -H 'Host: demo.localhost' http://localhost:3001/v1/localization
```

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
4. Open the order → set **Ship qty** per line → **Create shipment** (optional carrier/tracking; aggregator stub can mint tracking). Repeat for split shipments. Order rolls to `partially_fulfilled` then `fulfilled`. Shortcuts: **Fulfill remaining** / **Ship remaining** / **Cancel order** (also write `shipments` / tracking events).

Admin API (staff JWT required; host → demo tenant):

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/orders

curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>

# Partial shipment (line qty + tracking)
curl -sS -X POST -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"lines":[{"orderLineId":"<LINE_ID>","qty":1}],"carrier":"TCS","trackingNumber":"TCS-1","markShipped":true}' \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>/fulfillments

# Update tracking on an existing shipment
curl -sS -X PATCH -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"trackingNumber":"TCS-2","carrier":"TCS","status":"shipped"}' \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>/fulfillments/<FULFILLMENT_ID>

# Shortcuts: fulfill/ship remaining, or cancel
curl -sS -X PATCH -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"shipped","trackingNumber":"TCS-DEMO-001","trackingCarrier":"TCS"}' \
  http://localhost:3001/v1/admin/orders/<ORDER_ID>/status
```

Fulfillments: multiple per order; each has lines (`orderLineId` + `qty`), optional `carrier` / `trackingNumber`, status `pending`|`shipped`|`delivered`|`cancelled`. Order status rolls up to `partially_fulfilled` / `fulfilled`. Status shortcuts from `placed`/`pending`/`partially_fulfilled`: `fulfilled` (remaining), `shipped` (remaining + order-level shipped), `cancelled`.

### Custom domains + analytics (local)

```bash
pnpm db:apply                       # 11-domains-analytics.sql
pnpm --filter @ecom/api dev         # :3001
pnpm --filter @ecom/admin dev       # :3002
pnpm --filter @ecom/platform-admin dev  # :3003 (ops stub)
```

1. Open http://localhost:3002/login — `owner@demo.localhost` / `DemoOwner123!`.
2. Go to **Domains** — read CNAME host/target (`PLATFORM_CNAME_TARGET`, default `edge.ecom.digitli.local`), add a custom hostname, **Verify** (DNS lookup stubbed), remove when done. Seed hosts (`demo.localhost`, `localhost`) stay locked.
3. Go to **Analytics** — dashboard stub shows totals + recent events after ingest.
4. Platform ops stub: http://localhost:3003

```bash
TOKEN=$(curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.localhost","password":"DemoOwner123!"}' \
  http://localhost:3001/v1/auth/staff/login | jq -r .token)

# Domain table + CNAME instructions
curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/domains

# Ingest a first-party event (storefront / beacon)
curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' \
  -d '{"eventName":"page_view","path":"/en","sessionId":"sess-1"}' \
  http://localhost:3001/v1/analytics/events

# Admin summary stub
curl -sS -H 'Host: demo.localhost' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/admin/analytics/summary
```

Allowed ingest `eventName` values: `page_view`, `product_view`, `add_to_cart`, `begin_checkout`, `purchase`, `custom`.

## Workspace layout

See architecture docs in the Digitli Project Hub Context — apps under `apps/`, shared TS under `packages/`, Docker under `infra/docker/`.

## Scripts

- `pnpm build` / `lint` / `test` / `typecheck` — Turborepo pipelines
- `pnpm db:apply` — re-apply idempotent Postgres init SQL (Node; Windows-safe)
- Python compute: `cd apps/compute && uv sync && uv run pytest`

## Docs

Architecture and scaffold plan live in the Digitli Project Hub Context (`docs/ecommerce-saas-architecture.md`, `docs/monorepo-scaffold-plan.md`).
