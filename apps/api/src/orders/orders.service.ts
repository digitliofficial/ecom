import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus } from '@ecom/domain-types';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { ComputeClientService } from '../common/compute.client';

export type ShippingAddressDto = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type OrderLineDto = {
  id: string;
  variantId: string;
  title: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
  qtyOrdered: number;
  qtyFulfilled: number;
};

export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string | null;
  guestEmail: string | null;
  customerId: string | null;
  totalAmountMinor: number;
  shippingAmountMinor: number;
  chargeCurrency: string;
  shippingMethodName: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
};

export type OrderDetailDto = OrderSummaryDto & {
  cartId: string | null;
  checkoutSessionId: string | null;
  shippingAddress: ShippingAddressDto | null;
  shippingMethodId: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  lines: OrderLineDto[];
};

export type OrderStatusUpdate = 'fulfilled' | 'shipped' | 'cancelled';

export type OrderStatusUpdateInput = {
  status: OrderStatusUpdate;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
};

const TERMINAL: ReadonlySet<OrderStatus> = new Set([
  'fulfilled',
  'shipped',
  'cancelled',
]);

const ALLOWED_FROM: ReadonlySet<OrderStatus> = new Set(['pending', 'placed']);

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  guest_email: string | null;
  customer_id: string | null;
  cart_id: string | null;
  checkout_session_id: string | null;
  shipping_address: ShippingAddressDto | null;
  total_amount_minor: string | number;
  shipping_amount_minor: string | number;
  charge_currency: string;
  shipping_method_id: string | null;
  shipping_method_name: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  line_count?: string | number;
};

type LineRow = {
  id: string;
  variant_id: string;
  title: string;
  quantity: number;
  unit_amount_minor: string | number;
  currency: string;
  qty_ordered: number;
  qty_fulfilled: number;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return asIso(value);
}

