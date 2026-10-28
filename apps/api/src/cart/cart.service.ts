import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { createGuestToken } from '../common/guest-token';

export type CartLineDto = {
  id: string;
  variantId: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
  title?: string;
};

export type CartDto = {
  id: string;
  tenantId: string;
  status: string;
  guestToken: string;
  customerId: string | null;
  email: string | null;
  locale: string | null;
  chargeCurrency: string | null;
  lines: CartLineDto[];
};

@Injectable()
export class CartService {
  constructor(private readonly db: DatabaseService) {}

  async createGuestCart(
    tenantId: string,
    opts?: {
      locale?: string;
      chargeCurrency?: string;
      displayCurrency?: string;
      /** @deprecated use chargeCurrency / displayCurrency */
      currency?: string;
    },
  ): Promise<CartDto> {
    const guestToken = createGuestToken();
    const charge = opts?.chargeCurrency ?? opts?.currency ?? 'USD';
    const display = opts?.displayCurrency ?? charge;
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await client.query<{
        id: string;
        tenant_id: string;
        status: string;
        guest_token: string;
        customer_id: string | null;
        email: string | null;
        locale: string | null;
        charge_currency: string | null;
      }>(
        `INSERT INTO carts (tenant_id, status, guest_token, locale, charge_currency, display_currency)
         VALUES ($1, 'active', $2, $3, $4, $5)
         RETURNING id, tenant_id, status, guest_token, customer_id, email, locale, charge_currency`,
        [
          tenantId,
          guestToken,
          opts?.locale ?? 'en',
          charge,
          display,
        ],
      );
      const row = cart.rows[0]!;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        status: row.status,
        guestToken: row.guest_token,
        customerId: row.customer_id,
        email: row.email,
        locale: row.locale,
        chargeCurrency: row.charge_currency,
        lines: [],
      };
    });
  }

  async getByGuestToken(
    tenantId: string,
    guestToken: string,
  ): Promise<CartDto | null> {
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await client.query<{
        id: string;
        tenant_id: string;
        status: string;
        guest_token: string;
        customer_id: string | null;
        email: string | null;
        locale: string | null;
        charge_currency: string | null;
      }>(
        `SELECT id, tenant_id, status, guest_token, customer_id, email, locale, charge_currency
         FROM carts WHERE guest_token = $1 AND status = 'active' LIMIT 1`,
        [guestToken],
      );
      if (!cart.rows[0]) return null;
      return this.mapCart(client, cart.rows[0]);
    });
  }

  async getById(tenantId: string, cartId: string): Promise<CartDto | null> {
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await client.query<{
        id: string;
        tenant_id: string;
        status: string;
        guest_token: string;
        customer_id: string | null;
        email: string | null;
        locale: string | null;
        charge_currency: string | null;
      }>(
        `SELECT id, tenant_id, status, guest_token, customer_id, email, locale, charge_currency
         FROM carts WHERE id = $1 LIMIT 1`,
        [cartId],
      );
      if (!cart.rows[0]) return null;
      return this.mapCart(client, cart.rows[0]);
    });
  }

  async addOrUpdateLine(
    tenantId: string,
    cartId: string,
    input: { variantId: string; quantity: number },
  ): Promise<CartDto> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await this.requireCart(client, cartId);
      const variant = await client.query<{
        id: string;
        unit_amount_minor: string;
        currency: string;
        title: string;
      }>(
        `SELECT id, unit_amount_minor::text, currency, title
         FROM product_variants WHERE id = $1 LIMIT 1`,
        [input.variantId],
      );
      if (!variant.rows[0]) {
        throw new NotFoundException('Variant not found');
      }
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM cart_lines WHERE cart_id = $1 AND variant_id = $2 LIMIT 1`,
        [cartId, input.variantId],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE cart_lines SET quantity = $1 WHERE id = $2`,
          [input.quantity, existing.rows[0].id],
        );
      } else {
        await client.query(
          `INSERT INTO cart_lines
             (tenant_id, cart_id, variant_id, quantity, unit_amount_minor, currency)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tenantId,
            cartId,
            input.variantId,
            input.quantity,
            Number(variant.rows[0].unit_amount_minor),
            variant.rows[0].currency,
          ],
        );
      }
      await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [
        cartId,
      ]);
      return this.mapCart(client, cart);
    });
  }

  async updateLine(
    tenantId: string,
    cartId: string,
    lineId: string,
    quantity: number,
  ): Promise<CartDto> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await this.requireCart(client, cartId);
      const updated = await client.query(
        `UPDATE cart_lines SET quantity = $1
         WHERE id = $2 AND cart_id = $3
         RETURNING id`,
        [quantity, lineId, cartId],
      );
      if (!updated.rows[0]) throw new NotFoundException('Line not found');
      await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [
        cartId,
      ]);
      return this.mapCart(client, cart);
    });
  }

  async removeLine(
    tenantId: string,
    cartId: string,
    lineId: string,
  ): Promise<CartDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const cart = await this.requireCart(client, cartId);
      const deleted = await client.query(
        `DELETE FROM cart_lines WHERE id = $1 AND cart_id = $2 RETURNING id`,
        [lineId, cartId],
      );
      if (!deleted.rows[0]) throw new NotFoundException('Line not found');
      await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [
        cartId,
      ]);
      return this.mapCart(client, cart);
    });
  }

  async setEmail(
    tenantId: string,
    cartId: string,
    email: string,
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (client) => {
      await this.requireCart(client, cartId);
      await client.query(
        `UPDATE carts SET email = $1, updated_at = now() WHERE id = $2`,
        [email, cartId],
      );
    });
  }

  async markConverted(client: PoolClient, cartId: string): Promise<void> {
    await client.query(
      `UPDATE carts SET status = 'converted', updated_at = now() WHERE id = $1`,
      [cartId],
    );
  }

  private async requireCart(
    client: PoolClient,
    cartId: string,
  ): Promise<{
    id: string;
    tenant_id: string;
    status: string;
    guest_token: string;
    customer_id: string | null;
    email: string | null;
    locale: string | null;
    charge_currency: string | null;
  }> {
    const cart = await client.query<{
      id: string;
      tenant_id: string;
      status: string;
      guest_token: string;
      customer_id: string | null;
      email: string | null;
      locale: string | null;
      charge_currency: string | null;
    }>(
      `SELECT id, tenant_id, status, guest_token, customer_id, email, locale, charge_currency
       FROM carts WHERE id = $1 AND status = 'active' LIMIT 1`,
      [cartId],
    );
    if (!cart.rows[0]) throw new NotFoundException('Cart not found');
    return cart.rows[0];
  }

  private async mapCart(
    client: PoolClient,
    row: {
      id: string;
      tenant_id: string;
      status: string;
      guest_token: string;
      customer_id: string | null;
      email: string | null;
      locale: string | null;
      charge_currency: string | null;
    },
  ): Promise<CartDto> {
    const lines = await client.query<{
      id: string;
      variant_id: string;
      quantity: number;
      unit_amount_minor: string;
      currency: string;
      title: string | null;
    }>(
      `SELECT cl.id, cl.variant_id, cl.quantity, cl.unit_amount_minor::text, cl.currency,
              pv.title
       FROM cart_lines cl
       LEFT JOIN product_variants pv ON pv.id = cl.variant_id
       WHERE cl.cart_id = $1
       ORDER BY cl.created_at`,
      [row.id],
    );
    return {
      id: row.id,
      tenantId: row.tenant_id,
      status: row.status,
      guestToken: row.guest_token,
      customerId: row.customer_id,
      email: row.email,
      locale: row.locale,
      chargeCurrency: row.charge_currency,
      lines: lines.rows.map((l) => ({
        id: l.id,
        variantId: l.variant_id,
        quantity: l.quantity,
        unitAmountMinor: Number(l.unit_amount_minor),
        currency: l.currency,
        title: l.title ?? undefined,
      })),
    };
  }
}
