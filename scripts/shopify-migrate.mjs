#!/usr/bin/env node
/**
 * CLI for Shopify → platform migration jobs.
 *
 * Examples:
 *   pnpm migrate:shopify -- --tenant demo --source fixture --entities products,customers --run
 *   pnpm migrate:shopify -- --tenant demo --shop mystore.myshopify.com --token shpat_xxx --entities products,customers,orders,redirects --run
 *   pnpm migrate:shopify -- --tenant demo --csv-products ./products.csv --entities products --run
 *   pnpm migrate:shopify -- --list --tenant demo
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);
const PLATFORM_KEY =
  process.env.PLATFORM_API_KEY?.trim() || 'ecom-local-platform-key-change-me';

function usage() {
  console.log(`Usage:
  pnpm migrate:shopify -- --tenant <id|slug> --source shopify_api|csv|fixture [options] [--run]
  pnpm migrate:shopify -- --list [--tenant <id|slug>]
  pnpm migrate:shopify -- --job <id> --run

Options:
  --tenant <id|slug>     Target tenant (required to create)
  --source <name>        shopify_api | csv | fixture (default: shopify_api if --shop, else fixture)
  --shop <domain>        Shopify shop domain
  --token <token>        Shopify Admin API access token
  --entities <list>      Comma list: products,customers,orders,redirects
  --csv-products <path>  Products CSV path
  --csv-customers <path> Customers CSV path
  --fixture <path>       JSON file with { products, customers, orders, redirects }
  --run                  Run the job after create (or run --job)
  --job <id>             Existing job id
  --list                 List jobs
`);
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

async function api(method, path, body) {
  const res = await fetch(`${API_URL}/v1/platform/migration${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Platform-Key': PLATFORM_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error(`error: ${method} ${path} → ${res.status}`, data);
    process.exit(1);
  }
  return data;
}

async function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, '--help') || hasFlag(argv, '-h') || argv.length === 0) {
    usage();
    process.exit(0);
  }

  if (hasFlag(argv, '--list')) {
    const tenantId = argValue(argv, '--tenant');
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const jobs = await api('GET', `/jobs${q}`);
    console.log(JSON.stringify(jobs, null, 2));
    return;
  }

  const jobId = argValue(argv, '--job');
  if (jobId && hasFlag(argv, '--run')) {
    const ran = await api('POST', `/jobs/${jobId}/run`);
    console.log(JSON.stringify(ran, null, 2));
    return;
  }

  const tenantId = argValue(argv, '--tenant');
  if (!tenantId) {
    console.error('error: --tenant is required');
    usage();
    process.exit(1);
  }

  const shop = argValue(argv, '--shop');
  const token = argValue(argv, '--token');
  const entitiesRaw =
    argValue(argv, '--entities') ??
    'products,customers,orders,redirects';
  const entityTypes = entitiesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let source = argValue(argv, '--source');
  const csvProducts = argValue(argv, '--csv-products');
  const csvCustomers = argValue(argv, '--csv-customers');
  const fixturePath = argValue(argv, '--fixture');

  if (!source) {
    if (shop || token) source = 'shopify_api';
    else if (csvProducts || csvCustomers) source = 'csv';
    else source = 'fixture';
  }

  const body = {
    tenantId,
    source,
    entityTypes,
  };

  if (shop) body.shopDomain = shop;
  if (token) body.accessToken = token;

  if (source === 'csv') {
    body.csv = {};
    if (csvProducts) {
      body.csv.products = readFileSync(resolve(csvProducts), 'utf8');
    }
    if (csvCustomers) {
      body.csv.customers = readFileSync(resolve(csvCustomers), 'utf8');
    }
  }

  if (source === 'fixture') {
    if (!fixturePath) {
      console.error('error: --fixture <path> required for source=fixture');
      process.exit(1);
    }
    body.fixture = JSON.parse(readFileSync(resolve(fixturePath), 'utf8'));
  }

  const created = await api('POST', '/jobs', body);
  console.log(JSON.stringify(created, null, 2));

  if (hasFlag(argv, '--run')) {
    const ran = await api('POST', `/jobs/${created.id}/run`);
    console.log(JSON.stringify(ran, null, 2));
    if (ran.status === 'failed') process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
