#!/usr/bin/env node
/**
 * Re-apply idempotent Postgres init SQL to an existing local volume.
 * Cross-platform (Windows / macOS / Linux) — no bash required.
 *
 * Use when Nest logs: function resolve_tenant_id_by_host(...) does not exist
 * (volume created before guest-checkout init landed).
 *
 * Prefer this over wiping data. For a clean local demo reset instead:
 *   docker compose down -v && docker compose up -d
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INIT_DIR = join(ROOT, "infra", "docker", "postgres", "init");
const COMPOSE_FILE = join(ROOT, "docker-compose.yml");
const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN ??
  "postgresql://ecom:ecom@localhost:5432/ecom";
const IS_WIN = process.platform === "win32";

function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

/** spawnSync that resolves .cmd/.bat on Windows (docker, pnpm, etc.). */
function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: process.env,
    cwd: options.cwd ?? ROOT,
    input: options.input,
    // Windows: shell so PATHEXT (.cmd) resolves; Unix: no shell.
    shell: IS_WIN,
    windowsHide: true,
  });
}

function commandExists(bin) {
  const probe = IS_WIN ? "where" : "which";
  const result = run(probe, [bin]);
  return result.status === 0;
}

function dockerComposeBase() {
  if (!commandExists("docker")) {
    if (commandExists("docker-compose")) {
      return { cmd: "docker-compose", prefix: ["-f", COMPOSE_FILE] };
    }
    return null;
  }
  const version = run("docker", ["compose", "version"]);
  if (version.status === 0) {
    return { cmd: "docker", prefix: ["compose", "-f", COMPOSE_FILE] };
  }
  if (commandExists("docker-compose")) {
    return { cmd: "docker-compose", prefix: ["-f", COMPOSE_FILE] };
  }
  return null;
}

function makeComposeRunner(base, useSudo) {
  return (args, options = {}) => {
    if (useSudo) {
      return run("sudo", [base.cmd, ...base.prefix, ...args], options);
    }
    return run(base.cmd, [...base.prefix, ...args], options);
  };
}

function composeRunner() {
  const base = dockerComposeBase();
  if (!base) return null;

  const infoArgs = base.cmd === "docker" ? ["info"] : ["version"];
  if (run(base.cmd, infoArgs).status === 0) {
    return makeComposeRunner(base, false);
  }

  if (!IS_WIN && commandExists("sudo") && run("sudo", ["docker", "info"]).status === 0) {
    return makeComposeRunner(base, true);
  }

  return makeComposeRunner(base, false);
}

function listSqlFiles() {
  if (!existsSync(INIT_DIR)) {
    fail(`missing init dir ${INIT_DIR}`);
  }
  const files = readdirSync(INIT_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => join(INIT_DIR, name));
  if (files.length === 0) {
    fail(`no .sql files in ${INIT_DIR}`);
  }
  return files;
}

function postgresContainerRunning(compose) {
  const ps = compose(["ps", "--status", "running"]);
  if (ps.error || ps.status !== 0) return false;
  const out = `${ps.stdout ?? ""}\n${ps.stderr ?? ""}`;
  return /ecom-postgres|\bpostgres\b/i.test(out);
}

function applyViaCompose(compose, files) {
  console.log("Applying init SQL via docker compose (ecom-postgres)…");
  for (const file of files) {
    const name = basename(file);
    console.log(`→ ${name}`);
    const sql = readFileSync(file);
    const result = compose(
      [
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "ecom",
        "-d",
        "ecom",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: sql,
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    if (result.error) {
      fail(`docker compose exec failed for ${name}: ${result.error.message}`);
    }
    if (result.status !== 0) {
      fail(`psql via docker compose failed for ${name} (exit ${result.status})`);
    }
  }
}

function applyViaPsql(files) {
  if (!commandExists("psql")) {
    fail(
      "postgres container not running and psql not on PATH\nstart data plane: docker compose up -d",
    );
  }
  console.log("Postgres container not detected; applying via psql…");
  for (const file of files) {
    const name = basename(file);
    console.log(`→ ${name} (psql)`);
    const result = run(
      "psql",
      [ADMIN_URL, "-v", "ON_ERROR_STOP=1", "-f", file],
      { stdio: "inherit" },
    );
    if (result.error) {
      fail(`psql failed for ${name}: ${result.error.message}`);
    }
    if (result.status !== 0) {
      fail(`psql failed for ${name} (exit ${result.status})`);
    }
  }
}

function main() {
  const files = listSqlFiles();
  const compose = composeRunner();

  if (compose && postgresContainerRunning(compose)) {
    applyViaCompose(compose, files);
  } else {
    applyViaPsql(files);
  }

  console.log(
    "OK — schema/seed/RLS/host resolve/catalog admin/auth/payments/shipping/fulfillments/domains+analytics/localization/privacy/cms/notifications/migration/plans metering/wishlist-reviews-b2b applied.",
  );
  console.log(
    "Smoke: curl -sS -H 'x-tenant-host: demo.localhost' http://localhost:3001/v1/catalog/products",
  );
  console.log(
    "Auth: curl -sS -X POST -H 'Host: demo.localhost' -H 'Content-Type: application/json' -d '{\"email\":\"owner@demo.localhost\",\"password\":\"DemoOwner123!\"}' http://localhost:3001/v1/auth/staff/login",
  );
}

main();
