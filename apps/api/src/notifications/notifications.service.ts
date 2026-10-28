import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  createEmailProvider,
  type EmailProvider,
} from '@ecom/email-providers';
import {
  renderTemplate,
  type EmailTemplateId,
} from '@ecom/email-templates';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type TenantNotificationSettings = {
  orderPlacedCustomer: boolean;
  orderPlacedMerchant: boolean;
  orderShippedCustomer: boolean;
  orderCancelledCustomer: boolean;
  abandonedCartEnabled: boolean;
  abandonedCartIdleMinutes: number;
  merchantAlertEmail: string | null;
  updatedAt: string;
};

export type NotificationSettingsUpdate = {
  orderPlacedCustomer?: boolean;
  orderPlacedMerchant?: boolean;
  orderShippedCustomer?: boolean;
  orderCancelledCustomer?: boolean;
  abandonedCartEnabled?: boolean;
  abandonedCartIdleMinutes?: number;
  merchantAlertEmail?: string | null;
};

export type EnqueueEmailInput = {
  tenantId: string;
  templateId: EmailTemplateId;
  toEmail: string;
  locale?: string;
  payload: Record<string, string | number | null | undefined>;
  idempotencyKey: string;
  client?: PoolClient;
};

type SettingsRow = {
  tenant_id: string;
  order_placed_customer: boolean;
  order_placed_merchant: boolean;
  order_shipped_customer: boolean;
  order_cancelled_customer: boolean;
  abandoned_cart_enabled: boolean;
  abandoned_cart_idle_minutes: number;
  merchant_alert_email: string | null;
  updated_at: Date | string;
};

