import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NoopAdapter } from '@ecom/payment-providers';
import { DatabaseService } from '../db/database.service';
import { CartService } from '../cart/cart.service';
import { ComputeClientService } from '../common/compute.client';
import {
  createGuestToken,
  hashAccessToken,
} from '../common/guest-token';

export type ShippingAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type CheckoutResult = {
  id: string;
  cartId: string;
  guestEmail: string;
  shippingAddress: ShippingAddressInput;
  addressValidation: {
    mode: 'soft_warn';
    valid: boolean;
    warnings: string[];
    normalized: ShippingAddressInput;
    provider: string;
  };
  order: {
    id: string;
    status: 'pending' | 'placed';
    paymentStatus: string;
    totalAmountMinor: number;
    currency: string;
    accessToken: string;
  };
  payment: {
    id: string;
    status: string;
    provider: string;
  };
};

@Injectable()
export class CheckoutService {
  private readonly payments = new NoopAdapter();

  constructor(
    private readonly db: DatabaseService,
    private readonly carts: CartService,
    private readonly compute: ComputeClientService,
  ) {}

  async createSession(
    tenantId: string,
    input: {
      cartId: string;
      email: string;
      shippingAddress: ShippingAddressInput;
    },
  ): Promise<CheckoutResult> {
    if (!input.email?.includes('@')) {
      throw new BadRequestException('Valid guest email is required');
    }
    if (!input.shippingAddress?.line1 || !input.shippingAddress?.city || !input.shippingAddress?.country) {
      throw new BadRequestException(
        'shippingAddress requires line1, city, and country',
      );
    }

    const cart = await this.carts.getById(tenantId, input.cartId);
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.lines.length === 0) {
      throw new BadRequestException('Cart has no lines');
    }

    await this.carts.setEmail(tenantId, cart.id, input.email);

    const validation = await this.compute.validateAddress({
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2,
      city: input.shippingAddress.city,
      region: input.shippingAddress.region,
      postalCode: input.shippingAddress.postalCode,
      country: input.shippingAddress.country,
    });

    const total = cart.lines.reduce(
      (sum, l) => sum + l.unitAmountMinor * l.quantity,
      0,
    );
    const currency = cart.chargeCurrency ?? cart.lines[0]?.currency ?? 'USD';

    // Soft-warn mode: never hard-block; surface warnings to client
    const payment = await this.payments.createPayment({
      tenantId,
      amountMinor: total,
      currency,
    });

    const accessToken = createGuestToken();
    const accessTokenHash = hashAccessToken(accessToken);

    // Without real charging: place order as `placed` with payment deferred/not_charged
    const orderStatus: 'pending' | 'placed' =
      payment.status === 'succeeded' ? 'placed' : 'placed';
    const paymentStatus =
      payment.status === 'not_implemented' ? 'not_charged' : payment.status;

    return this.db.withTenant(tenantId, async (client) => {
      const session = await client.query<{ id: string }>(
        `INSERT INTO checkout_sessions
           (tenant_id, cart_id, guest_email, shipping_address,
            address_validated, address_provider, normalized_address)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)
         RETURNING id`,
        [
          tenantId,
          cart.id,
          input.email,
          JSON.stringify(input.shippingAddress),
          validation.valid,
          'stub',
          JSON.stringify(validation.normalized),
        ],
      );

      const sessionId = session.rows[0]!.id;
      const order = await client.query<{ id: string }>(
        `INSERT INTO orders
           (tenant_id, cart_id, checkout_session_id, status, payment_status,
            guest_email, shipping_address, charge_currency, total_amount_minor,
            access_token_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
         RETURNING id`,
        [
          tenantId,
          cart.id,
          sessionId,
          orderStatus,
          paymentStatus,
          input.email,
          JSON.stringify(input.shippingAddress),
          currency,
          total,
          accessTokenHash,
        ],
      );

      const orderId = order.rows[0]!.id;
      for (const line of cart.lines) {
        await client.query(
          `INSERT INTO order_lines
             (tenant_id, order_id, variant_id, title, quantity,
              unit_amount_minor, currency, qty_ordered, qty_fulfilled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $5, 0)`,
          [
            tenantId,
            orderId,
            line.variantId,
            line.title ?? 'Item',
            line.quantity,
            line.unitAmountMinor,
            line.currency,
          ],
        );
      }

      await this.carts.markConverted(client, cart.id);

      return {
        id: sessionId,
        cartId: cart.id,
        guestEmail: input.email,
        shippingAddress: input.shippingAddress,
        addressValidation: {
          mode: 'soft_warn' as const,
          valid: validation.valid,
          warnings: validation.warnings,
          normalized: validation.normalized,
          provider: 'stub',
        },
        order: {
          id: orderId,
          status: orderStatus,
          paymentStatus,
          totalAmountMinor: total,
          currency,
          accessToken,
        },
        payment: {
          id: payment.id,
          status: payment.status,
          provider: payment.provider,
        },
      };
    });
  }
}
