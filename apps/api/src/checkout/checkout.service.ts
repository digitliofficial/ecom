import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isOfflinePaymentMethod,
  offlineProviderFor,
  type OfflinePaymentMethod,
} from '@ecom/payment-providers';
import { DatabaseService } from '../db/database.service';
import { CartService } from '../cart/cart.service';
import { ComputeClientService } from '../common/compute.client';
import {
  createGuestToken,
  hashAccessToken,
} from '../common/guest-token';
import { AbandonedCartService } from '../notifications/abandoned-cart.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MeteringService,
  type SoftLimitWarning,
} from '../billing/metering.service';
import {
  PaymentsService,
  type BankDetails,
} from '../payments/payments.service';
import { ShippingService } from '../shipping/shipping.service';

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
  shipping: {
    methodId: string;
    methodName: string;
    amountMinor: number;
    currency: string;
    adapter: string;
  };
  order: {
    id: string;
    status: 'pending' | 'placed';
    paymentStatus: string;
    paymentMethod: OfflinePaymentMethod;
    subtotalAmountMinor: number;
    shippingAmountMinor: number;
    totalAmountMinor: number;
    currency: string;
    accessToken: string;
  };
  payment: {
    id: string;
    status: string;
    provider: string;
  };
  /** Present when paymentMethod is bank_transfer */
  bankTransferInstructions: BankDetails | null;
  /** Soft plan metering — never blocks checkout */
  planSoftWarning: SoftLimitWarning | null;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly db: DatabaseService,
    private readonly carts: CartService,
    private readonly compute: ComputeClientService,
    private readonly paymentsConfig: PaymentsService,
    private readonly shipping: ShippingService,
    private readonly notifications: NotificationsService,
    private readonly abandonedCart: AbandonedCartService,
    private readonly metering: MeteringService,
  ) {}

  async createSession(
    tenantId: string,
    input: {
      cartId: string;
      email: string;
      shippingAddress: ShippingAddressInput;
      paymentMethod: string;
      shippingMethodId: string;
      customerId?: string | null;
    },
  ): Promise<CheckoutResult> {
    if (!input.email?.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!input.shippingAddress?.line1 || !input.shippingAddress?.city || !input.shippingAddress?.country) {
      throw new BadRequestException(
        'shippingAddress requires line1, city, and country',
      );
    }
    if (!input.paymentMethod || !isOfflinePaymentMethod(input.paymentMethod)) {
      throw new BadRequestException(
        'paymentMethod must be cod or bank_transfer',
      );
    }
    if (!input.shippingMethodId?.trim()) {
      throw new BadRequestException('shippingMethodId is required');
    }

    const paymentMethod = input.paymentMethod;
    const { bankDetails } = await this.paymentsConfig.assertMethodEnabled(
      tenantId,
      paymentMethod,
    );

    const shippingMethod = await this.shipping.assertMethodForCheckout(
      tenantId,
      input.shippingMethodId.trim(),
      paymentMethod,
    );

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

    const subtotal = cart.lines.reduce(
      (sum, l) => sum + l.unitAmountMinor * l.quantity,
      0,
    );
    const shippingAmount = shippingMethod.priceAmountMinor;
    const total = subtotal + shippingAmount;
    const currency = cart.chargeCurrency ?? cart.lines[0]?.currency ?? 'USD';

    // Soft order/month cap — warn only; never block checkout.
    const planSoftWarning = await this.metering.softCheckOrdersMonth(tenantId);

    // Offline PaymentProvider adapters (COD / bank transfer). Stripe/Noop stay optional.
    const provider = offlineProviderFor(paymentMethod);
    const payment = await provider.createPayment({
      tenantId,
      amountMinor: total,
      currency,
      metadata: {
        paymentMethod,
        shippingMethodId: shippingMethod.id,
      },
    });

    const orderStatus: 'pending' | 'placed' = 'placed';
    const paymentStatus = payment.status;

    const accessToken = createGuestToken();
    const accessTokenHash = hashAccessToken(accessToken);

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
      if (input.customerId) {
        await client.query(
          `UPDATE carts SET customer_id = $1, updated_at = now() WHERE id = $2`,
          [input.customerId, cart.id],
        );
      }

      const order = await client.query<{ id: string }>(
        `INSERT INTO orders
           (tenant_id, cart_id, checkout_session_id, status, payment_status,
            payment_method, guest_email, customer_id, shipping_address,
            charge_currency, total_amount_minor, access_token_hash,
            shipping_method_id, shipping_method_name, shipping_amount_minor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12,
                 $13, $14, $15)
         RETURNING id`,
        [
          tenantId,
          cart.id,
          sessionId,
          orderStatus,
          paymentStatus,
          paymentMethod,
          input.customerId ? null : input.email,
          input.customerId ?? null,
          JSON.stringify(input.shippingAddress),
          currency,
          total,
          accessTokenHash,
          shippingMethod.id,
          shippingMethod.name,
          shippingAmount,
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
      await this.abandonedCart.cancelPendingRuns(tenantId, cart.id, client);

      await this.notifications.notifyOrderPlaced({
        tenantId,
        orderId,
        customerEmail: input.email,
        paymentMethod,
        paymentStatus,
        totalAmountMinor: total,
        currency,
        locale: cart.locale ?? 'en',
        client,
      });

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
        shipping: {
          methodId: shippingMethod.id,
          methodName: shippingMethod.name,
          amountMinor: shippingAmount,
          currency: shippingMethod.currency,
          adapter: shippingMethod.adapter,
        },
        order: {
          id: orderId,
          status: orderStatus,
          paymentStatus,
          paymentMethod,
          subtotalAmountMinor: subtotal,
          shippingAmountMinor: shippingAmount,
          totalAmountMinor: total,
          currency,
          accessToken,
        },
        payment: {
          id: payment.id,
          status: payment.status,
          provider: payment.provider,
        },
        bankTransferInstructions:
          paymentMethod === 'bank_transfer' ? bankDetails : null,
        planSoftWarning,
      };
    }).then(async (result) => {
      // Drain outbox so console/Resend shows mail promptly after checkout
      try {
        await this.notifications.processOutbox();
      } catch {
        /* worker will retry */
      }
      return result;
    });
  }
}
