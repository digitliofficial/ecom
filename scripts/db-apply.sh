#!/usr/bin/env bash
# Thin wrapper — prefer `pnpm db:apply` (node scripts/db-apply.mjs) on all platforms.
# Kept for muscle memory / docs that mention the shell path.
# Note: this file is LF-only (.gitattributes). On Windows use `pnpm db:apply`.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/db-apply.mjs" "$@"
