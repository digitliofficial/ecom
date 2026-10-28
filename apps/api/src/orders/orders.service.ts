import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus } from '@ecom/domain-types';
import type { PoolClient } from 'pg';
import { ComputeClientService } from '../common/compute.client';
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
  qtyRefunded: number;
};

export type FulfillmentLineDto = {
  id: string;
  orderLineId: string;
  qty: number;
  title: string;
};

export type FulfillmentStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type FulfillmentDto = {
  id: string;
  status: FulfillmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: FulfillmentLineDto[];
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
  fulfillments: FulfillmentDto[];
};

export type OrderStatusUpdate = 'fulfilled' | 'shipped' | 'cancelled';

export type OrderStatusUpdateInput = {
  status: OrderStatusUpdate;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
};

export type CreateFulfillmentLineInput = {
  orderLineId: string;
  qty: number;
};

export type CreateFulfillmentInput = {
  lines: CreateFulfillmentLineInput[];
  trackingNumber?: string | null;
  carrier?: string | null;
  /** When true (default if tracking provided), mark fulfillment shipped. */
  markShipped?: boolean;
};

export type UpdateFulfillmentInput = {
  trackingNumber?: string | null;
  carrier?: string | null;
  status?: FulfillmentStatus;
};

const CANCEL_FROM: ReadonlySet<OrderStatus> = new Set([
  'pending',
  'placed',
  'partially_fulfilled',
]);

const FULFILL_FROM: ReadonlySet<OrderStatus> = new Set([
  'pending',
  'placed',
  'partially_fulfilled',
]);

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
  qty_refunded: number;
};

