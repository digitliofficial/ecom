#!/usr/bin/env bash
# Re-apply idempotent Postgres init SQL to an existing local volume.
# Use when Nest logs: function resolve_tenant_id_by_host(...) does not exist
# (volume created before guest-checkout init landed).
#
# Prefer this over wiping data. For a clean local demo reset instead:
#   docker compose down -v && docker compose up -d
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INIT_DIR="$ROOT/infra/docker/postgres/init"
COMPOSE_FILE="$ROOT/docker-compose.yml"

if [[ ! -d "$INIT_DIR" ]]; then
  echo "error: missing init dir $INIT_DIR" >&2
  exit 1
fi

compose() {
  if docker info >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    sudo docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

apply_via_compose() {
  local f
  for f in "$INIT_DIR"/*.sql; do
    echo "→ $(basename "$f")"
    compose exec -T postgres \
      psql -U ecom -d ecom -v ON_ERROR_STOP=1 <"$f"
  done
}

apply_via_psql() {
  local url="${DATABASE_URL_ADMIN:-postgresql://ecom:ecom@localhost:5432/ecom}"
  local f
  if ! command -v psql >/dev/null 2>&1; then
    echo "error: postgres container not running and psql not on PATH" >&2
    echo "start data plane: docker compose up -d" >&2
    exit 1
  fi
  for f in "$INIT_DIR"/*.sql; do
    echo "→ $(basename "$f") (psql)"
    psql "$url" -v ON_ERROR_STOP=1 -f "$f"
  done
}

cd "$ROOT"

if compose ps --status running 2>/dev/null | grep -qE 'ecom-postgres|postgres'; then
  echo "Applying init SQL via docker compose (ecom-postgres)…"
  apply_via_compose
else
  echo "Postgres container not detected; applying via psql…"
  apply_via_psql
fi

echo "OK — schema/seed/RLS/host resolve applied."
echo "Smoke: curl -sS -H 'x-tenant-host: demo.localhost' http://localhost:3001/v1/catalog/products"
