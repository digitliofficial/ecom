import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow, type DatabaseError } from 'pg';

function isUndefinedFunction(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as DatabaseError).code === '42883'
  );
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgresql://ecom_app:ecom@localhost:5432/ecom';
    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Run work inside a transaction with SET LOCAL app.tenant_id (RLS). */
  async withTenant<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [
        tenantId,
      ]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** Bypass-aware query (no tenant GUC). Prefer withTenant for business tables. */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) {
    return this.pool.query<T>(text, params);
  }

  async resolveTenantIdByHost(host: string): Promise<string | null> {
    const normalized = host.split(':')[0]?.toLowerCase() ?? '';
    try {
      const res = await this.pool.query<{ id: string }>(
        `SELECT resolve_tenant_id_by_host($1)::text AS id`,
        [normalized],
      );
      return res.rows[0]?.id ?? null;
    } catch (err) {
      if (isUndefinedFunction(err)) {
        throw new ServiceUnavailableException(
          'Database schema is outdated (missing resolve_tenant_id_by_host). Run `pnpm db:apply`, or reset local demo data with `docker compose down -v && docker compose up -d`.',
        );
      }
      throw err;
    }
  }
}
