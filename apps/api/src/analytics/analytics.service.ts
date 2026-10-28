import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

const ALLOWED_EVENTS = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'custom',
]);

export type AnalyticsEventInput = {
  eventName?: string;
  path?: string | null;
  sessionId?: string | null;
  properties?: Record<string, unknown> | null;
  occurredAt?: string | null;
};

export type AnalyticsEventDto = {
  id: string;
  eventName: string;
  path: string | null;
  sessionId: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
};

export type AnalyticsSummary = {
  totalEvents: number;
  byEventName: Array<{ eventName: string; count: number }>;
  recent: AnalyticsEventDto[];
  stub: true;
};

type EventRow = {
  id: string;
  event_name: string;
  path: string | null;
  session_id: string | null;
  properties: Record<string, unknown> | string;
  occurred_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseProperties(
  value: Record<string, unknown> | string | null | undefined,
): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async ingest(
    tenantId: string,
    input: AnalyticsEventInput,
  ): Promise<AnalyticsEventDto> {
    const eventName = (input.eventName ?? '').trim().toLowerCase();
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      throw new BadRequestException(
        `eventName must be one of: ${[...ALLOWED_EVENTS].join(', ')}`,
      );
    }

    const path =
      typeof input.path === 'string' ? input.path.trim().slice(0, 2048) : null;
    const sessionId =
      typeof input.sessionId === 'string'
        ? input.sessionId.trim().slice(0, 128)
        : null;
    const properties =
      input.properties && typeof input.properties === 'object'
        ? input.properties
        : {};

    let occurredAt: Date | null = null;
    if (input.occurredAt) {
      const parsed = new Date(input.occurredAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('occurredAt must be an ISO timestamp');
      }
      occurredAt = parsed;
    }

    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<EventRow>(
        `INSERT INTO analytics_events (
           tenant_id, event_name, path, session_id, properties, occurred_at
         ) VALUES (
           $1::uuid, $2, $3, $4, $5::jsonb, COALESCE($6::timestamptz, now())
         )
         RETURNING id::text, event_name, path, session_id, properties, occurred_at`,
        [
          tenantId,
          eventName,
          path,
          sessionId,
          JSON.stringify(properties),
          occurredAt?.toISOString() ?? null,
        ],
      );
      return this.toDto(res.rows[0]!);
    });
  }

  async summary(tenantId: string): Promise<AnalyticsSummary> {
    return this.db.withTenant(tenantId, async (client) => {
      const total = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM analytics_events`,
      );
      const byName = await client.query<{ event_name: string; count: string }>(
        `SELECT event_name, count(*)::text AS count
         FROM analytics_events
         GROUP BY event_name
         ORDER BY count(*) DESC, event_name ASC`,
      );
      const recent = await client.query<EventRow>(
        `SELECT id::text, event_name, path, session_id, properties, occurred_at
         FROM analytics_events
         ORDER BY occurred_at DESC
         LIMIT 20`,
      );

      return {
        totalEvents: Number(total.rows[0]?.count ?? 0),
        byEventName: byName.rows.map((row) => ({
          eventName: row.event_name,
          count: Number(row.count),
        })),
        recent: recent.rows.map((row) => this.toDto(row)),
        stub: true,
      };
    });
  }

  private toDto(row: EventRow): AnalyticsEventDto {
    return {
      id: row.id,
      eventName: row.event_name,
      path: row.path,
      sessionId: row.session_id,
      properties: parseProperties(row.properties),
      occurredAt: asIso(row.occurred_at),
    };
  }
}