type OutboxRow = {
  id: string;
  tenant_id: string;
  channel: string;
  template_id: string;
  to_email: string;
  locale: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: string;
  attempts: number;
  last_error: string | null;
  scheduled_at: Date | string;
  processed_at: Date | string | null;
  created_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly email: EmailProvider;

  constructor(private readonly db: DatabaseService) {
    this.email = createEmailProvider(process.env);
    this.logger.log(`EmailProvider=${this.email.name}`);
  }

  async getSettings(tenantId: string): Promise<TenantNotificationSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadOrCreate(client, tenantId);
      return this.toDto(row);
    });
  }

  async updateSettings(
    tenantId: string,
    input: NotificationSettingsUpdate,
  ): Promise<TenantNotificationSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const current = await this.loadOrCreate(client, tenantId);

      let idle = current.abandoned_cart_idle_minutes;
      if (input.abandonedCartIdleMinutes !== undefined) {
        const n = Number(input.abandonedCartIdleMinutes);
        if (!Number.isInteger(n) || n < 0 || n > 10080) {
          throw new BadRequestException(
            'abandonedCartIdleMinutes must be an integer 0–10080',
          );
        }
        idle = n;
      }

      const res = await client.query<SettingsRow>(
        `UPDATE tenant_notification_settings
         SET order_placed_customer = $2,
             order_placed_merchant = $3,
             order_shipped_customer = $4,
             order_cancelled_customer = $5,
             abandoned_cart_enabled = $6,
             abandoned_cart_idle_minutes = $7,
             merchant_alert_email = $8,
             updated_at = now()
         WHERE tenant_id = $1
         RETURNING *`,
        [
          tenantId,
          input.orderPlacedCustomer !== undefined
            ? Boolean(input.orderPlacedCustomer)
            : current.order_placed_customer,
          input.orderPlacedMerchant !== undefined
            ? Boolean(input.orderPlacedMerchant)
            : current.order_placed_merchant,
          input.orderShippedCustomer !== undefined
            ? Boolean(input.orderShippedCustomer)
            : current.order_shipped_customer,
          input.orderCancelledCustomer !== undefined
            ? Boolean(input.orderCancelledCustomer)
            : current.order_cancelled_customer,
          input.abandonedCartEnabled !== undefined
            ? Boolean(input.abandonedCartEnabled)
            : current.abandoned_cart_enabled,
          idle,
          input.merchantAlertEmail !== undefined
            ? trimOrNull(input.merchantAlertEmail)
            : current.merchant_alert_email,
        ],
      );

      const row = res.rows[0];
      if (!row) throw new NotFoundException('Notification settings not found');
      return this.toDto(row);
    });
  }

  /** Idempotent enqueue; returns outbox id (existing or new). */
  async enqueueEmail(input: EnqueueEmailInput): Promise<string | null> {
    const to = input.toEmail?.trim();
    if (!to?.includes('@')) return null;

    const locale = input.locale?.trim() || 'en';
    const run = async (client: PoolClient) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO notification_outbox
           (tenant_id, channel, template_id, to_email, locale, payload, idempotency_key)
         VALUES ($1, 'email', $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
           SET payload = EXCLUDED.payload
         RETURNING id`,
        [
          input.tenantId,
          input.templateId,
          to,
          locale,
          JSON.stringify(input.payload ?? {}),
          input.idempotencyKey,
        ],
      );
      return res.rows[0]?.id ?? null;
    };

    if (input.client) return run(input.client);
    return this.db.withTenant(input.tenantId, run);
  }

  async resolveMerchantAlertEmail(
    tenantId: string,
    client?: PoolClient,
  ): Promise<string | null> {
    const run = async (c: PoolClient) => {
      const settings = await this.loadOrCreate(c, tenantId);
      if (settings.merchant_alert_email?.includes('@')) {
        return settings.merchant_alert_email;
      }
      const owner = await c.query<{ email: string }>(
        `SELECT u.email
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.tenant_id = $1 AND m.role = 'owner'
         ORDER BY m.created_at ASC
         LIMIT 1`,
        [tenantId],
      );
      return owner.rows[0]?.email ?? null;
    };
    if (client) return run(client);
    return this.db.withTenant(tenantId, run);
  }

  async notifyOrderPlaced(input: {
    tenantId: string;
    orderId: string;
    customerEmail: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmountMinor: number;
    currency: string;
    locale?: string;
    client?: PoolClient;
  }): Promise<void> {
    const settings = input.client
      ? this.toDto(await this.loadOrCreate(input.client, input.tenantId))
      : await this.getSettings(input.tenantId);

    const locale = input.locale ?? 'en';
    const total = (input.totalAmountMinor / 100).toFixed(2);

    if (settings.orderPlacedCustomer) {
      await this.enqueueEmail({
        tenantId: input.tenantId,
        templateId: 'order_placed',
        toEmail: input.customerEmail,
        locale,
        idempotencyKey: `order:${input.orderId}:placed:customer`,
        payload: {
          orderId: input.orderId,
          total,
          currency: input.currency,
          customerEmail: input.customerEmail,
        },
        client: input.client,
      });
    }

    if (settings.orderPlacedMerchant) {
      const merchantTo =
        (input.client
          ? await this.resolveMerchantAlertEmail(input.tenantId, input.client)
          : await this.resolveMerchantAlertEmail(input.tenantId)) ??
        settings.merchantAlertEmail;
      if (merchantTo) {
        await this.enqueueEmail({
          tenantId: input.tenantId,
          templateId: 'order_placed_merchant',
          toEmail: merchantTo,
          locale,
          idempotencyKey: `order:${input.orderId}:placed:merchant`,
          payload: {
            orderId: input.orderId,
            total,
            currency: input.currency,
            customerEmail: input.customerEmail,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentStatus,
          },
          client: input.client,
        });
      }
    }
  }

  async notifyOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status: 'fulfilled' | 'shipped' | 'cancelled';
    customerEmail: string | null;
    totalAmountMinor: number;
    currency: string;
    locale?: string;
  }): Promise<void> {
    if (!input.customerEmail?.includes('@')) return;
    const settings = await this.getSettings(input.tenantId);
    const locale = input.locale ?? 'en';
    const total = (input.totalAmountMinor / 100).toFixed(2);

    if (input.status === 'cancelled') {
      if (!settings.orderCancelledCustomer) return;
      await this.enqueueEmail({
        tenantId: input.tenantId,
        templateId: 'order_cancelled',
        toEmail: input.customerEmail,
        locale,
        idempotencyKey: `order:${input.orderId}:cancelled:customer`,
        payload: {
          orderId: input.orderId,
          total,
          currency: input.currency,
        },
      });
      return;
    }

    if (!settings.orderShippedCustomer) return;
    await this.enqueueEmail({
      tenantId: input.tenantId,
      templateId: 'order_shipped',
      toEmail: input.customerEmail,
      locale,
      idempotencyKey: `order:${input.orderId}:${input.status}:customer`,
      payload: {
        orderId: input.orderId,
        total,
        currency: input.currency,
        statusLabel: input.status === 'shipped' ? 'shipped' : 'fulfilled',
      },
    });
  }

  /** Drain pending outbox rows (cross-tenant via SECURITY DEFINER). */
  async processOutbox(batchSize = 20): Promise<number> {
    const claimed = await this.db.query<OutboxRow>(
      `SELECT * FROM claim_pending_notification_outbox($1)`,
      [batchSize],
    );
    let sent = 0;
    for (const row of claimed.rows) {
      const ok = await this.deliverOutboxRow(row);
      if (ok) sent += 1;
    }
    return sent;
  }

  private async deliverOutboxRow(row: OutboxRow): Promise<boolean> {
    const templateId = row.template_id as EmailTemplateId;
    const payload = (row.payload ?? {}) as Record<
      string,
      string | number | null | undefined
    >;
    const rendered = renderTemplate(templateId, row.locale, payload);

    const result = await this.email.send({
      to: row.to_email,
      subject: rendered.subject,
      text: rendered.bodyText,
      tags: {
        template: templateId,
        tenant: row.tenant_id,
        outbox: row.id,
      },
    });

    try {
      await this.db.withTenant(row.tenant_id, async (client) => {
        if (result.status === 'sent') {
          await client.query(
            `UPDATE notification_outbox
             SET status = 'sent', processed_at = now(), last_error = NULL
             WHERE id = $1`,
            [row.id],
          );
          await client.query(
            `INSERT INTO email_deliveries
               (tenant_id, outbox_id, provider, provider_message_id, status)
             VALUES ($1, $2, $3, $4, 'sent')`,
            [row.tenant_id, row.id, result.provider, result.id],
          );
        } else {
          await client.query(
            `UPDATE notification_outbox
             SET status = 'failed',
                 last_error = $2,
                 processed_at = now()
             WHERE id = $1`,
            [row.id, result.error ?? 'send failed'],
          );
        }
      });
    } catch (err) {
      this.logger.error(
        `Failed to finalize outbox ${row.id}: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
    return result.status === 'sent';
  }

  private async loadOrCreate(
    client: {
      query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    },
    tenantId: string,
  ): Promise<SettingsRow> {
    const existing = await client.query<SettingsRow>(
      `SELECT * FROM tenant_notification_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<SettingsRow>(
      `INSERT INTO tenant_notification_settings (tenant_id)
       VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE
         SET updated_at = tenant_notification_settings.updated_at
       RETURNING *`,
      [tenantId],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create notification settings');
    return row;
  }

  private toDto(row: SettingsRow): TenantNotificationSettings {
    return {
      orderPlacedCustomer: row.order_placed_customer,
      orderPlacedMerchant: row.order_placed_merchant,
      orderShippedCustomer: row.order_shipped_customer,
      orderCancelledCustomer: row.order_cancelled_customer,
      abandonedCartEnabled: row.abandoned_cart_enabled,
      abandonedCartIdleMinutes: row.abandoned_cart_idle_minutes,
      merchantAlertEmail: row.merchant_alert_email,
      updatedAt: asIso(row.updated_at),
    };
  }
}
