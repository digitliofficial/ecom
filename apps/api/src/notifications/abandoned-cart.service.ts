import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { NotificationsService } from './notifications.service';

type CandidateRow = {
  tenant_id: string;
  cart_id: string;
  email: string;
  locale: string;
  guest_token: string | null;
  idle_minutes: number;
};

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Cancel queued/pending abandon steps when cart changes or converts. */
  async cancelPendingRuns(
    tenantId: string,
    cartId: string,
    client?: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  ): Promise<void> {
    const sql = `UPDATE abandoned_cart_runs
                 SET status = 'cancelled'
                 WHERE cart_id = $1 AND status = 'queued'`;
    if (client) {
      await client.query(sql, [cartId]);
      return;
    }
    await this.db.withTenant(tenantId, async (c) => {
      await c.query(sql, [cartId]);
    });
  }

  /**
   * Claim idle carts with email + lines, enqueue step-1 reminder, write runs.
   * Returns number of reminders queued.
   */
  async processDueCarts(limit = 50): Promise<number> {
    const candidates = await this.db.query<CandidateRow>(
      `SELECT * FROM find_abandoned_cart_candidates($1)`,
      [limit],
    );

    let queued = 0;
    const storefront =
      process.env.STOREFRONT_URL?.replace(/\/$/, '') ??
      'http://localhost:3005';

    for (const row of candidates.rows) {
      try {
        const ok = await this.claimAndEnqueue(row, storefront);
        if (ok) queued += 1;
      } catch (err) {
        this.logger.warn(
          `Abandoned cart ${row.cart_id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return queued;
  }

  private async claimAndEnqueue(
    row: CandidateRow,
    storefrontBase: string,
  ): Promise<boolean> {
    return this.db.withTenant(row.tenant_id, async (client) => {
      const insert = await client.query<{ id: string }>(
        `INSERT INTO abandoned_cart_runs (tenant_id, cart_id, step, status)
         VALUES ($1, $2, 1, 'queued')
         ON CONFLICT (tenant_id, cart_id, step) DO NOTHING
         RETURNING id`,
        [row.tenant_id, row.cart_id],
      );
      const runId = insert.rows[0]?.id;
      if (!runId) return false;

      const resumeUrl = `${storefrontBase}/en/cart?token=${encodeURIComponent(row.guest_token ?? '')}`;
      const unsubscribeUrl = `${storefrontBase}/en/unsubscribe?email=${encodeURIComponent(row.email)}`;

      const outboxId = await this.notifications.enqueueEmail({
        tenantId: row.tenant_id,
        templateId: 'abandoned_cart_step',
        toEmail: row.email,
        locale: row.locale || 'en',
        idempotencyKey: `${row.tenant_id}:${row.cart_id}:1`,
        payload: {
          cartId: row.cart_id,
          resumeUrl,
          unsubscribeUrl,
          step: 1,
        },
        client,
      });

      if (!outboxId) {
        await client.query(
          `UPDATE abandoned_cart_runs SET status = 'failed' WHERE id = $1`,
          [runId],
        );
        return false;
      }

      await client.query(
        `UPDATE abandoned_cart_runs
         SET status = 'sent', outbox_id = $2
         WHERE id = $1`,
        [runId, outboxId],
      );

      // Keep cart status active so guest token resume still works (Arch §8 deep link).
      return true;
    });
  }
}