function asMinor(value: string | number): number {
  return typeof value === 'string' ? Number(value) : value;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly compute: ComputeClientService,
  ) {}

  async listAdminOrders(tenantId: string): Promise<OrderSummaryDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<OrderRow>(
        `SELECT o.id, o.status, o.payment_status, o.payment_method, o.guest_email, o.customer_id,
                o.cart_id, o.checkout_session_id, o.shipping_address,
                o.total_amount_minor, o.shipping_amount_minor, o.charge_currency,
                o.shipping_method_id, o.shipping_method_name,
                o.tracking_number, o.tracking_carrier, o.shipped_at,
                o.created_at, o.updated_at,
                COALESCE(COUNT(ol.id), 0) AS line_count
         FROM orders o
         LEFT JOIN order_lines ol ON ol.order_id = o.id
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
      );
      return res.rows.map((row) => this.toSummary(row));
    });
  }

  async getAdminOrder(tenantId: string, id: string): Promise<OrderDetailDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const order = await this.loadOrder(client, id);
      if (!order) throw new NotFoundException('Order not found');
      const lines = await this.loadLines(client, id);
      return this.toDetail(order, lines);
    });
  }

  async updateAdminOrderStatus(
    tenantId: string,
    id: string,
    input: OrderStatusUpdateInput,
  ): Promise<OrderDetailDto> {
    const status = input.status;
    if (!['fulfilled', 'shipped', 'cancelled'].includes(status)) {
      throw new BadRequestException(
        'status must be fulfilled, shipped, or cancelled',
      );
    }

    const trackingNumber = trimOrNull(input.trackingNumber);
    const trackingCarrier = trimOrNull(input.trackingCarrier);

    return this.db.withTenant(tenantId, async (client) => {
      const existing = await this.loadOrder(client, id);
      if (!existing) throw new NotFoundException('Order not found');

      const current = existing.status as OrderStatus;
      if (TERMINAL.has(current)) {
        throw new BadRequestException(
          `Order is already ${current}; status cannot change`,
        );
      }
      if (!ALLOWED_FROM.has(current)) {
        throw new BadRequestException(
          `Cannot transition order from ${current} to ${status}`,
        );
      }

      const setShippedAt = status === 'shipped' || status === 'fulfilled';
      const nextTracking =
        trackingNumber ?? existing.tracking_number ?? null;
      const nextCarrier =
        trackingCarrier ?? existing.tracking_carrier ?? null;

      // Manual fulfill: optional merchant-entered tracking. Aggregator stub can mint one.
      let mintedTracking = nextTracking;
      let mintedCarrier = nextCarrier;
      if (
        setShippedAt &&
        !mintedTracking &&
        existing.shipping_method_id
      ) {
        const method = await client.query<{ adapter: string; name: string }>(
          `SELECT adapter, name FROM shipping_methods WHERE id = $1`,
          [existing.shipping_method_id],
        );
        const adapter = method.rows[0]?.adapter ?? 'manual';
        if (adapter === 'aggregator_stub') {
          try {
            const label = await this.compute.createShipment({
              rateId: `aggregator_stub:standard`,
              orderId: id,
              adapter,
              to: existing.shipping_address ?? {
                line1: 'unknown',
                city: 'unknown',
                country: 'PK',
              },
            });
            mintedTracking = label.trackingNumber;
            mintedCarrier = label.carrier ?? adapter;
          } catch {
            // Fail-open: merchant can still set tracking manually
          }
        }
      }

      await client.query(
        `UPDATE orders
         SET status = $1,
             tracking_number = COALESCE($2, tracking_number),
             tracking_carrier = COALESCE($3, tracking_carrier),
             shipped_at = CASE WHEN $4 THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
             updated_at = now()
         WHERE id = $5`,
        [
          status,
          mintedTracking,
          mintedCarrier,
          setShippedAt,
          id,
        ],
      );

      if (status === 'fulfilled' || status === 'shipped') {
        await client.query(
          `UPDATE order_lines
           SET qty_fulfilled = qty_ordered
           WHERE order_id = $1`,
          [id],
        );

        const shipment = await client.query<{ id: string }>(
          `INSERT INTO shipments
             (tenant_id, order_id, shipping_method_id, status,
              tracking_number, tracking_carrier, adapter, shipped_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN now() ELSE NULL END)
           RETURNING id`,
          [
            tenantId,
            id,
            existing.shipping_method_id,
            status === 'shipped' ? 'in_transit' : 'labeled',
            mintedTracking,
            mintedCarrier,
            mintedCarrier === 'aggregator_stub' ? 'aggregator_stub' : 'manual',
            setShippedAt,
          ],
        );

        if (mintedTracking) {
          await client.query(
            `INSERT INTO tracking_events
               (tenant_id, shipment_id, status, description)
             VALUES ($1, $2, $3, $4)`,
            [
              tenantId,
              shipment.rows[0]!.id,
              status === 'shipped' ? 'in_transit' : 'label_created',
              `Order ${status}; tracking ${mintedTracking}`,
            ],
          );
        }
      }

      const order = await this.loadOrder(client, id);
      if (!order) throw new NotFoundException('Order not found');
      const lines = await this.loadLines(client, id);
      return this.toDetail(order, lines);
    });
  }

  private async loadOrder(
    client: PoolClient,
    id: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT id, status, payment_status, payment_method, guest_email, customer_id,
              cart_id, checkout_session_id, shipping_address,
              total_amount_minor, shipping_amount_minor, charge_currency,
              shipping_method_id, shipping_method_name,
              tracking_number, tracking_carrier, shipped_at,
              created_at, updated_at
       FROM orders
       WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  private async loadLines(
    client: PoolClient,
    orderId: string,
  ): Promise<OrderLineDto[]> {
    const res = await client.query<LineRow>(
      `SELECT id, variant_id, title, quantity, unit_amount_minor, currency,
              qty_ordered, qty_fulfilled
       FROM order_lines
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );
    return res.rows.map((row) => ({
      id: row.id,
      variantId: row.variant_id,
      title: row.title,
      quantity: row.quantity,
      unitAmountMinor: asMinor(row.unit_amount_minor),
      currency: row.currency,
      qtyOrdered: row.qty_ordered,
      qtyFulfilled: row.qty_fulfilled,
    }));
  }

  private toSummary(row: OrderRow): OrderSummaryDto {
    return {
      id: row.id,
      status: row.status as OrderStatus,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      guestEmail: row.guest_email,
      customerId: row.customer_id,
      totalAmountMinor: asMinor(row.total_amount_minor),
      shippingAmountMinor: asMinor(row.shipping_amount_minor ?? 0),
      chargeCurrency: row.charge_currency,
      shippingMethodName: row.shipping_method_name,
      trackingNumber: row.tracking_number,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
      lineCount: asMinor(row.line_count ?? 0),
    };
  }

  private toDetail(order: OrderRow, lines: OrderLineDto[]): OrderDetailDto {
    return {
      ...this.toSummary({ ...order, line_count: lines.length }),
      cartId: order.cart_id,
      checkoutSessionId: order.checkout_session_id,
      shippingAddress: order.shipping_address,
      shippingMethodId: order.shipping_method_id,
      trackingCarrier: order.tracking_carrier,
      shippedAt: asIsoOrNull(order.shipped_at),
      lines,
    };
  }
}
