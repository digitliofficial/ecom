import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus } from '@ecom/domain-types';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

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
  guestEmail: string | null;
  customerId: string | null;
  totalAmountMinor: number;
  chargeCurrency: string;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
};

export type OrderDetailDto = OrderSummaryDto & {
  cartId: string | null;
  checkoutSessionId: string | null;
  shippingAddress: ShippingAddressDto | null;
  lines: OrderLineDto[];
};

export type OrderStatusUpdate = 'fulfilled' | 'shipped' | 'cancelled';

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
  guest_email: string | null;
  customer_id: string | null;
  cart_id: string | null;
  checkout_session_id: string | null;
  shipping_address: ShippingAddressDto | null;
  total_amount_minor: string | number;
  charge_currency: string;
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

function asMinor(value: string | number): number {
  return typeof value === 'string' ? Number(value) : value;
}

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  async listAdminOrders(tenantId: string): Promise<OrderSummaryDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<OrderRow>(
        `SELECT o.id, o.status, o.payment_status, o.guest_email, o.customer_id,
                o.cart_id, o.checkout_session_id, o.shipping_address,
                o.total_amount_minor, o.charge_currency, o.created_at, o.updated_at,
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
      return {
        ...this.toSummary({ ...order, line_count: lines.length }),
        cartId: order.cart_id,
        checkoutSessionId: order.checkout_session_id,
        shippingAddress: order.shipping_address,
        lines,
      };
    });
  }

  async updateAdminOrderStatus(
    tenantId: string,
    id: string,
    status: OrderStatusUpdate,
  ): Promise<OrderDetailDto> {
    if (!['fulfilled', 'shipped', 'cancelled'].includes(status)) {
      throw new BadRequestException(
        'status must be fulfilled, shipped, or cancelled',
      );
    }

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

      await client.query(
        `UPDATE orders
         SET status = $1, updated_at = now()
         WHERE id = $2`,
        [status, id],
      );

      if (status === 'fulfilled' || status === 'shipped') {
        await client.query(
          `UPDATE order_lines
           SET qty_fulfilled = qty_ordered
           WHERE order_id = $1`,
          [id],
        );
      }

      const order = await this.loadOrder(client, id);
      if (!order) throw new NotFoundException('Order not found');
      const lines = await this.loadLines(client, id);
      return {
        ...this.toSummary({ ...order, line_count: lines.length }),
        cartId: order.cart_id,
        checkoutSessionId: order.checkout_session_id,
        shippingAddress: order.shipping_address,
        lines,
      };
    });
  }

  private async loadOrder(
    client: PoolClient,
    id: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT id, status, payment_status, guest_email, customer_id,
              cart_id, checkout_session_id, shipping_address,
              total_amount_minor, charge_currency, created_at, updated_at
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
      guestEmail: row.guest_email,
      customerId: row.customer_id,
      totalAmountMinor: asMinor(row.total_amount_minor),
      chargeCurrency: row.charge_currency,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
      lineCount: asMinor(row.line_count ?? 0),
    };
  }
}