type FulfillmentRow = {
  id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type FulfillmentLineRow = {
  id: string;
  fulfillment_id: string;
  order_line_id: string;
  qty: number;
  title: string;
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
      return this.loadDetail(client, id);
    });
  }

  async createAdminFulfillment(
    tenantId: string,
    orderId: string,
    input: CreateFulfillmentInput,
  ): Promise<OrderDetailDto> {
    const lines = this.normalizeFulfillmentLines(input.lines);

    return this.db.withTenant(tenantId, async (client) => {
      const existing = await this.loadOrder(client, orderId);
      if (!existing) throw new NotFoundException('Order not found');

      const current = existing.status as OrderStatus;
      if (!FULFILL_FROM.has(current)) {
        throw new BadRequestException(
          `Cannot create fulfillment while order is ${current}`,
        );
      }

      await this.assertRemainingQty(client, orderId, lines);

      const markShipped =
        input.markShipped === true ||
        (input.markShipped !== false && Boolean(trimOrNull(input.trackingNumber)));

      let tracking = trimOrNull(input.trackingNumber);
      let carrier = trimOrNull(input.carrier);

      if (markShipped && !tracking) {
        const minted = await this.maybeMintTracking(client, tenantId, existing);
        tracking = minted.tracking ?? tracking;
        carrier = minted.carrier ?? carrier;
      }

      await this.createFulfillmentInTx(client, orderId, {
        lines,
        trackingNumber: tracking,
        carrier,
        markShipped,
      });

      await this.writeCourierShipment(
        client,
        tenantId,
        existing,
        {
          tracking,
          carrier,
          shipped: markShipped,
          statusLabel: markShipped ? 'shipped' : 'fulfilled',
        },
      );

      await this.syncOrderTrackingSnapshot(client, orderId, {
        tracking,
        carrier,
        setShippedAt: markShipped,
      });

      await this.rollupOrderStatus(client, orderId);
      return this.loadDetail(client, orderId);
    });
  }

  async updateAdminFulfillment(
    tenantId: string,
    orderId: string,
    fulfillmentId: string,
    input: UpdateFulfillmentInput,
  ): Promise<OrderDetailDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await this.loadOrder(client, orderId);
      if (!existing) throw new NotFoundException('Order not found');

      const fulfillment = await this.loadFulfillmentHeader(
        client,
        orderId,
        fulfillmentId,
      );
      if (!fulfillment) throw new NotFoundException('Fulfillment not found');

      if (fulfillment.status === 'cancelled') {
        throw new BadRequestException('Cancelled fulfillment cannot change');
      }

      if (
        input.status &&
        !['pending', 'shipped', 'delivered', 'cancelled'].includes(input.status)
      ) {
        throw new BadRequestException(
          'status must be pending, shipped, delivered, or cancelled',
        );
      }

      const nextStatus =
        input.status ?? (fulfillment.status as FulfillmentStatus);
      const tracking =
        input.trackingNumber !== undefined
          ? trimOrNull(input.trackingNumber)
          : fulfillment.tracking_number;
      const carrier =
        input.carrier !== undefined
          ? trimOrNull(input.carrier)
          : fulfillment.carrier;

      let shippedAt = fulfillment.shipped_at;
      if (nextStatus === 'shipped' || nextStatus === 'delivered') {
        shippedAt = shippedAt ?? new Date();
      } else if (nextStatus === 'pending') {
        shippedAt = null;
      }

      await client.query(
        `UPDATE fulfillments
         SET status = $1,
             tracking_number = $2,
             carrier = $3,
             shipped_at = $4,
             updated_at = now()
         WHERE id = $5`,
        [
          nextStatus,
          tracking,
          carrier,
          shippedAt instanceof Date
            ? shippedAt
            : shippedAt
              ? new Date(shippedAt)
              : null,
          fulfillmentId,
        ],
      );

      if (nextStatus === 'shipped' || nextStatus === 'delivered') {
        await this.writeCourierShipment(client, tenantId, existing, {
          tracking,
          carrier,
          shipped: true,
          statusLabel: nextStatus === 'delivered' ? 'delivered' : 'shipped',
        });
        await this.syncOrderTrackingSnapshot(client, orderId, {
          tracking,
          carrier,
          setShippedAt: true,
        });
      } else if (tracking || carrier) {
        await this.syncOrderTrackingSnapshot(client, orderId, {
          tracking,
          carrier,
          setShippedAt: false,
        });
      }

      return this.loadDetail(client, orderId);
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

      if (status === 'cancelled') {
        if (current === 'cancelled') {
          throw new BadRequestException(
            'Order is already cancelled; status cannot change',
          );
        }
        if (current === 'fulfilled' || current === 'shipped') {
          throw new BadRequestException(
            `Order is already ${current}; status cannot change`,
          );
        }
        if (!CANCEL_FROM.has(current)) {
          throw new BadRequestException(
            `Cannot transition order from ${current} to cancelled`,
          );
        }
        await client.query(
          `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`,
          [id],
        );
        return this.loadDetail(client, id);
      }

      if (!FULFILL_FROM.has(current)) {
        throw new BadRequestException(
          `Cannot transition order from ${current} to ${status}`,
        );
      }

      const remaining = await this.remainingFulfillmentLines(client, id);
      if (remaining.length === 0) {
        throw new BadRequestException('Order has nothing left to fulfill');
      }

      let tracking =
        trackingNumber ?? existing.tracking_number ?? null;
      let carrier =
        trackingCarrier ?? existing.tracking_carrier ?? null;

      if (status === 'shipped' || status === 'fulfilled') {
        const minted = await this.maybeMintTracking(client, tenantId, existing);
        if (!tracking && minted.tracking) tracking = minted.tracking;
        if (!carrier && minted.carrier) carrier = minted.carrier;
      }

      await this.createFulfillmentInTx(client, id, {
        lines: remaining,
        trackingNumber: tracking,
        carrier,
        markShipped: status === 'shipped',
      });

      await this.writeCourierShipment(client, tenantId, existing, {
        tracking,
        carrier,
        shipped: status === 'shipped' || status === 'fulfilled',
        statusLabel: status,
      });

      await this.syncOrderTrackingSnapshot(client, id, {
        tracking,
        carrier,
        setShippedAt: status === 'shipped' || status === 'fulfilled',
      });

      if (status === 'shipped') {
        // Preserve legacy order-level "shipped" when staff uses Mark shipped shortcut.
        await client.query(
          `UPDATE orders SET status = 'shipped', updated_at = now() WHERE id = $1`,
          [id],
        );
      } else {
        await this.rollupOrderStatus(client, id);
      }

      return this.loadDetail(client, id);
    });
  }

  private normalizeFulfillmentLines(
    lines: CreateFulfillmentLineInput[] | undefined,
  ): CreateFulfillmentLineInput[] {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('lines must be a non-empty array');
    }

    const merged = new Map<string, number>();
    for (const line of lines) {
      if (!line?.orderLineId || typeof line.orderLineId !== 'string') {
        throw new BadRequestException('each line requires orderLineId');
      }
      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new BadRequestException('each line qty must be a positive integer');
      }
      merged.set(line.orderLineId, (merged.get(line.orderLineId) ?? 0) + qty);
    }

    return [...merged.entries()].map(([orderLineId, qty]) => ({
      orderLineId,
      qty,
    }));
  }

  private async assertRemainingQty(
    client: PoolClient,
    orderId: string,
    lines: CreateFulfillmentLineInput[],
  ): Promise<void> {
    const orderLines = await this.loadLineRows(client, orderId);
    const byId = new Map(orderLines.map((l) => [l.id, l]));

    for (const line of lines) {
      const row = byId.get(line.orderLineId);
      if (!row) {
        throw new BadRequestException(
          `Order line ${line.orderLineId} not found on this order`,
        );
      }
      const remaining =
        row.qty_ordered - row.qty_fulfilled - (row.qty_refunded ?? 0);
      if (line.qty > remaining) {
        throw new BadRequestException(
          `Cannot fulfill ${line.qty} of "${row.title}"; only ${remaining} remaining`,
        );
      }
    }
  }

  private async createFulfillmentInTx(
    client: PoolClient,
    orderId: string,
    input: CreateFulfillmentInput,
  ): Promise<string> {
    const lines = this.normalizeFulfillmentLines(input.lines);
    const markShipped =
      input.markShipped === true ||
      (input.markShipped !== false && Boolean(trimOrNull(input.trackingNumber)));
    const status: FulfillmentStatus = markShipped ? 'shipped' : 'pending';
    const tracking = trimOrNull(input.trackingNumber);
    const carrier = trimOrNull(input.carrier);

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO fulfillments (
         tenant_id, order_id, status, tracking_number, carrier, shipped_at
       ) VALUES (
         current_setting('app.tenant_id', true)::uuid,
         $1, $2, $3, $4,
         CASE WHEN $2 = 'shipped' THEN now() ELSE NULL END
       )
       RETURNING id`,
      [orderId, status, tracking, carrier],
    );
    const fulfillmentId = inserted.rows[0]!.id;

    for (const line of lines) {
      await client.query(
        `INSERT INTO fulfillment_lines (
           tenant_id, fulfillment_id, order_line_id, qty
         ) VALUES (
           current_setting('app.tenant_id', true)::uuid, $1, $2, $3
         )`,
        [fulfillmentId, line.orderLineId, line.qty],
      );
      await client.query(
        `UPDATE order_lines
         SET qty_fulfilled = qty_fulfilled + $1
         WHERE id = $2`,
        [line.qty, line.orderLineId],
      );
    }

    return fulfillmentId;
  }

  private async maybeMintTracking(
    client: PoolClient,
    _tenantId: string,
    order: OrderRow,
  ): Promise<{ tracking: string | null; carrier: string | null }> {
    if (!order.shipping_method_id) {
      return { tracking: null, carrier: null };
    }
    const method = await client.query<{ adapter: string; name: string }>(
      `SELECT adapter, name FROM shipping_methods WHERE id = $1`,
      [order.shipping_method_id],
    );
    const adapter = method.rows[0]?.adapter ?? 'manual';
    if (adapter !== 'aggregator_stub') {
      return { tracking: null, carrier: null };
    }
    try {
      const label = await this.compute.createShipment({
        rateId: `aggregator_stub:standard`,
        orderId: order.id,
        adapter,
        to: order.shipping_address ?? {
          line1: 'unknown',
          city: 'unknown',
          country: 'PK',
        },
      });
      return {
        tracking: label.trackingNumber,
        carrier: label.carrier ?? adapter,
      };
    } catch {
      return { tracking: null, carrier: null };
    }
  }

  private async writeCourierShipment(
    client: PoolClient,
    tenantId: string,
    order: OrderRow,
    opts: {
      tracking: string | null;
      carrier: string | null;
      shipped: boolean;
      statusLabel: string;
    },
  ): Promise<void> {
    const shipmentStatus =
      opts.statusLabel === 'shipped' || opts.statusLabel === 'delivered'
        ? 'in_transit'
        : 'labeled';
    const adapter =
      opts.carrier === 'aggregator_stub' ? 'aggregator_stub' : 'manual';

    const shipment = await client.query<{ id: string }>(
      `INSERT INTO shipments
         (tenant_id, order_id, shipping_method_id, status,
          tracking_number, tracking_carrier, adapter, shipped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN now() ELSE NULL END)
       RETURNING id`,
      [
        tenantId,
        order.id,
        order.shipping_method_id,
        shipmentStatus,
        opts.tracking,
        opts.carrier,
        adapter,
        opts.shipped,
      ],
    );

    if (opts.tracking) {
      await client.query(
        `INSERT INTO tracking_events
           (tenant_id, shipment_id, status, description)
         VALUES ($1, $2, $3, $4)`,
        [
          tenantId,
          shipment.rows[0]!.id,
          opts.statusLabel === 'shipped' ? 'in_transit' : 'label_created',
          `Order ${opts.statusLabel}; tracking ${opts.tracking}`,
        ],
      );
    }
  }

  private async syncOrderTrackingSnapshot(
    client: PoolClient,
    orderId: string,
    opts: {
      tracking: string | null;
      carrier: string | null;
      setShippedAt: boolean;
    },
  ): Promise<void> {
    await client.query(
      `UPDATE orders
       SET tracking_number = COALESCE($1, tracking_number),
           tracking_carrier = COALESCE($2, tracking_carrier),
           shipped_at = CASE WHEN $3 THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
           updated_at = now()
       WHERE id = $4`,
      [opts.tracking, opts.carrier, opts.setShippedAt, orderId],
    );
  }

  private async remainingFulfillmentLines(
    client: PoolClient,
    orderId: string,
  ): Promise<CreateFulfillmentLineInput[]> {
    const rows = await this.loadLineRows(client, orderId);
    return rows
      .map((row) => ({
        orderLineId: row.id,
        qty: row.qty_ordered - row.qty_fulfilled - (row.qty_refunded ?? 0),
      }))
      .filter((line) => line.qty > 0);
  }

  private async rollupOrderStatus(
    client: PoolClient,
    orderId: string,
  ): Promise<void> {
    const lines = await this.loadLineRows(client, orderId);
    if (lines.length === 0) {
      await client.query(
        `UPDATE orders SET status = 'fulfilled', updated_at = now() WHERE id = $1`,
        [orderId],
      );
      return;
    }

    const allFulfilled = lines.every(
      (l) => l.qty_fulfilled + (l.qty_refunded ?? 0) >= l.qty_ordered,
    );
    const anyFulfilled = lines.some((l) => l.qty_fulfilled > 0);
    const next: OrderStatus = allFulfilled
      ? 'fulfilled'
      : anyFulfilled
        ? 'partially_fulfilled'
        : 'placed';

    await client.query(
      `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`,
      [next, orderId],
    );
  }

  private async loadDetail(
    client: PoolClient,
    id: string,
  ): Promise<OrderDetailDto> {
    const order = await this.loadOrder(client, id);
    if (!order) throw new NotFoundException('Order not found');
    const lines = await this.loadLines(client, id);
    const fulfillments = await this.loadFulfillments(client, id);
    return {
      ...this.toSummary({ ...order, line_count: lines.length }),
      cartId: order.cart_id,
      checkoutSessionId: order.checkout_session_id,
      shippingAddress: order.shipping_address,
      shippingMethodId: order.shipping_method_id,
      trackingCarrier: order.tracking_carrier,
      shippedAt: asIsoOrNull(order.shipped_at),
      lines,
      fulfillments,
    };
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

  private async loadLineRows(
    client: PoolClient,
    orderId: string,
  ): Promise<LineRow[]> {
    const res = await client.query<LineRow>(
      `SELECT id, variant_id, title, quantity, unit_amount_minor, currency,
              qty_ordered, qty_fulfilled, COALESCE(qty_refunded, 0)::int AS qty_refunded
       FROM order_lines
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );
    return res.rows;
  }

  private async loadLines(
    client: PoolClient,
    orderId: string,
  ): Promise<OrderLineDto[]> {
    const rows = await this.loadLineRows(client, orderId);
    return rows.map((row) => ({
      id: row.id,
      variantId: row.variant_id,
      title: row.title,
      quantity: row.quantity,
      unitAmountMinor: asMinor(row.unit_amount_minor),
      currency: row.currency,
      qtyOrdered: row.qty_ordered,
      qtyFulfilled: row.qty_fulfilled,
      qtyRefunded: row.qty_refunded ?? 0,
    }));
  }

  private async loadFulfillmentHeader(
    client: PoolClient,
    orderId: string,
    fulfillmentId: string,
  ): Promise<FulfillmentRow | null> {
    const res = await client.query<FulfillmentRow>(
      `SELECT id, status, tracking_number, carrier, shipped_at, created_at, updated_at
       FROM fulfillments
       WHERE id = $1 AND order_id = $2`,
      [fulfillmentId, orderId],
    );
    return res.rows[0] ?? null;
  }

  private async loadFulfillments(
    client: PoolClient,
    orderId: string,
  ): Promise<FulfillmentDto[]> {
    const headers = await client.query<FulfillmentRow>(
      `SELECT id, status, tracking_number, carrier, shipped_at, created_at, updated_at
       FROM fulfillments
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );
    if (headers.rows.length === 0) return [];

    const ids = headers.rows.map((r) => r.id);
    const lineRes = await client.query<FulfillmentLineRow>(
      `SELECT fl.id, fl.fulfillment_id, fl.order_line_id, fl.qty, ol.title
       FROM fulfillment_lines fl
       JOIN order_lines ol ON ol.id = fl.order_line_id
       WHERE fl.fulfillment_id = ANY($1::uuid[])
       ORDER BY fl.created_at ASC`,
      [ids],
    );

    const byFulfillment = new Map<string, FulfillmentLineDto[]>();
    for (const row of lineRes.rows) {
      const list = byFulfillment.get(row.fulfillment_id) ?? [];
      list.push({
        id: row.id,
        orderLineId: row.order_line_id,
        qty: row.qty,
        title: row.title,
      });
      byFulfillment.set(row.fulfillment_id, list);
    }

    return headers.rows.map((row) => ({
      id: row.id,
      status: row.status as FulfillmentStatus,
      trackingNumber: row.tracking_number,
      carrier: row.carrier,
      shippedAt: asIsoOrNull(row.shipped_at),
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
      lines: byFulfillment.get(row.id) ?? [],
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
}
